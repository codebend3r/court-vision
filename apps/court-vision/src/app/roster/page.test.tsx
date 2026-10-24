import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type FantasyValueViewProps } from "@/components/FantasyValueView/FantasyValueView";
import { type MyTeamPickerProps } from "@/components/MyTeamPicker/MyTeamPicker";
import { type RosterStatChartsProps } from "@/components/RosterStatCharts/RosterStatCharts";
import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";
import { type LeagueSummary } from "@/lib/leagues/types";
import { type PlayerPoolRow } from "@/lib/players/search";
import { type AdvancedPlayerRow } from "@/lib/players/searchAdvanced";
import { makeStatLine } from "@/lib/valuation/fixtures";

const getProfile = vi.fn();
const getActiveLeague = vi.fn();
const getLeagueTeams = vi.fn();
const getRegularPool = vi.fn();
const getAdvancedPool = vi.fn();
const getFantasyPool = vi.fn();
const chartsProps = vi.fn();
const fantasyProps = vi.fn();
const pickerProps = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeague: () => getActiveLeague() }));
vi.mock("@/lib/leagues/teamQueries", () => ({
  getLeagueTeams: (args: { leagueId: string }) => getLeagueTeams(args),
}));
vi.mock("@/lib/players/searchCached", () => ({
  getRegularPool: (args: { range: string }) => getRegularPool(args),
  getAdvancedPool: (args: { range: string }) => getAdvancedPool(args),
}));
vi.mock("@/lib/valuation/loader", () => ({
  getFantasyPool: (args: { range: string }) => getFantasyPool(args),
}));
vi.mock("@/components/RosterStatCharts/RosterStatCharts", () => ({
  RosterStatCharts: (props: RosterStatChartsProps) => {
    chartsProps(props);
    return <p>roster charts</p>;
  },
}));
vi.mock("@/components/FantasyValueView/FantasyValueView", () => ({
  FantasyValueView: (props: FantasyValueViewProps) => {
    fantasyProps(props);
    return <p>fantasy value view</p>;
  },
}));
vi.mock("@/components/MyTeamPicker/MyTeamPicker", () => ({
  MyTeamPicker: (props: MyTeamPickerProps) => {
    pickerProps(props);
    return <p>my team picker</p>;
  },
}));

import RosterPage from "@/app/roster/page";

// Next's redirect() throws an error whose digest encodes the destination, so
// reading it is how a test observes where a server component sent the visitor.
const redirectTarget = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string"
    ? error.digest
    : "";

const league = (overrides: Partial<LeagueSummary> = {}): LeagueSummary => ({
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
  externalUrl: null,
  myTeamId: "team-5",
  syncedAt: null,
  syncError: null,
  unsupportedCategories: [],
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  ...overrides,
});

const player = ({ playerId, name }: { playerId: number; name: string }): FantasyTeamPlayer => ({
  playerId,
  firstName: "A",
  lastName: name,
  fullName: `A ${name}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
});

const myTeam: FantasyTeam = {
  id: "team-5",
  name: "Konjugal Visits",
  slug: "konjugal-visits",
  createdAt: "2026-10-16T00:00:00.000Z",
  logoUrl: null,
  managerName: null,
  isMine: true,
  isImported: true,
  unmatchedBySlotId: { "SG-1": "Jalen Smith" },
  slots: [
    { id: "PG-1", type: "PG", player: player({ playerId: 1, name: "Brunson" }) },
    { id: "SG-1", type: "SG", player: null },
    { id: "G-1", type: "G", player: player({ playerId: 2, name: "Hart" }) },
    { id: "IL-1", type: "IL", player: player({ playerId: 3, name: "Sheppard" }) },
  ],
};

const otherTeam: FantasyTeam = {
  ...myTeam,
  id: "team-6",
  name: "Dream Shake",
  isMine: false,
  unmatchedBySlotId: {},
  slots: [{ id: "PG-1", type: "PG", player: player({ playerId: 9, name: "Rival" }) }],
};

const poolRow = ({ id, name, pts }: { id: number; name: string; pts: number }): PlayerPoolRow => ({
  id,
  firstName: "A",
  lastName: name,
  fullName: `A ${name}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  stats: {
    gamesPlayed: 10,
    min: 300,
    fgm: 50,
    fga: 100,
    fg3m: 20,
    fg3a: 50,
    ftm: 30,
    fta: 40,
    reb: 40,
    ast: 50,
    stl: 10,
    blk: 5,
    tov: 20,
    pts,
  },
});

// Sheppard (3) is on injured reserve with no games, so the pool has no row.
const regularPool = [
  poolRow({ id: 1, name: "Brunson", pts: 285 }),
  poolRow({ id: 2, name: "Hart", pts: 90 }),
  poolRow({ id: 9, name: "Rival", pts: 200 }),
];

const advancedRow = ({ id, name }: { id: number; name: string }): AdvancedPlayerRow => ({
  id,
  firstName: "A",
  lastName: name,
  fullName: `A ${name}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  stats: {
    gamesWithData: 10,
    pie: 0.15,
    pace: 99,
    assistPercentage: 0.2,
    assistRatio: 15,
    assistToTurnover: 2,
    defensiveRating: 110,
    defensiveReboundPercentage: 0.15,
    effectiveFieldGoalPercentage: 0.55,
    netRating: 3,
    offensiveRating: 115,
    offensiveReboundPercentage: 0.05,
    reboundPercentage: 0.1,
    trueShootingPercentage: 0.6,
    turnoverRatio: 12,
    usagePercentage: 0.22,
  },
});

const renderPage = async ({ raw = {} }: { raw?: Record<string, string> } = {}) =>
  render(await RosterPage({ searchParams: Promise.resolve(raw) }));

const lastChartsProps = (): RosterStatChartsProps => {
  const props: RosterStatChartsProps | undefined = chartsProps.mock.calls.at(-1)?.[0];
  if (props === undefined) throw new Error("charts never rendered");
  return props;
};

beforeEach(() => {
  getProfile.mockReset().mockResolvedValue({ id: "profile-1", preferredFormula: null });
  getActiveLeague.mockReset().mockResolvedValue(league());
  getLeagueTeams.mockReset().mockResolvedValue([otherTeam, myTeam]);
  getRegularPool.mockReset().mockResolvedValue(regularPool);
  getAdvancedPool
    .mockReset()
    .mockResolvedValue([
      advancedRow({ id: 1, name: "Brunson" }),
      advancedRow({ id: 2, name: "Hart" }),
    ]);
  getFantasyPool.mockReset().mockResolvedValue([makeStatLine({ playerId: 1 })]);
  chartsProps.mockReset();
  fantasyProps.mockReset();
  pickerProps.mockReset();
});

afterEach(cleanup);

describe("RosterPage", () => {
  it("sends a signed-out visitor to the login form", async () => {
    getProfile.mockResolvedValue(null);
    const thrown = await RosterPage({ searchParams: Promise.resolve({}) }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(redirectTarget(thrown)).toContain("/login?next=/roster");
  });

  it("points a visitor with no league at the import, loading nothing", async () => {
    getActiveLeague.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Roster" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import from Yahoo" })).toHaveAttribute(
      "href",
      "/leagues/import",
    );
    expect(getLeagueTeams).not.toHaveBeenCalled();
    expect(getRegularPool).not.toHaveBeenCalled();
  });

  it("asks an imported league with no team of yours which team is yours", async () => {
    getActiveLeague.mockResolvedValue(league({ myTeamId: null }));
    await renderPage();
    expect(screen.getByText("my team picker")).toBeInTheDocument();
    expect(pickerProps).toHaveBeenCalledWith({ leagueId: "league-1", teams: [otherTeam, myTeam] });
    expect(getRegularPool).not.toHaveBeenCalled();
  });

  it("points a hand-built league with no team at building one", async () => {
    getActiveLeague.mockResolvedValue(league({ provider: "manual", isImported: false }));
    getLeagueTeams.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByRole("link", { name: "New team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
  });

  it("names the team and the league", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 2, name: "Konjugal Visits" })).toBeInTheDocument();
    expect(screen.getByText("Game of Courts · 3 players")).toBeInTheDocument();
  });

  it("offers the three stat views as tabs, the regular one current", async () => {
    await renderPage();
    const tabs = within(screen.getByRole("navigation", { name: "Roster stat views" }));
    expect(tabs.getByRole("link", { name: /Regular Stats/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(tabs.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "href",
      "/roster?tab=advanced",
    );
    expect(tabs.getByRole("link", { name: /Fantasy Value/ })).toHaveAttribute(
      "href",
      "/roster?tab=fantasy",
    );
  });

  describe("regular stats", () => {
    it("tables the team's own players only, in slot order, with their stats", async () => {
      await renderPage();
      const table = screen.getByRole("table", { name: "Regular stats" });
      const [, first, second, ...rest] = within(table).getAllByRole("row");
      if (first === undefined || second === undefined) throw new Error("rows missing");
      expect(rest).toHaveLength(0);
      expect(within(first).getByText("PG")).toBeInTheDocument();
      expect(within(first).getByText("A Brunson")).toBeInTheDocument();
      expect(within(first).getByText("28.5")).toBeInTheDocument();
      expect(within(second).getByText("A Hart")).toBeInTheDocument();
      expect(screen.queryByText("A Rival")).not.toBeInTheDocument();
    });

    it("charts each stat, ranking the roster best first", async () => {
      await renderPage();
      const points = lastChartsProps().charts.find((chart) => chart.key === "pts");
      expect(points?.bars.map((bar) => bar.name)).toEqual(["Brunson", "Hart"]);
    });

    it("says who is missing and who couldn't be matched", async () => {
      await renderPage();
      expect(screen.getByText(/A Sheppard/)).toBeInTheDocument();
      expect(screen.getByText(/Jalen Smith/)).toBeInTheDocument();
    });

    it("reads the range and basis from the URL", async () => {
      await renderPage({ raw: { range: "last10", mode: "total" } });
      expect(getRegularPool).toHaveBeenCalledWith({ range: "last10" });
      expect(within(screen.getByRole("table")).getByText("285")).toBeInTheDocument();
    });

    it("says so when no one has played", async () => {
      getRegularPool.mockResolvedValue([]);
      await renderPage();
      expect(screen.getByText(/None of your players has a game/)).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("advanced stats", () => {
    it("reads the advanced pool, with the legend", async () => {
      await renderPage({ raw: { tab: "advanced", range: "last5" } });
      expect(getAdvancedPool).toHaveBeenCalledWith({ range: "last5" });
      expect(getRegularPool).not.toHaveBeenCalled();
      expect(screen.getByRole("table", { name: "Advanced stats" })).toBeInTheDocument();
      expect(screen.getByText("What do these stats mean?")).toBeInTheDocument();
    });

    it("charts every advanced metric", async () => {
      await renderPage({ raw: { tab: "advanced" } });
      expect(lastChartsProps().charts).toHaveLength(15);
    });

    it("offers no per game or totals switch", async () => {
      await renderPage({ raw: { tab: "advanced" } });
      expect(screen.queryByRole("navigation", { name: "Stat basis" })).not.toBeInTheDocument();
    });
  });

  describe("fantasy value", () => {
    it("lists the roster's players from the whole pool", async () => {
      await renderPage({ raw: { tab: "fantasy", range: "last20" } });
      expect(getFantasyPool).toHaveBeenCalledWith({ range: "last20" });
      const props: FantasyValueViewProps | undefined = fantasyProps.mock.calls.at(-1)?.[0];
      expect(props?.rosterPlayerIds).toEqual([1, 2, 3]);
      expect(props?.isSignedIn).toBe(true);
    });

    it("leaves the stat pools alone", async () => {
      await renderPage({ raw: { tab: "fantasy" } });
      expect(getRegularPool).not.toHaveBeenCalled();
      expect(getAdvancedPool).not.toHaveBeenCalled();
    });
  });
});
