import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { TEST_WEEK } from "@/components/MatchupView/fixture";
import { type MyTeamPickerProps } from "@/components/MyTeamPicker/MyTeamPicker";
import { type SyncYahooButtonProps } from "@/components/SyncYahooButton/SyncYahooButton";
import { type LeagueSummary } from "@/lib/leagues/types";

const getProfile = vi.fn();
const getActiveLeagueRecord = vi.fn();
const getLeagueTeams = vi.fn();
const getLeagueWeek = vi.fn();
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
  getLeagueWeek: (args: unknown) => getLeagueWeek(args),
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
  getLeagueWeek.mockReset().mockResolvedValue(TEST_WEEK);
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
    expect(getLeagueWeek).not.toHaveBeenCalled();
  });

  it("asks a hand-built league to be imported", async () => {
    getActiveLeagueRecord.mockResolvedValue(
      importedLeague({ isImported: false, provider: "manual" }),
    );

    await renderPage();

    expect(screen.getByText(/need a league imported from Yahoo/)).toBeInTheDocument();
    expect(getLeagueWeek).not.toHaveBeenCalled();
  });

  it("explains that only head-to-head categories leagues have matchups", async () => {
    getActiveLeagueRecord.mockResolvedValue(importedLeague({ scoringType: "roto" }));

    await renderPage();

    expect(screen.getByText(/head-to-head categories leagues/)).toBeInTheDocument();
    expect(getLeagueWeek).not.toHaveBeenCalled();
  });

  it("asks which team is mine before showing a matchup", async () => {
    getActiveLeagueRecord.mockResolvedValue(importedLeague({ myTeamId: null }));

    await renderPage();

    expect(screen.getByText("my team picker")).toBeInTheDocument();
    expect(pickerProps).toHaveBeenCalledWith(expect.objectContaining({ leagueId: "league-1" }));
    expect(getLeagueWeek).not.toHaveBeenCalled();
  });

  it("offers a sync when the league has no matchup stored yet", async () => {
    getLeagueWeek.mockResolvedValue(null);

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
    getLeagueWeek.mockResolvedValue({ ...TEST_WEEK, syncedAt: null });
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
    getLeagueWeek.mockResolvedValue({ ...TEST_WEEK, pairings: [{ teamAId: "c", teamBId: "d" }] });

    await renderPage();

    expect(screen.getByText(/no opponent this week/)).toBeInTheDocument();
  });
});
