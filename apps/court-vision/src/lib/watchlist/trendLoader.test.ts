import { beforeEach, describe, expect, it, vi } from "bun:test";

import { buildLeagueAverageLines, DEFAULT_VALUATION_CONFIG } from "@vision/sport-basketball/engine";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { toWindowLog } from "@/lib/valuation/trendLogs";

const findMany = vi.fn();
const latestSeason = vi.fn();
const getFantasyPool = vi.fn();
const getLeagueAverageLines = vi.fn();
// Outside Next there is no incremental cache; the wrapper passes the fetch
// through and records how it was registered.
const unstableCache = vi.fn(
  (fetch: (...args: unknown[]) => unknown, _keyParts: string[], _options: unknown) => fetch,
);

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));
vi.mock("@/lib/prisma", () => ({ prisma: { playerGameLog: { findMany } } }));
vi.mock("@/lib/valuation/season", () => ({ latestSeason }));
vi.mock("@/lib/valuation/loader", () => ({ getFantasyPool }));
vi.mock("@/lib/valuation/leagueAverage", () => ({ getLeagueAverageLines }));

// Loaded after the mocks: the cache wrapper is built when the module
// evaluates, so a static import would capture the real `unstable_cache`.
const { getTrendSeries } = await import("@/lib/watchlist/trendLoader");

type LogProps = { day: number; pts: number };

const log = ({ day, pts }: LogProps) => ({
  gameDate: new Date(Date.UTC(2026, 0, day)),
  minutes: 30,
  pts,
  reb: 5,
  ast: 4,
  stl: 1,
  blk: 1,
  fg3m: 2,
  tov: 2,
  fgm: 8,
  fga: 16,
  ftm: 2,
  fta: 3,
});

const pool = [
  makeStatLine({ playerId: 1, pts: 1500, gamesPlayed: 70, minutes: 2400 }),
  makeStatLine({ playerId: 2, pts: 900, gamesPlayed: 70, minutes: 2100 }),
  makeStatLine({ playerId: 3, pts: 600, gamesPlayed: 60, minutes: 1500 }),
];

const brunson = { playerId: 1, fullName: "Jalen Brunson" };

beforeEach(() => {
  getLeagueAverageLines.mockReset();
  getLeagueAverageLines.mockResolvedValue([]);
  findMany.mockReset();
  latestSeason.mockReset();
  getFantasyPool.mockReset();
  latestSeason.mockResolvedValue("2025-26");
  getFantasyPool.mockResolvedValue(pool);
  findMany.mockResolvedValue(
    Array.from({ length: 12 }, (_, index) => log({ day: index + 1, pts: 20 + index })),
  );
});

const brunsonG = { ...brunson, position: "G" };

// The neutral league read; the page passes leagueValuationSettings' result.
const SETTINGS = { config: DEFAULT_VALUATION_CONFIG, methodWeights: {} };
const charted = [brunsonG, { playerId: 2, fullName: "Josh Hart", position: "F" }];

describe("getTrendSeries", () => {
  it("reads each player's logs once and scores every method from them", async () => {
    const { series } = await getTrendSeries({ players: charted, settings: SETTINGS });

    expect(findMany).toHaveBeenCalledTimes(charted.length);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerId: 1, season: "2025-26", seasonType: "Regular Season" },
        orderBy: { gameDate: "asc" },
      }),
    );
    expect(Object.keys(series).toSorted()).toEqual(
      ["g", "points", "positional", "sgp", "sim", "vorp", "z"].toSorted(),
    );
    expect(series.z.map((entry) => entry.playerId)).toEqual([1, 2]);
    expect(series.sgp.map((entry) => entry.fullName)).toEqual(["Jalen Brunson", "Josh Hart"]);
    // The window grows from the first game, so all twelve games get a point.
    expect(series.z[0]?.points.length ?? 0).toBe(12);
    expect(series.sim[0]?.points.length ?? 0).toBe(12);
  });

  it("scores the methods differently from the same logs, on the same dates", async () => {
    const { series } = await getTrendSeries({ players: [brunsonG], settings: SETTINGS });

    const values = (key: "z" | "g" | "points") =>
      series[key][0]?.points.map((point) => point.value) ?? [];
    expect(values("z")).not.toEqual(values("g"));
    expect(values("points")).not.toEqual(values("z"));
    expect(series.z[0]?.points.map((point) => point.date) ?? []).toEqual(
      series.points[0]?.points.map((point) => point.date) ?? [],
    );
  });

  it("scores the league average per game date on every method, so it moves", async () => {
    // A league of one rising scorer: its average climbs day by day.
    const logs = Array.from({ length: 12 }, (_, index) => {
      const { gameDate, ...row } = log({ day: index + 1, pts: 10 + index * 3 });
      return { ...toWindowLog({ row }), gameDate };
    });
    getLeagueAverageLines.mockResolvedValue(
      buildLeagueAverageLines({ players: [{ playerId: 9, logs }] }),
    );

    const { averages } = await getTrendSeries({ players: [brunsonG], settings: SETTINGS });

    expect(getLeagueAverageLines).toHaveBeenCalledWith({ season: "2025-26" });
    expect(averages.points).toHaveLength(12);
    expect(averages.sgp).toHaveLength(12);
    const points = averages.points.map((point) => point.value);
    expect(points.at(-1) ?? 0).toBeGreaterThan(points[0] ?? 0);
  });

  it("answers empty series without reading logs before any season is synced", async () => {
    latestSeason.mockResolvedValue(null);

    const { series } = await getTrendSeries({ players: [brunsonG], settings: SETTINGS });
    expect(series.z).toEqual([{ ...brunson, points: [] }]);
    expect(series.sim).toEqual([{ ...brunson, points: [] }]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("caches per player under the players tag so a sync busts it with every other surface", () => {
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["watchlist:trends:methods"],
      expect.objectContaining({ tags: ["players"], revalidate: 300 }),
    );
  });
});
