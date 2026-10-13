import { beforeEach, describe, expect, it, vi } from "bun:test";

import { Prisma } from "@generated/prisma/client";

import type { PlayerPoolRow, PlayerStats } from "@/lib/players/search";
import type { RegularSearchParams } from "@/lib/players/searchParams";
import { SEASON_TYPE } from "@/lib/stats/season";

const queryRaw = vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw },
}));

const { fetchRegularPool, rankPlayers } = await import("@/lib/players/search");

const defaultParams: RegularSearchParams = {
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

// The first query, with its shared fragments spliced back in, the way Prisma
// composes it: the full SQL text and every bound value in order.
const firstQuery = (): Prisma.Sql => {
  const [strings, ...values] = queryRaw.mock.calls[0] ?? [];
  return Prisma.sql(strings ?? [], ...values);
};

const idsOf = (rows: readonly { id: number }[]): number[] => rows.map((row) => row.id);

describe("fetchRegularPool", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("reads the latest regular-season aggregate for the all range, with no window", async () => {
    queryRaw.mockResolvedValue([sqlRow({ id: 1, pts: 2000, gamesPlayed: 70 })]);

    const pool = await fetchRegularPool({ range: "all" });

    expect(firstQuery().sql).toContain('"PlayerSeasonStats"');
    expect(firstQuery().values).toEqual([SEASON_TYPE]);
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

    expect(firstQuery().sql).toContain('"PlayerGameLog"');
    expect(firstQuery().values).toEqual([10]);
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

describe("rankPlayers star order", () => {
  const starredParams: RegularSearchParams = {
    ...defaultParams,
    size: 50,
    sort: "starredAt",
    tab: "starred",
  };

  it("restores star order when the pool holds the rows in another order", () => {
    const pool = [poolRow({ id: 3 }), poolRow({ id: 7 })];

    const result = rankPlayers({ pool, args: { ...starredParams, playerIds: [7, 3] } });

    expect(idsOf(result.rows)).toEqual([7, 3]);
  });

  it("orders a watchlist longer than a page by star order before cutting the page", () => {
    // Twelve stars, newest first, with names in the opposite order: a name
    // sort would put the oldest stars on page 1.
    const playerIds = Array.from({ length: 12 }, (_, index) => 12 - index);
    const pool = playerIds.map((id) =>
      poolRow({ id, firstName: "Al", lastName: `Name${id + 10}` }),
    );
    const args = { ...starredParams, size: 10, playerIds };

    const first = rankPlayers({ pool, args });
    const second = rankPlayers({ pool, args: { ...args, page: 2 } });
    const oldestFirst = rankPlayers({ pool, args: { ...args, dir: "asc" } });

    expect(idsOf(first.rows)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(idsOf(second.rows)).toEqual([2, 1]);
    expect(idsOf(oldestFirst.rows)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("ties every row, so names decide, when there is no watchlist to order by", () => {
    const pool = [
      poolRow({ id: 1, firstName: "Bo", lastName: "Zed" }),
      poolRow({ id: 2, firstName: "Al", lastName: "Abe" }),
    ];

    const result = rankPlayers({ pool, args: { ...starredParams, tab: "regular" } });

    expect(idsOf(result.rows)).toEqual([2, 1]);
  });
});
