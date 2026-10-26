import { beforeEach, describe, expect, it, vi } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";

const findMany = vi.fn();
const latestSeason = vi.fn();
const getFantasyPool = vi.fn();
// Outside Next there is no incremental cache; the wrapper passes the fetch
// through and records how it was registered.
const unstableCache = vi.fn(
  (fetch: (...args: unknown[]) => unknown, _keyParts: string[], _options: unknown) => fetch,
);

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));
vi.mock("@/lib/prisma", () => ({ prisma: { playerGameLog: { findMany } } }));
vi.mock("@/lib/valuation/season", () => ({ latestSeason }));
vi.mock("@/lib/valuation/loader", () => ({ getFantasyPool }));

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
const players = [brunson, { playerId: 2, fullName: "Josh Hart" }];

beforeEach(() => {
  findMany.mockReset();
  latestSeason.mockReset();
  getFantasyPool.mockReset();
  latestSeason.mockResolvedValue("2025-26");
  getFantasyPool.mockResolvedValue(pool);
  findMany.mockResolvedValue(
    Array.from({ length: 12 }, (_, index) => log({ day: index + 1, pts: 20 + index })),
  );
});

describe("getTrendSeries", () => {
  it("reads each player's season and logs once to score both trends", async () => {
    const { z, g } = await getTrendSeries({ players });

    expect(latestSeason).toHaveBeenCalledTimes(players.length);
    expect(getFantasyPool).toHaveBeenCalledTimes(players.length);
    expect(findMany).toHaveBeenCalledTimes(players.length);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerId: 1, season: "2025-26", seasonType: "Regular Season" },
        orderBy: { gameDate: "asc" },
      }),
    );
    expect(z.map((series) => series.playerId)).toEqual([1, 2]);
    expect(g.map((series) => series.fullName)).toEqual(["Jalen Brunson", "Josh Hart"]);
    // Twelve games under a ten-game window leave three full windows.
    expect(z[0]?.points.length ?? 0).toBe(3);
    expect(g[0]?.points.length ?? 0).toBe(3);
  });

  it("scores the two methods differently from the same logs", async () => {
    const { z, g } = await getTrendSeries({ players: [brunson] });

    const zValues = z[0]?.points.map((point) => point.value) ?? [];
    const gValues = g[0]?.points.map((point) => point.value) ?? [];
    expect(zValues).not.toEqual(gValues);
    expect(z[0]?.points.map((point) => point.date) ?? []).toEqual(
      g[0]?.points.map((point) => point.date) ?? [],
    );
  });

  it("answers empty series without reading logs before any season is synced", async () => {
    latestSeason.mockResolvedValue(null);

    expect(await getTrendSeries({ players: [brunson] })).toEqual({
      z: [{ ...brunson, points: [] }],
      g: [{ ...brunson, points: [] }],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("caches per player under the players tag so a sync busts it with every other surface", () => {
    expect(unstableCache).toHaveBeenCalledTimes(1);
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["watchlist:trends"],
      expect.objectContaining({ tags: ["players"], revalidate: 300 }),
    );
  });
});
