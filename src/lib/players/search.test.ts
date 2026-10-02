import { beforeEach, describe, expect, it, vi } from "bun:test";

import type { PlayerPoolRow, PlayerStats } from "@/lib/players/search";
import type { PlayersSearchParams } from "@/lib/players/searchParams";

const queryRaw = vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw },
}));

const { compareByName, fetchRegularPool, matchesQuery, pageOf, rankPlayers, searchPlayers } =
  await import("@/lib/players/search");

const defaultParams: PlayersSearchParams = {
  q: "",
  page: 1,
  size: 25,
  sort: "firstName",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  tab: "regular",
};

const zeroStats: PlayerStats = {
  gamesPlayed: 0,
  fgm: 0,
  fga: 0,
  fg3m: 0,
  fg3a: 0,
  ftm: 0,
  fta: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  tov: 0,
  pts: 0,
};

const poolRow = ({
  id,
  firstName = `Player${id}`,
  lastName = `P${id}`,
  stats = {},
}: {
  id: number;
  firstName?: string;
  lastName?: string;
  stats?: Partial<PlayerStats>;
}): PlayerPoolRow => ({
  id,
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`,
  teamAbbr: "AAA",
  position: "G",
  nbaPersonId: null,
  stats: { ...zeroStats, ...stats },
});

// A pool query result row: identity columns plus flat stat columns.
const sqlRow = ({
  id,
  pts = 0,
  gamesPlayed = 0,
}: {
  id: number;
  pts?: number;
  gamesPlayed?: number;
}) => ({
  id,
  firstName: "Stephen",
  lastName: "Curry",
  fullName: "Stephen Curry",
  teamAbbr: "GSW",
  position: "PG",
  nbaPersonId: 201939,
  ...zeroStats,
  gamesPlayed,
  pts,
});

const idsOf = (rows: readonly { id: number }[]): number[] => rows.map((row) => row.id);

describe("fetchRegularPool", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("reads the latest season aggregate for the all range, with no window parameter", async () => {
    queryRaw.mockResolvedValue([sqlRow({ id: 1, pts: 2000, gamesPlayed: 70 })]);

    const pool = await fetchRegularPool({ range: "all" });

    const [strings, ...values] = queryRaw.mock.calls[0] ?? [];
    expect(strings?.join("?")).toContain('"PlayerSeasonStats"');
    expect(values).toEqual([]);
    expect(pool).toEqual([
      {
        id: 1,
        firstName: "Stephen",
        lastName: "Curry",
        fullName: "Stephen Curry",
        teamAbbr: "GSW",
        position: "PG",
        nbaPersonId: 201939,
        stats: { ...zeroStats, gamesPlayed: 70, pts: 2000 },
      },
    ]);
  });

  it("binds the game window as a query parameter for a lastN range", async () => {
    queryRaw.mockResolvedValue([sqlRow({ id: 1, pts: 300, gamesPlayed: 10 })]);

    const pool = await fetchRegularPool({ range: "last10" });

    const [strings, ...values] = queryRaw.mock.calls[0] ?? [];
    expect(strings?.join("?")).toContain('"PlayerGameLog"');
    expect(values).toEqual([10]);
    expect(pool[0]?.stats).toEqual({ ...zeroStats, gamesPlayed: 10, pts: 300 });
  });

  it("rejects rows whose stats are not plain numbers", async () => {
    // An uncast Postgres sum arrives as a bigint; failing loudly beats
    // silently ranking on the wrong type.
    queryRaw.mockResolvedValue([{ ...sqlRow({ id: 1 }), pts: BigInt(12) }]);

    await expect(fetchRegularPool({ range: "last5" })).rejects.toThrow();
  });
});

describe("rankPlayers", () => {
  it("orders by first name descending with last name and id tiebreaks", () => {
    const pool = [
      poolRow({ id: 3, firstName: "Anthony", lastName: "Davis" }),
      poolRow({ id: 1, firstName: "Stephen", lastName: "Curry" }),
      poolRow({ id: 2, firstName: "Anthony", lastName: "Edwards" }),
      poolRow({ id: 4, firstName: "Anthony", lastName: "Davis" }),
    ];

    const result = rankPlayers({ pool, args: defaultParams });

    expect(idsOf(result.rows)).toEqual([1, 2, 3, 4]);
    expect(result.total).toBe(4);
  });

  it("orders by last name then first name when sort is lastName", () => {
    const pool = [
      poolRow({ id: 1, firstName: "Seth", lastName: "Curry" }),
      poolRow({ id: 2, firstName: "Anthony", lastName: "Davis" }),
      poolRow({ id: 3, firstName: "Stephen", lastName: "Curry" }),
    ];

    const result = rankPlayers({ pool, args: { ...defaultParams, sort: "lastName", dir: "asc" } });

    expect(idsOf(result.rows)).toEqual([1, 3, 2]);
  });

  it("keeps only players whose full name contains the query, ignoring case", () => {
    const pool = [
      poolRow({ id: 1, firstName: "Stephen", lastName: "Curry" }),
      poolRow({ id: 2, firstName: "LeBron", lastName: "James" }),
    ];

    const result = rankPlayers({ pool, args: { ...defaultParams, q: "CURR" } });

    expect(idsOf(result.rows)).toEqual([1]);
    expect(result.total).toBe(1);
  });

  it("restricts the pool to the given player ids", () => {
    const pool = [poolRow({ id: 7 }), poolRow({ id: 3 }), poolRow({ id: 5 })];

    const result = rankPlayers({ pool, args: { ...defaultParams, playerIds: [7, 3] } });

    expect(idsOf(result.rows).toSorted()).toEqual([3, 7]);
  });

  it("clamps the page when the requested page exceeds available data", () => {
    const pool = Array.from({ length: 30 }, (_, index) => poolRow({ id: index + 1 }));

    const result = rankPlayers({ pool, args: { ...defaultParams, page: 9 } });

    expect(result.page).toBe(2);
    expect(result.rows).toHaveLength(5);
    expect(result.total).toBe(30);
  });

  it("returns page 1 with empty rows when nothing matches", () => {
    const result = rankPlayers({ pool: [poolRow({ id: 1 })], args: { ...defaultParams, q: "zz" } });

    expect(result).toEqual({ rows: [], total: 0, page: 1 });
  });

  it("sorts a stat by per-game average or by total, per the mode", () => {
    // Player 1 averages 30 over 60 games; player 2 averages 25 over 70 games.
    const pool = [
      poolRow({ id: 1, stats: { gamesPlayed: 60, pts: 1800 } }),
      poolRow({ id: 2, stats: { gamesPlayed: 70, pts: 1750 } }),
    ];

    const averages = rankPlayers({ pool, args: { ...defaultParams, sort: "pts" } });
    const ascending = rankPlayers({ pool, args: { ...defaultParams, sort: "pts", dir: "asc" } });

    expect(idsOf(averages.rows)).toEqual([1, 2]);
    expect(idsOf(ascending.rows)).toEqual([2, 1]);
  });

  it("breaks stat ties by last name, first name, then id, whatever the direction", () => {
    const pool = [
      poolRow({ id: 2, firstName: "Bo", lastName: "Zed", stats: { gamesPlayed: 60, reb: 600 } }),
      poolRow({ id: 1, firstName: "Al", lastName: "Zed", stats: { gamesPlayed: 60, reb: 600 } }),
      poolRow({ id: 3, firstName: "Cy", lastName: "Abe", stats: { gamesPlayed: 60, reb: 600 } }),
    ];

    const result = rankPlayers({ pool, args: { ...defaultParams, sort: "reb", dir: "asc" } });

    expect(idsOf(result.rows)).toEqual([3, 1, 2]);
  });

  it("sinks players below the qualifying minimum on percentage sorts", () => {
    // Player 1 shoots a perfect but tiny sample; player 2 qualifies at .500.
    const pool = [
      poolRow({ id: 1, stats: { gamesPlayed: 50, fgm: 10, fga: 10 } }),
      poolRow({ id: 2, stats: { gamesPlayed: 50, fgm: 400, fga: 800 } }),
    ];

    const withMinimums = rankPlayers({ pool, args: { ...defaultParams, sort: "fgPct" } });
    const withoutMinimums = rankPlayers({
      pool,
      args: { ...defaultParams, sort: "fgPct", minimums: false },
    });

    expect(idsOf(withMinimums.rows)).toEqual([2, 1]);
    expect(idsOf(withoutMinimums.rows)).toEqual([1, 2]);
  });

  it("ranks a player with no attempts last on a percentage sort", () => {
    const pool = [
      poolRow({ id: 1, stats: { fgm: 0, fga: 0 } }),
      poolRow({ id: 2, stats: { fgm: 1, fga: 4 } }),
    ];

    const result = rankPlayers({
      pool,
      args: { ...defaultParams, sort: "fgPct", minimums: false },
    });

    expect(idsOf(result.rows)).toEqual([2, 1]);
  });

  it("sinks players under 58 games on per-game sorts, but not on totals", () => {
    // Player 1 averages 45 over 20 games; player 2 averages 12 over 70 games.
    const pool = [
      poolRow({ id: 1, stats: { gamesPlayed: 20, pts: 900 } }),
      poolRow({ id: 2, stats: { gamesPlayed: 70, pts: 840 } }),
    ];

    const averages = rankPlayers({ pool, args: { ...defaultParams, sort: "pts" } });
    const withoutMinimums = rankPlayers({
      pool,
      args: { ...defaultParams, sort: "pts", minimums: false },
    });
    const totals = rankPlayers({ pool, args: { ...defaultParams, sort: "pts", mode: "total" } });

    expect(idsOf(averages.rows)).toEqual([2, 1]);
    expect(idsOf(withoutMinimums.rows)).toEqual([1, 2]);
    expect(idsOf(totals.rows)).toEqual([1, 2]);
  });

  it("scales the games-played minimum to a lastN range window", () => {
    // Threshold for last10 is 7 games: player 1 misses it on a higher average,
    // player 2 clears it on a lower one.
    const pool = [
      poolRow({ id: 1, stats: { gamesPlayed: 6, pts: 120 } }),
      poolRow({ id: 2, stats: { gamesPlayed: 7, pts: 70 } }),
    ];

    const result = rankPlayers({ pool, args: { ...defaultParams, sort: "pts", range: "last10" } });

    expect(idsOf(result.rows)).toEqual([2, 1]);
  });

  it("does not apply minimums to games played, which is a count", () => {
    const pool = [
      poolRow({ id: 1, stats: { gamesPlayed: 3 } }),
      poolRow({ id: 2, stats: { gamesPlayed: 9 } }),
    ];

    const result = rankPlayers({ pool, args: { ...defaultParams, sort: "gamesPlayed" } });

    expect(idsOf(result.rows)).toEqual([2, 1]);
  });
});

describe("searchPlayers", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("ranks the pool for the requested range", async () => {
    queryRaw.mockResolvedValue([
      sqlRow({ id: 1, pts: 100, gamesPlayed: 10 }),
      sqlRow({ id: 2, pts: 300, gamesPlayed: 10 }),
    ]);

    const result = await searchPlayers({ ...defaultParams, sort: "pts", range: "last10" });

    expect(idsOf(result.rows)).toEqual([2, 1]);
    expect(queryRaw.mock.calls[0]?.slice(1)).toEqual([10]);
  });

  it("short-circuits an empty id list without querying", async () => {
    const result = await searchPlayers({ ...defaultParams, playerIds: [] });

    expect(result).toEqual({ rows: [], total: 0, page: 1 });
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe("matchesQuery", () => {
  it("matches every name for an empty query", () => {
    expect(matchesQuery({ fullName: "Stephen Curry", q: "" })).toBe(true);
  });

  it("matches a case-insensitive substring and rejects a miss", () => {
    expect(matchesQuery({ fullName: "Stephen Curry", q: "phen cu" })).toBe(true);
    expect(matchesQuery({ fullName: "Stephen Curry", q: "james" })).toBe(false);
  });
});

describe("compareByName", () => {
  it("falls back to id ascending for identical names in either direction", () => {
    const a = { id: 2, firstName: "Jalen", lastName: "Williams" };
    const b = { id: 1, firstName: "Jalen", lastName: "Williams" };

    expect(compareByName({ a, b, sort: "lastName", dir: "asc" })).toBeGreaterThan(0);
    expect(compareByName({ a, b, sort: "lastName", dir: "desc" })).toBeGreaterThan(0);
  });
});

describe("pageOf", () => {
  it("slices the requested page", () => {
    expect(pageOf({ rows: [1, 2, 3, 4, 5], page: 2, size: 2 })).toEqual({
      rows: [3, 4],
      total: 5,
      page: 2,
    });
  });

  it("clamps to the last page and reports page 1 for an empty list", () => {
    expect(pageOf({ rows: [1, 2, 3], page: 5, size: 2 })).toEqual({
      rows: [3],
      total: 3,
      page: 2,
    });
    expect(pageOf({ rows: [], page: 3, size: 2 })).toEqual({ rows: [], total: 0, page: 1 });
  });
});
