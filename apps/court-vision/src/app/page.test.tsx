import { cleanup, render, screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
  redirect: (url: string) => {
    throw Object.assign(new Error("redirect"), { digest: `NEXT_REDIRECT;push;${url};307;` });
  },
}));

const getProfile = vi.fn();
const getWatchlistPlayers = vi.fn();
const getWatchlistCount = vi.fn();
const getTrendSeries = vi.fn();
const getHomeInsights = vi.fn();
const getActiveLeague = vi.fn();
const getLeagueTeams = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/watchlist/queries", () => ({ getWatchlistPlayers, getWatchlistCount }));
vi.mock("@/lib/watchlist/trendLoader", () => ({ getTrendSeries }));
vi.mock("@/lib/home/insights", () => ({ getHomeInsights }));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeague: () => getActiveLeague() }));
type GetLeagueTeamsProps = { leagueId: string };

vi.mock("@/lib/leagues/teamQueries", () => ({
  getLeagueTeams: (args: GetLeagueTeamsProps) => getLeagueTeams(args),
}));

import Home from "@/app/page";
import { ThemeProvider } from "@vision/ui/components/ThemeProvider/ThemeProvider";

// The chart is a client component that reads the theme; in the app that comes
// from the root layout, so the test supplies the same wrapper.
const renderHome = async () =>
  render(<ThemeProvider>{await Home()}</ThemeProvider>, { wrapper: withNuqsTestingAdapter() });

afterEach(cleanup);

beforeEach(() => {
  getProfile.mockReset();
  getWatchlistPlayers.mockReset();
  getWatchlistCount.mockReset();
  getTrendSeries.mockReset();
  getHomeInsights.mockReset();
  getWatchlistPlayers.mockResolvedValue([]);
  getWatchlistCount.mockResolvedValue(0);
  getTrendSeries.mockResolvedValue(trends({ series: [] }));
  getHomeInsights.mockResolvedValue({ valueById: new Map(), methodLabel: "Z-Score", advice: null });
  getActiveLeague.mockReset().mockResolvedValue(null);
  getLeagueTeams.mockReset().mockResolvedValue([]);
});

type SummaryProps = { playerId: number; fullName: string };

const summary = ({ playerId, fullName }: SummaryProps) => ({
  playerId,
  fullName,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  starredAt: "2026-07-30T12:00:00.000Z",
});

type TrendsProps = { series: readonly unknown[] };

// Every method's series, all the same, with no league average yet.
const trends = ({ series }: TrendsProps) => ({
  series: {
    z: series,
    g: series,
    points: series,
    vorp: series,
    positional: series,
    sgp: series,
    sim: series,
  },
  averages: { z: [], g: [], points: [], vorp: [], positional: [], sgp: [], sim: [] },
});

// Next's redirect() throws an error whose digest encodes the destination
// ("NEXT_REDIRECT;push;/login;307;"); reading it is how a test observes where
// a server component sent the visitor.
const redirectTarget = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string"
    ? error.digest
    : "";

describe("Home", () => {
  it("sends a signed-out visitor to the login form", async () => {
    getProfile.mockResolvedValue(null);

    const thrown = await Home().then(
      () => null,
      (error: unknown) => error,
    );

    expect(redirectTarget(thrown)).toContain("/login");
  });

  it("does not read the watchlist for a signed-out visitor", async () => {
    getProfile.mockResolvedValue(null);

    await Home().catch(() => null);

    expect(getWatchlistPlayers).not.toHaveBeenCalled();
  });

  it("lists the most recently starred players with a link to the full list", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    getWatchlistPlayers.mockResolvedValue([
      summary({ playerId: 1, fullName: "Jalen Brunson" }),
      summary({ playerId: 2, fullName: "Karl-Anthony Towns" }),
    ]);
    getWatchlistCount.mockResolvedValue(12);

    await renderHome();

    expect(screen.getByRole("link", { name: "Jalen Brunson" })).toHaveAttribute(
      "href",
      "/players/1",
    );
    expect(screen.getByRole("link", { name: "View all (12)" })).toHaveAttribute(
      "href",
      "/watchlist",
    );
  });

  it("asks only for the homepage's ten players", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    await renderHome();

    expect(getWatchlistPlayers).toHaveBeenCalledWith({ limit: 10 });
  });

  it("shows the empty watchlist state when the user has starred nobody", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    await renderHome();

    expect(screen.getByText(/aren't watching any players yet/)).toBeInTheDocument();
  });

  it("prompts a signed-in user with no active league to create a team", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    await renderHome();

    expect(getLeagueTeams).not.toHaveBeenCalled();
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create your first team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
  });

  it("offers no team builder for an imported active league with no teams", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    getActiveLeague.mockResolvedValue({
      id: "league-1",
      name: "Game of Courts",
      slug: "game-of-courts",
      scoringType: "h2h_categories",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts", "reb", "ast"] },
      provider: "yahoo",
      isImported: true,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    getLeagueTeams.mockResolvedValue([]);

    await renderHome();

    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "create your first team" })).not.toBeInTheDocument();
  });

  it("shows the active league's most recent team", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    getActiveLeague.mockResolvedValue({
      id: "league-1",
      name: "Bench Mob League",
      slug: "bench-mob-league",
      scoringType: "h2h_categories",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts", "reb", "ast"] },
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    getLeagueTeams.mockResolvedValue([
      {
        id: "a",
        name: "Bench Mob",
        slug: "bench-mob",
        createdAt: "2026-07-23T00:00:00.000Z",
        slots: [],
      },
    ]);

    await renderHome();

    expect(getLeagueTeams).toHaveBeenCalledWith({ leagueId: "league-1" });
    expect(screen.getByRole("link", { name: "Bench Mob" })).toHaveAttribute(
      "href",
      "/my-teams/bench-mob",
    );
  });

  it("features the newest team in both the Roster readout and the Your Team panel", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    getActiveLeague.mockResolvedValue({
      id: "league-1",
      name: "Bench Mob League",
      slug: "bench-mob-league",
      scoringType: "h2h_categories",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts", "reb", "ast"] },
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    // teamQueries returns teams oldest first.
    getLeagueTeams.mockResolvedValue([
      {
        id: "a",
        name: "Old Guard",
        slug: "old-guard",
        createdAt: "2026-07-01T00:00:00.000Z",
        slots: [],
      },
      {
        id: "b",
        name: "New Blood",
        slug: "new-blood",
        createdAt: "2026-07-23T00:00:00.000Z",
        slots: [],
      },
    ]);

    await renderHome();

    expect(screen.getByRole("link", { name: "New Blood" })).toHaveAttribute(
      "href",
      "/my-teams/new-blood",
    );
    expect(screen.getAllByText("New Blood")).toHaveLength(2);
    expect(screen.queryByText("Old Guard")).not.toBeInTheDocument();
    expect(screen.getByText("12-team")).toBeInTheDocument();
  });

  it("lists the advisor's trade targets and free agents", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    const advisorPlayer = ({ playerId, fullName }: SummaryProps) => ({
      playerId,
      fullName,
      teamAbbr: "NYK",
      position: "G",
      injuryStatus: null,
      value: 4.2,
      categoryScore: 1,
      focusScores: [],
    });
    getHomeInsights.mockResolvedValue({
      valueById: new Map(),
      methodLabel: "Z-Score",
      advice: {
        weakness: { key: "ast", label: "AST", myTotal: 0, leagueAverage: 1, rank: 12, of: 12 },
        focusLabel: "AST",
        tradeTargets: [
          {
            ...advisorPlayer({ playerId: 3, fullName: "Trae Young" }),
            owner: { kind: "team", teamId: "t", teamName: "Rivals", managerName: null },
          },
        ],
        freeAgents: [
          {
            ...advisorPlayer({ playerId: 4, fullName: "Tyus Jones" }),
            owner: { kind: "free_agent" },
            gainOverDrop: 1,
            isUpgrade: true,
          },
        ],
      },
    });

    await renderHome();

    expect(screen.getByRole("heading", { name: "Top Trade Targets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trae Young" })).toHaveAttribute("href", "/players/3");
    expect(screen.getByText(/Rivals/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Top Free Agents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tyus Jones" })).toHaveAttribute("href", "/players/4");
    expect(screen.getByText("12th of 12 teams")).toBeInTheDocument();
  });

  it("points to the Yahoo import when there is no advice", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    await renderHome();

    expect(screen.getAllByText(/Import your Yahoo league/)).toHaveLength(2);
  });

  it("charts the same players it lists", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    const players = [summary({ playerId: 1, fullName: "Jalen Brunson" })];
    getWatchlistPlayers.mockResolvedValue(players);
    const series = [{ playerId: 1, fullName: "Jalen Brunson", points: [] }];
    getTrendSeries.mockResolvedValue(trends({ series }));

    await renderHome();

    // One read feeds both charts.
    expect(getTrendSeries).toHaveBeenCalledTimes(1);
    // ...valued on the same league settings as the panels.
    expect(getTrendSeries).toHaveBeenCalledWith({
      players,
      settings: expect.objectContaining({ config: expect.any(Object), methodWeights: {} }),
    });
    expect(screen.getByRole("heading", { name: "Z-Score Trend" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "G-Score Trend" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PL Linear Trend" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sim Value Trend" })).toBeInTheDocument();
  });
});
