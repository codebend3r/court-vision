import { beforeEach, describe, expect, it, vi } from "bun:test";

import type { AdvancedPlayerRow, PlayerAdvancedStats } from "@/lib/players/searchAdvanced";
import type { PlayersSearchParams } from "@/lib/players/searchParams";

const queryRaw = vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw },
}));

const { averageAdvancedLogs, fetchAdvancedPool, rankAdvancedPlayers, searchPlayersAdvanced } =
  await import("@/lib/players/searchAdvanced");

const defaultParams: PlayersSearchParams = {
  q: "",
  page: 1,
  size: 25,
  sort: "pie",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  tab: "advanced",
};

const buildLog = (overrides: { gameDate?: Date; season?: string; pie?: number | null } = {}) => ({
  gameDate: overrides.gameDate ?? new Date("2025-11-01"),
  season: overrides.season ?? "2025-26",
  pie: overrides.pie === undefined ? 15 : overrides.pie,
  pace: 98,
  assistPercentage: 0.2,
  assistRatio: 20,
  assistToTurnover: 2,
  defensiveRating: 110,
  defensiveReboundPercentage: 0.1,
  effectiveFieldGoalPercentage: 0.5,
  netRating: 4,
  offensiveRating: 114,
  offensiveReboundPercentage: 0.05,
  reboundPercentage: 0.08,
  trueShootingPercentage: 0.55,
  turnoverRatio: 12,
  usagePercentage: 0.25,
});

const nullStats: PlayerAdvancedStats = {
  pie: null,
  pace: null,
  assistPercentage: null,
  assistRatio: null,
  assistToTurnover: null,
  defensiveRating: null,
  defensiveReboundPercentage: null,
  effectiveFieldGoalPercentage: null,
  netRating: null,
  offensiveRating: null,
  offensiveReboundPercentage: null,
  reboundPercentage: null,
  trueShootingPercentage: null,
  turnoverRatio: null,
  usagePercentage: null,
  gamesWithData: 0,
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
  stats?: Partial<PlayerAdvancedStats>;
}): AdvancedPlayerRow => ({
  id,
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`,
  teamAbbr: "AAA",
  position: "G",
  nbaPersonId: null,
  stats: { ...nullStats, ...stats },
});

// A pool query result row: identity columns plus flat metric columns.
const sqlRow = ({ id, pie = null }: { id: number; pie?: number | null }) => ({
  id,
  firstName: "Nikola",
  lastName: "Jokic",
  fullName: "Nikola Jokic",
  teamAbbr: "DEN",
  position: "C",
  nbaPersonId: 203999,
  ...nullStats,
  gamesWithData: pie === null ? 0 : 1,
  pie,
});

const idsOf = (rows: readonly { id: number }[]): number[] => rows.map((row) => row.id);

describe("fetchAdvancedPool", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("binds the lastN window and leaves the season scope off", async () => {
    queryRaw.mockResolvedValue([sqlRow({ id: 1, pie: 18.5 })]);

    const pool = await fetchAdvancedPool({ range: "last10" });

    const [strings, ...values] = queryRaw.mock.calls[0] ?? [];
    expect(strings?.join("?")).toContain('"PlayerAdvancedGameLog"');
    expect(values).toEqual([10, false]);
    expect(pool).toEqual([
      {
        id: 1,
        firstName: "Nikola",
        lastName: "Jokic",
        fullName: "Nikola Jokic",
        teamAbbr: "DEN",
        position: "C",
        nbaPersonId: 203999,
        stats: { ...nullStats, gamesWithData: 1, pie: 18.5 },
      },
    ]);
  });

  it("scopes the all range to the latest season under the full fetch limit", async () => {
    queryRaw.mockResolvedValue([]);

    await fetchAdvancedPool({ range: "all" });

    expect(queryRaw.mock.calls[0]?.slice(1)).toEqual([100, true]);
  });

  it("rejects rows whose metrics are not numbers or null", async () => {
    queryRaw.mockResolvedValue([{ ...sqlRow({ id: 1 }), pie: "18.5" }]);

    await expect(fetchAdvancedPool({ range: "last5" })).rejects.toThrow();
  });
});

describe("rankAdvancedPlayers", () => {
  it("sorts by a metric with null values sinking to the bottom regardless of direction", () => {
    const pool = [
      poolRow({ id: 1, stats: { pie: null } }),
      poolRow({ id: 2, stats: { pie: 12 } }),
      poolRow({ id: 3, stats: { pie: 8 } }),
    ];

    const descending = rankAdvancedPlayers({ pool, args: defaultParams });
    const ascending = rankAdvancedPlayers({ pool, args: { ...defaultParams, dir: "asc" } });

    expect(idsOf(descending.rows)).toEqual([2, 3, 1]);
    expect(idsOf(ascending.rows)).toEqual([3, 2, 1]);
  });

  it("orders by name for a name sort and filters by the query", () => {
    const pool = [
      poolRow({ id: 1, firstName: "Jalen", lastName: "Brunson" }),
      poolRow({ id: 2, firstName: "Jalen", lastName: "Williams" }),
      poolRow({ id: 3, firstName: "Jaylen", lastName: "Brown" }),
      poolRow({ id: 4, firstName: "Luka", lastName: "Doncic" }),
    ];

    const result = rankAdvancedPlayers({
      pool,
      args: { ...defaultParams, sort: "lastName", dir: "asc", q: "j" },
    });

    expect(idsOf(result.rows)).toEqual([3, 1, 2]);
    expect(result.total).toBe(3);
  });

  it("clamps the page when the requested page exceeds available data", () => {
    const pool = Array.from({ length: 30 }, (_, index) => poolRow({ id: index + 1 }));

    const result = rankAdvancedPlayers({ pool, args: { ...defaultParams, page: 9 } });

    expect(result.page).toBe(2);
    expect(result.rows).toHaveLength(5);
  });

  it("returns empty rows on page 1 when there are zero matches", () => {
    const result = rankAdvancedPlayers({ pool: [], args: defaultParams });

    expect(result).toEqual({ rows: [], total: 0, page: 1 });
  });
});

describe("searchPlayersAdvanced", () => {
  it("ranks the pool for the requested range", async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([sqlRow({ id: 1, pie: 9 }), sqlRow({ id: 2, pie: 14 })]);

    const result = await searchPlayersAdvanced({ ...defaultParams, range: "last5" });

    expect(idsOf(result.rows)).toEqual([2, 1]);
    expect(queryRaw.mock.calls[0]?.slice(1)).toEqual([5, false]);
  });
});

describe("averageAdvancedLogs", () => {
  it("averages each metric over the games that recorded it", () => {
    const stats = averageAdvancedLogs({
      logs: [buildLog({ pie: 10 }), buildLog({ pie: 20 }), buildLog({ pie: null })],
    });

    expect(stats.pie).toBe(15);
    expect(stats.pace).toBe(98);
    expect(stats.gamesWithData).toBe(3);
  });

  it("reports null metrics and zero games for an empty window", () => {
    const stats = averageAdvancedLogs({ logs: [] });

    expect(stats.pie).toBeNull();
    expect(stats.usagePercentage).toBeNull();
    expect(stats.gamesWithData).toBe(0);
  });
});
