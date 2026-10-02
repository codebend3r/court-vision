import { cleanup, render, screen, within } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { makeStatLine } from "@/lib/valuation/fixtures";

const findUniquePlayer = vi.fn();
const findManyGameLogs = vi.fn();
const findManySeasonStats = vi.fn();
const findManyAdvancedLogs = vi.fn();

const getUser = vi.fn();
const getProfile = vi.fn();
const getFantasyPool = vi.fn();
const getActiveLeague = vi.fn();

// The fantasy view reads the cached pool and the active league; both wrap
// prisma and `unstable_cache`/`cookies()`, so they are stubbed at the module.
vi.mock("@/lib/valuation/loader", () => ({ getFantasyPool }));
vi.mock("@/lib/leagues/queries", () => ({
  getActiveLeague,
  ensureDefaultLeague: vi.fn(),
  getLeagues: vi.fn(),
  resolveActiveLeague: vi.fn(),
  fallbackActiveLeagueId: vi.fn(),
  toLeagueSummary: vi.fn(),
}));

// The view tabs rebuild hrefs from the live URL, and the filters read it to
// tell an explicit ?mode= from a bare URL; both go through next/navigation,
// so the mock mirrors whatever query renderPage was given.
let currentQuery: Record<string, string> = {};
vi.mock("next/navigation", () => ({
  usePathname: () => "/players/3547238",
  useSearchParams: () => new URLSearchParams(currentQuery),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// The page reads the session to decide whether the star is actionable; without
// this the real getUser() calls `cookies()` outside a request scope. `getProfile`
// is stubbed too because the mock replaces the whole module namespace, and the
// page's graph imports both.
vi.mock("@/lib/auth/session", () => ({ getUser, getProfile }));

// The season pool is read through `unstable_cache`, which needs a Next
// incremental cache that bun:test does not have. A pass-through keeps the
// prisma double below wired to the page.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: { findUnique: findUniquePlayer },
    playerGameLog: { findMany: findManyGameLogs },
    playerSeasonStats: { findMany: findManySeasonStats },
    playerAdvancedGameLog: { findMany: findManyAdvancedLogs },
  },
}));

// Imported after the mocks are installed, not at the top of the file: the page
// pulls in `lib/players/seasonPool`, which calls `unstable_cache` at module
// scope — a static import would run the real one before the mock lands.
const { default: PlayerPage } = await import("@/app/players/[playerId]/page");

const renderPage = async ({
  playerId,
  query = {},
}: {
  playerId: string;
  query?: Record<string, string>;
}) => {
  currentQuery = query;
  return render(
    <ThemeProvider>
      {await PlayerPage({
        params: Promise.resolve({ playerId }),
        searchParams: Promise.resolve(query),
      })}
    </ThemeProvider>,
    { wrapper: withNuqsTestingAdapter({ searchParams: query }) },
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  findManySeasonStats.mockResolvedValue([]);
  findManyAdvancedLogs.mockResolvedValue([]);
  getFantasyPool.mockResolvedValue([]);
  getActiveLeague.mockResolvedValue(null);
  getProfile.mockResolvedValue(null);
});

const buildAdvancedLog = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "adv-1",
  playerId: 3547238,
  gameId: "0022500001",
  gameDate: new Date("2025-10-22T00:00:00Z"),
  season: "2025-26",
  seasonType: "Regular Season",
  teamId: 1610612744,
  teamAbbr: "GSW",
  pie: 0.15,
  pace: 100.4,
  assistPercentage: 0.3,
  assistRatio: 20,
  assistToTurnover: 2,
  defensiveRating: 110,
  defensiveReboundPercentage: 0.2,
  effectiveFieldGoalPercentage: 0.55,
  netRating: 5,
  offensiveRating: 115,
  offensiveReboundPercentage: 0.02,
  reboundPercentage: 0.11,
  trueShootingPercentage: 0.6,
  turnoverRatio: 12,
  usagePercentage: 0.3,
  ...overrides,
});

// A pool spread out in every category, with the page's player on top.
const buildPool = () => [
  makeStatLine({
    playerId: 3547238,
    fullName: "CJ Rivas",
    firstName: "CJ",
    lastName: "Rivas",
    pts: 1500,
    reb: 450,
    ast: 450,
    stl: 80,
    blk: 30,
    fg3m: 200,
    tov: 100,
    fgm: 500,
    fga: 1000,
    ftm: 440,
    fta: 500,
  }),
  ...Array.from({ length: 20 }, (_, index) =>
    makeStatLine({
      playerId: index + 100,
      pts: 300 + index * 30,
      reb: 150 + index * 10,
      ast: 100 + index * 8,
      stl: 30 + index * 3,
      blk: 15 + index * 2,
      fg3m: 40 + index * 5,
      tov: 60 + index * 4,
      fgm: 150 + index * 12,
      fga: 350 + index * 20,
      ftm: 80 + index * 6,
      fta: 100 + index * 7,
    }),
  ),
];

afterEach(cleanup);

const buildLog = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "log-1",
  playerId: 3547238,
  gameId: "0022500001",
  gameDate: new Date("2025-10-22T00:00:00Z"),
  season: "2025-26",
  seasonType: "Regular Season",
  teamId: 1610612744,
  teamAbbr: "GSW",
  matchup: "GSW vs. LAL",
  opponentAbbr: "LAL",
  homeAway: "home",
  winLoss: "W",
  teamScore: 121,
  opponentScore: 110,
  minutes: 34,
  fgm: 10,
  fga: 20,
  fg3m: 5,
  fg3a: 11,
  ftm: 4,
  fta: 4,
  oreb: 1,
  dreb: 4,
  reb: 5,
  ast: 8,
  stl: 2,
  blk: 0,
  tov: 3,
  pts: 29,
  plusMinus: 12,
  ...overrides,
});

const buildSeasonRow = ({
  playerId,
  pts = 1000,
  season = "2025-26",
}: {
  playerId: number;
  pts?: number;
  season?: string;
}) => ({
  id: `season-${playerId}-${season}`,
  playerId,
  season,
  seasonType: "Regular Season",
  gamesPlayed: 50,
  minutes: 1500,
  fgm: 400,
  fga: 800,
  fg3m: 100,
  fg3a: 250,
  ftm: 150,
  fta: 200,
  oreb: 50,
  dreb: 200,
  reb: 250,
  ast: 300,
  stl: 60,
  blk: 40,
  tov: 110,
  pts,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
});

const player = {
  id: 3547238,
  firstName: "CJ",
  lastName: "Rivas",
  fullName: "CJ Rivas",
  teamId: 1610612744,
  teamAbbr: "GSW",
  position: "G",
  jerseyNumber: "0",
  nbaPersonId: null,
  heightInches: null,
  weightLbs: null,
  birthDate: null,
  college: null,
  country: null,
  draftYear: null,
  draftRound: null,
  draftNumber: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

describe("PlayerPage", () => {
  it("renders the player name and chart chips for a known id with logs", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([
      buildLog({ id: "log-1" }),
      buildLog({ id: "log-2", gameId: "0022500002" }),
    ]);

    await renderPage({ playerId: "3547238" });

    expect(screen.getByText("CJ Rivas")).toBeInTheDocument();
    // Header chip plus one per matchup cell
    expect(screen.getAllByTitle("Golden State Warriors")).toHaveLength(3);
    expect(screen.getAllByTitle("Los Angeles Lakers")).toHaveLength(2);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    const fallback = screen.getByRole("img", { name: "CJ Rivas" });
    expect(fallback.tagName).not.toBe("IMG");
  });

  it("counts only games played (not DNPs) in the header", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([
      buildLog({ id: "log-1" }),
      buildLog({ id: "log-2", gameId: "0022500002" }),
      // A DNP: on the roster but did not play.
      buildLog({ id: "dnp", gameId: "0022500003", minutes: 0, pts: 0 }),
    ]);

    await renderPage({ playerId: "3547238" });

    // Three logs, two appearances.
    expect(screen.getByText("2025-26 · 2 games", { exact: false })).toBeInTheDocument();
  });

  it("shows the season averages card with NBA ranks", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);
    findManySeasonStats.mockResolvedValue([
      buildSeasonRow({ playerId: 3547238 }),
      buildSeasonRow({ playerId: 2, pts: 1500 }),
    ]);

    await renderPage({ playerId: "3547238" });

    expect(screen.getByText("Season averages")).toBeInTheDocument();
    // 1000 points over 50 games
    expect(screen.getByText("20.0")).toBeInTheDocument();
    // one qualified player scores more
    expect(screen.getByText("2nd in NBA")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
  });

  it("omits the season averages card when the player has no season stats", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238" });

    expect(screen.queryByText("Season averages")).not.toBeInTheDocument();
  });

  it("renders profile facts and jersey number when metadata is present", async () => {
    findUniquePlayer.mockResolvedValue({
      ...player,
      heightInches: 79,
      weightLbs: 220,
      college: "Duke",
      country: "USA",
      draftYear: 2020,
      draftRound: 1,
      draftNumber: 5,
    });
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238" });

    expect(screen.getByText("#0")).toBeInTheDocument();
    expect(screen.getByText(`6'7"`)).toBeInTheDocument();
    expect(screen.getByText("220 lb")).toBeInTheDocument();
    expect(screen.getByText("Duke")).toBeInTheDocument();
    expect(screen.getByText("USA")).toBeInTheDocument();
    expect(screen.getByText("2020 · Rd 1 · Pick 5")).toBeInTheDocument();
    // drafted 2020, so 2025-26 is their 6th season
    expect(screen.getByText("6 seasons")).toBeInTheDocument();
    // birthDate is null, so the Born fact is omitted entirely
    expect(screen.queryByText("Born")).not.toBeInTheDocument();
  });

  it("omits the facts list when no metadata is present", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238" });

    expect(screen.queryByText("Height")).not.toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
  });

  it("renders the NBA CDN headshot in the header when the player has an nbaPersonId", async () => {
    findUniquePlayer.mockResolvedValue({ ...player, nbaPersonId: 1630162 });
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238" });

    const photo = screen.getByRole("img", { name: "CJ Rivas" });
    const src = decodeURIComponent(photo.getAttribute("src") ?? "");
    expect(src).toContain("/headshots/nba/latest/1040x760/1630162.png");
  });

  it("rejects for an unknown id", async () => {
    findUniquePlayer.mockResolvedValue(null);
    findManyGameLogs.mockResolvedValue([]);

    await expect(
      PlayerPage({
        params: Promise.resolve({ playerId: "999999" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow();
  });

  it("rejects for a non-numeric id without querying the database", async () => {
    findUniquePlayer.mockResolvedValue(null);
    findManyGameLogs.mockResolvedValue([]);

    await expect(
      PlayerPage({
        params: Promise.resolve({ playerId: "not-a-number" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow();

    expect(findUniquePlayer).not.toHaveBeenCalled();
  });

  it.each([["12abc"], ["99999999999"], ["0"], ["-5"]])(
    "rejects id %s without querying the database",
    async (playerId) => {
      findUniquePlayer.mockResolvedValue(null);
      findManyGameLogs.mockResolvedValue([]);

      await expect(
        PlayerPage({
          params: Promise.resolve({ playerId }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow();

      expect(findUniquePlayer).not.toHaveBeenCalled();
    },
  );

  it("shows the empty state and no chips when the player has zero logs", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([]);

    render(
      await PlayerPage({
        params: Promise.resolve({ playerId: "3547238" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("No game logs for this player yet.")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders the season dropdown with each played season plus Career, defaulting to latest", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "a" })]);
    findManySeasonStats.mockResolvedValue([
      buildSeasonRow({ playerId: 3547238, season: "2025-26" }),
      buildSeasonRow({ playerId: 3547238, season: "2024-25" }),
    ]);

    await renderPage({ playerId: "3547238" });

    expect(screen.getByRole("option", { name: "2025-26" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2024-25" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Career" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("2025-26");
  });

  it("filters the logs to the player's latest season by default", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManySeasonStats.mockResolvedValue([
      buildSeasonRow({ playerId: 3547238, season: "2023-24" }),
    ]);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1", season: "2023-24" })]);

    await renderPage({ playerId: "3547238" });

    expect(findManyGameLogs).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: 3547238, season: "2023-24" } }),
    );
    expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("2023-24");
  });

  it("honors an explicit season param even if the player never played it", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManySeasonStats.mockResolvedValue([buildSeasonRow({ playerId: 3547238 })]);
    findManyGameLogs.mockResolvedValue([]);

    await renderPage({ playerId: "3547238", query: { season: "2021-22" } });

    expect(findManyGameLogs).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: 3547238, season: "2021-22" } }),
    );
    expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("2021-22");
    expect(screen.getByText("No game logs for this season yet.")).toBeInTheDocument();
  });

  it("aggregates a rank-less career card spanning the played seasons", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManySeasonStats.mockResolvedValue([
      buildSeasonRow({ playerId: 3547238, season: "2025-26" }),
      buildSeasonRow({ playerId: 3547238, season: "2024-25" }),
    ]);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238", query: { season: "career" } });

    // Career fetches every log: no season in the where clause.
    expect(findManyGameLogs).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: 3547238 } }),
    );
    expect(screen.getByText("Career averages")).toBeInTheDocument();
    expect(screen.getByText("2024-25 to 2025-26")).toBeInTheDocument();
    // 2000 points over 100 games, still 20.0, and no leaderboard pills.
    expect(screen.getByText("20.0")).toBeInTheDocument();
    expect(screen.queryByText(/in NBA/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("career");
  });

  it("renders the stat filters alongside the chart", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238" });

    expect(screen.getByRole("group", { name: "Stat mode" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Timeframe" })).toBeInTheDocument();
  });

  it("titles the counting panel from the mode param", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238", query: { mode: "totals" } });

    expect(screen.getByText("Accumulating totals")).toBeInTheDocument();
  });

  it("windows the series to the span param and keeps total games in the header", async () => {
    const logs = [...Array(15).keys()].map((index) =>
      buildLog({
        id: `log-${index + 1}`,
        gameId: `002250000${index + 1}`,
        gameDate: new Date(Date.UTC(2025, 9, 22 + index)),
      }),
    );
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue(logs);

    const { container } = await renderPage({ playerId: "3547238", query: { span: "10" } });

    // The x-axis restarts inside the window: highest game index is 10, not 15
    expect(screen.getByText("2025-26 · 15 games", { exact: false })).toBeInTheDocument();
    // A monotone line through N points draws N-1 curve segments, so the
    // windowed series must produce 9 "C" commands per line, not 14.
    const firstLinePath = container.querySelector(".recharts-line-curve");
    const curveSegments = (firstLinePath?.getAttribute("d") ?? "").match(/C/g) ?? [];
    expect(curveSegments).toHaveLength(9);
  });

  it("switches between the three views with a tab strip and keeps the game log last", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    const { container } = await renderPage({ playerId: "3547238" });

    const nav = screen.getByRole("navigation", { name: "Player stat views" });
    expect(within(nav).getByRole("link", { name: /Regular Stats/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "href",
      "/players/3547238?view=advanced",
    );
    // The game log is the last block on the page, folded behind a summary.
    const last = container.querySelector("main")?.lastElementChild;
    expect(last?.tagName).toBe("DETAILS");
    expect(last?.querySelector("h2")).toHaveTextContent("Game log");
  });

  it("renders the advanced view: window averages, scale panels, two modes, and the legend", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([
      buildLog({ id: "log-1" }),
      buildLog({ id: "log-2", gameId: "0022500002" }),
    ]);
    findManyAdvancedLogs.mockResolvedValue([
      buildAdvancedLog({ id: "adv-1", gameId: "0022500001", trueShootingPercentage: 0.5 }),
      buildAdvancedLog({ id: "adv-2", gameId: "0022500002", trueShootingPercentage: 0.7 }),
    ]);

    const { container } = await renderPage({
      playerId: "3547238",
      query: { view: "advanced", mode: "totals" },
    });

    expect(findManyAdvancedLogs).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: 3547238, season: "2025-26" } }),
    );
    // TS% averages the two games; PIE and pace read as a share and a rating.
    // Read inside the card: the game log prints each game's PIE and pace too.
    const card = screen.getByRole("region", { name: "Advanced averages" });
    expect(within(card).getByText("60.0%")).toBeInTheDocument();
    expect(within(card).getByText("15.0%")).toBeInTheDocument();
    expect(within(card).getByText("100.4")).toBeInTheDocument();
    expect(screen.queryByText("Season averages")).not.toBeInTheDocument();
    expect(screen.getByText("Shooting efficiency")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(15);
    // totals cannot be plotted for rates, so the view reads as its running average.
    const modeGroup = screen.getByRole("group", { name: "Stat mode" });
    expect(
      within(modeGroup)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Game", "Avg"]);
    expect(screen.getByRole("button", { name: "Avg" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Running averages")).toBeInTheDocument();
    expect(screen.getByText("What do these stats mean?")).toBeInTheDocument();
    expect(container.querySelector("main")?.lastElementChild?.tagName).toBe("DETAILS");
  });

  it("renders the fantasy view: method readouts with ranks, both charts, no modes, and the legend", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);
    findManySeasonStats.mockResolvedValue([buildSeasonRow({ playerId: 3547238 })]);
    getFantasyPool.mockResolvedValue(buildPool());

    const { container } = await renderPage({
      playerId: "3547238",
      query: { view: "fantasy", span: "10" },
    });

    // The pool is the one the Fantasy tab would load for this window and season.
    expect(getFantasyPool).toHaveBeenCalledWith({ range: "last10", season: "2025-26" });
    // The card names every registry method; Z-Score also appears in the chart
    // legend and as a line label, so the readout is read inside the card.
    const card = screen.getByRole("region", { name: "Fantasy value" });
    expect(within(card).getByText("Z-Score")).toBeInTheDocument();
    expect(within(card).getByText("Sim Value")).toBeInTheDocument();
    expect(within(card).getAllByText("1st in NBA").length).toBeGreaterThan(0);
    expect(within(card).getAllByText("1st in NBA")[0]).toHaveAttribute(
      "title",
      "1st of 21 valued players",
    );
    expect(screen.getByText("Category breakdown")).toBeInTheDocument();
    expect(screen.getByText("Rolling value")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(2);
    expect(screen.queryByRole("group", { name: "Stat mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Timeframe" })).toBeInTheDocument();
    expect(screen.getByText("How is value calculated?")).toBeInTheDocument();
    expect(container.querySelector("main")?.lastElementChild?.tagName).toBe("DETAILS");
  });

  it("seeds the fantasy view from the active league like the Fantasy tab", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);
    getFantasyPool.mockResolvedValue(buildPool());
    getActiveLeague.mockResolvedValue({
      id: "league-1",
      name: "Test league",
      slug: "test-league",
      scoringType: "h2h_categories",
      teamCount: 10,
      rosterSlots: 15,
      scoringConfig: { categories: ["pts", "reb", "ast"] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const { container } = await renderPage({ playerId: "3547238", query: { view: "fantasy" } });

    // Only the league's three categories are broken down: three groups of two bars.
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(6);
  });

  it("explains that career has no fantasy pool", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238", query: { view: "fantasy", season: "career" } });

    expect(getFantasyPool).not.toHaveBeenCalled();
    expect(screen.getByText(/single season/)).toBeInTheDocument();
    expect(screen.queryByText("Fantasy value")).not.toBeInTheDocument();
  });

  it("explains when the player has no line in the window's pool", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);
    getFantasyPool.mockResolvedValue(buildPool().slice(1));

    await renderPage({ playerId: "3547238", query: { view: "fantasy" } });

    expect(screen.getByText(/no appearances/)).toBeInTheDocument();
    expect(screen.queryByText("Category breakdown")).not.toBeInTheDocument();
  });

  const gameLogColumns = (container: HTMLElement): string[] => {
    const log = container.querySelector("main")?.lastElementChild;
    if (!(log instanceof HTMLElement)) throw new Error("no game log");
    return within(log)
      .getAllByRole("columnheader")
      .map((header) => header.textContent?.replace(/[↑↓↕]/g, "").trim() ?? "");
  };

  it("shows the box score in the game log on the regular view", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    const { container } = await renderPage({ playerId: "3547238" });

    expect(gameLogColumns(container)).toContain("FGM");
  });

  it("shows each game's advanced metrics in the game log on the advanced view", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);
    findManyAdvancedLogs.mockResolvedValue([
      buildAdvancedLog({ gameId: "0022500001", netRating: 7.5 }),
    ]);

    const { container } = await renderPage({
      playerId: "3547238",
      query: { view: "advanced", adv: "netRating" },
    });

    const columns = gameLogColumns(container);
    expect(columns).toContain("Net Rtg");
    expect(columns).not.toContain("FGM");
    const log = container.querySelector("main")?.lastElementChild;
    expect(log).toHaveTextContent("7.5");
  });

  it("shows each game's fantasy value in the game log on the fantasy view", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);
    getFantasyPool.mockResolvedValue(buildPool());

    const { container } = await renderPage({ playerId: "3547238", query: { view: "fantasy" } });

    const columns = gameLogColumns(container);
    expect(columns).toContain("Roll Z");
    expect(columns).toContain("PTS Z");
    expect(columns).not.toContain("FGM");
  });

  it("keeps the box score in the game log when the fantasy view has nothing to value", async () => {
    findUniquePlayer.mockResolvedValue(player);
    findManyGameLogs.mockResolvedValue([buildLog({ id: "log-1" })]);

    const { container } = await renderPage({
      playerId: "3547238",
      query: { view: "fantasy", season: "career" },
    });

    expect(gameLogColumns(container)).toContain("FGM");
  });
});
