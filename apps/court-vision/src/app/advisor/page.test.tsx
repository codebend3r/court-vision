import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type AdvisorViewProps } from "@/components/AdvisorView/AdvisorView";
import { type MyTeamPickerProps } from "@/components/MyTeamPicker/MyTeamPicker";
import { type AdvisorLeagueData } from "@/lib/advisor/types";
import { type LeagueSummary } from "@/lib/leagues/types";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING } from "@vision/sport-basketball/engine";

const getProfile = vi.fn();
const getActiveLeague = vi.fn();
const getLeagueTeams = vi.fn();
const getFantasyPool = vi.fn();
const getAdvisorLeagueData = vi.fn();
const getActiveRosterPlayers = vi.fn();
const viewProps = vi.fn();
const pickerProps = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeague: () => getActiveLeague() }));
type GetLeagueTeamsProps = { leagueId: string };

vi.mock("@/lib/leagues/teamQueries", () => ({
  getLeagueTeams: (args: GetLeagueTeamsProps) => getLeagueTeams(args),
}));
type GetFantasyPoolProps = { range: string };

vi.mock("@/lib/valuation/loader", () => ({
  getFantasyPool: (args: GetFantasyPoolProps) => getFantasyPool(args),
}));
type GetAdvisorLeagueDataProps = { leagueId: string; myTeamId: string };

vi.mock("@/lib/advisor/loader", () => ({
  getAdvisorLeagueData: (args: GetAdvisorLeagueDataProps) => getAdvisorLeagueData(args),
}));
vi.mock("@/lib/fantasyTeams/loader", () => ({
  getActiveRosterPlayers: () => getActiveRosterPlayers(),
}));
vi.mock("@/components/AdvisorView/AdvisorView", () => ({
  AdvisorView: (props: AdvisorViewProps) => {
    viewProps(props);
    return <p>advisor view</p>;
  },
}));
vi.mock("@/components/MyTeamPicker/MyTeamPicker", () => ({
  MyTeamPicker: (props: MyTeamPickerProps) => {
    pickerProps(props);
    return <p>my team picker</p>;
  },
}));
vi.mock("@/components/SyncYahooButton/SyncYahooButton", () => ({
  SyncYahooButton: () => <button type="button">Sync with Yahoo</button>,
}));

import AdvisorPage from "@/app/advisor/page";

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
  myTeamId: "team-5",
  syncedAt: "2026-10-16T00:00:00.000Z",
  syncError: null,
  unsupportedCategories: [],
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  ...overrides,
});

const leagueData: AdvisorLeagueData = {
  myRoster: [],
  rosteredPlayerIds: [],
  waivers: [],
  unmatched: [],
  teams: [],
};

const lines = [makeStatLine({ playerId: 1 })];

type RenderPageProps = { raw?: Record<string, string> };

const renderPage = async ({ raw = {} }: RenderPageProps = {}) =>
  render(await AdvisorPage({ searchParams: Promise.resolve(raw) }));

const expectNothingLoaded = () => {
  expect(getFantasyPool).not.toHaveBeenCalled();
  expect(getAdvisorLeagueData).not.toHaveBeenCalled();
  expect(viewProps).not.toHaveBeenCalled();
};

beforeEach(() => {
  getProfile.mockReset().mockResolvedValue({ id: "profile-1", preferredFormula: "gscore" });
  getActiveLeague.mockReset().mockResolvedValue(importedLeague());
  getLeagueTeams.mockReset().mockResolvedValue([]);
  getFantasyPool.mockReset().mockResolvedValue(lines);
  getAdvisorLeagueData.mockReset().mockResolvedValue(leagueData);
  getActiveRosterPlayers.mockReset().mockResolvedValue([{ playerId: 1 }]);
  viewProps.mockReset();
  pickerProps.mockReset();
});

afterEach(cleanup);

describe("AdvisorPage", () => {
  it("sends a signed-out visitor to log in", async () => {
    getProfile.mockResolvedValue(null);
    const thrown = await AdvisorPage({ searchParams: Promise.resolve({}) }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(redirectTarget(thrown)).toContain("/login?next=/advisor");
    expectNothingLoaded();
  });

  it("points to the Yahoo import without a league or with a hand-built one", async () => {
    getActiveLeague.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Roster Advisor" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import from Yahoo" })).toBeInTheDocument();
    cleanup();

    getActiveLeague.mockResolvedValue(importedLeague({ isImported: false, provider: "manual" }));
    await renderPage();
    expect(screen.getByText(/needs a league imported from Yahoo/)).toBeInTheDocument();
    expectNothingLoaded();
  });

  it("turns away a points league", async () => {
    getActiveLeague.mockResolvedValue(
      importedLeague({
        scoringType: "h2h_points",
        scoringConfig: { scoring: { ...DEFAULT_POINTS_SCORING } },
      }),
    );
    await renderPage();
    expect(screen.getByText(/doesn't support points leagues/)).toBeInTheDocument();
    expectNothingLoaded();
  });

  it("asks which team is mine first", async () => {
    getActiveLeague.mockResolvedValue(importedLeague({ myTeamId: null }));
    await renderPage();
    expect(screen.getByText("my team picker")).toBeInTheDocument();
    expectNothingLoaded();
  });

  it("hands the pool, the league and the method to the view", async () => {
    await renderPage({ raw: { range: "last10" } });
    expect(getFantasyPool).toHaveBeenCalledWith({ range: "last10" });
    expect(getAdvisorLeagueData).toHaveBeenCalledWith({ leagueId: "league-1", myTeamId: "team-5" });
    expect(viewProps).toHaveBeenCalledWith(
      expect.objectContaining({
        range: "last10",
        lines,
        league: leagueData,
        activePlayerIds: [1],
        method: "gscore",
      }),
    );
    expect(screen.getByText("Game of Courts · Yahoo")).toBeInTheDocument();
  });
});
