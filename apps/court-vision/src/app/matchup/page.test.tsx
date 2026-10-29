import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { TEST_SEASON, TEST_WEEK } from "@/components/MatchupView/fixture";
import { type MyTeamPickerProps } from "@/components/MyTeamPicker/MyTeamPicker";
import { type SyncYahooButtonProps } from "@/components/SyncYahooButton/SyncYahooButton";
import { type LeagueSummary } from "@/lib/leagues/types";

const getProfile = vi.fn();
const getActiveLeagueRecord = vi.fn();
const getLeagueTeams = vi.fn();
const getLeagueSeason = vi.fn();
const pickerProps = vi.fn();
const syncProps = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
type ToLeagueSummaryProps = { league: LeagueSummary };

vi.mock("@/lib/leagues/queries", () => ({
  getActiveLeagueRecord: () => getActiveLeagueRecord(),
  // The page only reads the summary's own fields back off the record.
  toLeagueSummary: ({ league }: ToLeagueSummaryProps) => league,
}));
type GetLeagueTeamsProps = { leagueId: string };

vi.mock("@/lib/leagues/teamQueries", () => ({
  getLeagueTeams: (args: GetLeagueTeamsProps) => getLeagueTeams(args),
}));
vi.mock("@/lib/matchups/loader", () => ({
  getLeagueSeason: (args: unknown) => getLeagueSeason(args),
}));
vi.mock("@/components/MyTeamPicker/MyTeamPicker", () => ({
  MyTeamPicker: (props: MyTeamPickerProps) => {
    pickerProps(props);
    return <p>my team picker</p>;
  },
}));
vi.mock("@/components/SyncYahooButton/SyncYahooButton", () => ({
  SyncYahooButton: (props: SyncYahooButtonProps) => {
    syncProps(props);
    return <button type="button">Sync with Yahoo</button>;
  },
}));

import MatchupPage from "@/app/matchup/page";

const redirectTarget = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string"
    ? error.digest
    : "";

const importedLeague = (overrides: Partial<LeagueSummary> = {}): LeagueSummary => ({
  id: "league-1",
  name: "Game of Courts",
  slug: "game-of-courts",
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts", "reb", "ast"] },
  provider: "yahoo",
  syncVia: "server",
  isImported: true,
  externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
  myTeamId: "a",
  syncedAt: "2026-10-16T00:00:00.000Z",
  syncError: null,
  unsupportedCategories: [],
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  ...overrides,
});

type RenderPageProps = { raw?: Record<string, string> };

const renderPage = async ({ raw = {} }: RenderPageProps = {}) =>
  render(await MatchupPage({ searchParams: Promise.resolve(raw) }));

beforeEach(() => {
  getProfile.mockReset().mockResolvedValue({ id: "profile-1" });
  getActiveLeagueRecord.mockReset().mockResolvedValue(importedLeague());
  getLeagueTeams.mockReset().mockResolvedValue([]);
  getLeagueSeason.mockReset().mockResolvedValue([TEST_WEEK]);
  pickerProps.mockReset();
  syncProps.mockReset();
});

afterEach(cleanup);

describe("MatchupPage", () => {
  it("sends a signed-out visitor to log in", async () => {
    getProfile.mockResolvedValue(null);

    const error = await renderPage().catch((caught: unknown) => caught);

    expect(redirectTarget(error)).toContain("/login?next=/matchup");
  });

  it("asks a visitor with no league to import one", async () => {
    getActiveLeagueRecord.mockResolvedValue(null);

    await renderPage();

    expect(screen.getByText(/No league yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import from Yahoo" })).toBeInTheDocument();
    expect(getLeagueSeason).not.toHaveBeenCalled();
  });

  it("asks a hand-built league to be imported", async () => {
    getActiveLeagueRecord.mockResolvedValue(
      importedLeague({ isImported: false, provider: "manual" }),
    );

    await renderPage();

    expect(screen.getByText(/need a league imported from Yahoo/)).toBeInTheDocument();
    expect(getLeagueSeason).not.toHaveBeenCalled();
  });

  it("explains that only head-to-head categories leagues have matchups", async () => {
    getActiveLeagueRecord.mockResolvedValue(importedLeague({ scoringType: "roto" }));

    await renderPage();

    expect(screen.getByText(/head-to-head categories leagues/)).toBeInTheDocument();
    expect(getLeagueSeason).not.toHaveBeenCalled();
  });

  it("asks which team is mine before showing a matchup", async () => {
    getActiveLeagueRecord.mockResolvedValue(importedLeague({ myTeamId: null }));

    await renderPage();

    expect(screen.getByText("my team picker")).toBeInTheDocument();
    expect(pickerProps).toHaveBeenCalledWith(expect.objectContaining({ leagueId: "league-1" }));
    expect(getLeagueSeason).not.toHaveBeenCalled();
  });

  it("offers a sync when the league has no matchup stored yet", async () => {
    getLeagueSeason.mockResolvedValue([]);

    await renderPage();

    expect(screen.getByText(/No matchup data yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync with Yahoo" })).toBeInTheDocument();
  });

  it("shows my matchup against my opponent by default", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Matchup" })).toBeInTheDocument();
    expect(screen.getByText(/Week 2, Oct 27 to Nov 2/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "This week's matchup" })).toBeInTheDocument();
    expect(screen.getByLabelText("0 wins, 2 losses, 0 ties")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "League totals for the week" })).toBeNull();
    expect(screen.getByRole("link", { name: /My matchup/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows scoreboard freshness independently of a newer roster sync", async () => {
    getActiveLeagueRecord.mockResolvedValue(
      importedLeague({ syncedAt: "2026-11-01T00:00:00.000Z" }),
    );
    await renderPage();
    const stamp = screen.getByText(/10\/28\/2026/);
    expect(stamp).toHaveAttribute("dateTime", TEST_WEEK.syncedAt);
    expect(syncProps).toHaveBeenCalledWith(
      expect.objectContaining({ syncedAt: "2026-11-01T00:00:00.000Z" }),
    );
  });

  it("asks for a refresh when the scoreboard's timestamp is unknown", async () => {
    getLeagueSeason.mockResolvedValue([{ ...TEST_WEEK, syncedAt: null }]);
    await renderPage();
    expect(screen.getByText(/Scoreboard updated: unknown/)).toBeInTheDocument();
  });

  it("shows where I stand and every team's totals on the league view", async () => {
    await renderPage({ raw: { view: "league" } });

    expect(screen.getByRole("region", { name: "Team a standing by category" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "League totals for the week" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "This week's matchup" })).toBeNull();
    expect(screen.getByRole("link", { name: /League totals/ })).toHaveAttribute(
      "href",
      "/matchup?view=league",
    );
  });

  it("says so when my team has no opponent this week", async () => {
    getLeagueSeason.mockResolvedValue([
      { ...TEST_WEEK, pairings: [{ teamAId: "c", teamBId: "d" }] },
    ]);

    await renderPage();

    expect(screen.getByText(/no opponent in week 2/)).toBeInTheDocument();
  });

  it("shows the latest week by default and offers every stored week", async () => {
    getLeagueSeason.mockResolvedValue(TEST_SEASON);

    await renderPage();

    expect(screen.getByText(/Week 3, Nov 3 to Nov 9/)).toBeInTheDocument();
    const weeks = screen.getByRole("navigation", { name: "Weeks" });
    expect(weeks).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Week 3/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Week 1/ })).toHaveAttribute("href", "/matchup?week=1");
  });

  it("shows a past week the URL names, and keeps it across views", async () => {
    getLeagueSeason.mockResolvedValue(TEST_SEASON);

    await renderPage({ raw: { week: "1" } });

    expect(screen.getByText(/Week 1, Oct 20 to Oct 26/)).toBeInTheDocument();
    expect(screen.getByLabelText("2 wins, 0 losses, 0 ties")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /League totals/ })).toHaveAttribute(
      "href",
      "/matchup?view=league&week=1",
    );
  });

  it("hides the week picker with a single stored week", async () => {
    await renderPage();
    expect(screen.queryByRole("navigation", { name: "Weeks" })).toBeNull();
  });

  it("shows the whole season on the season view", async () => {
    getLeagueSeason.mockResolvedValue(TEST_SEASON);

    await renderPage({ raw: { view: "season" } });

    expect(screen.getByText(/Game of Courts · 3 weeks/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Team a season record" })).toBeInTheDocument();
    expect(screen.getByLabelText("1 won, 1 lost, 0 tied")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Weeks" })).toBeNull();
    expect(screen.queryByRole("region", { name: "This week's matchup" })).toBeNull();
  });
});
