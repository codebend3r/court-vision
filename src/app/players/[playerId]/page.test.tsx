import { cleanup, render, screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import PlayerPage from "@/app/players/[playerId]/page";

const renderPage = async ({
  playerId,
  query = {},
}: {
  playerId: string;
  query?: Record<string, string>;
}) =>
  render(
    <ThemeProvider>
      {await PlayerPage({
        params: Promise.resolve({ playerId }),
        searchParams: Promise.resolve(query),
      })}
    </ThemeProvider>,
    { wrapper: withNuqsTestingAdapter({ searchParams: query }) },
  );

const findUniquePlayer = vi.fn();
const findManyGameLogs = vi.fn();
const findManySeasonStats = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: { findUnique: findUniquePlayer },
    playerGameLog: { findMany: findManyGameLogs },
    playerSeasonStats: { findMany: findManySeasonStats },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  findManySeasonStats.mockResolvedValue([]);
});

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
});
