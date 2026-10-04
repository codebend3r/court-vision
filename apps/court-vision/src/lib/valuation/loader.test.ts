import { beforeEach, describe, expect, it, vi } from "bun:test";

const queryRaw = vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>>();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw, playerSeasonStats: { findFirst } },
}));

// A pass-through cache, so each call reaches the query.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

const { getFantasyPool } = await import("@/lib/valuation/loader");

// One aggregated row as the window query returns it: flat totals and moments.
const sqlLine = {
  playerId: 7,
  firstName: "Tyrese",
  lastName: "Haliburton",
  fullName: "Tyrese Haliburton",
  teamAbbr: "IND",
  position: "G",
  nbaPersonId: 1630169,
  gamesPlayed: 2,
  minutes: 71.5,
  pts: 40,
  reb: 8,
  ast: 20,
  stl: 3,
  blk: 1,
  fg3m: 6,
  tov: 4,
  fgm: 14,
  fga: 30,
  ftm: 6,
  fta: 7,
  sqPts: 818,
  sqReb: 34,
  sqAst: 208,
  sqStl: 5,
  sqBlk: 1,
  sqFg3m: 20,
  sqTov: 10,
  sqFgm: 100,
  sqFga: 452,
  sqFtm: 20,
  sqFta: 25,
  crossFg: 212,
  crossFt: 22,
};

describe("getFantasyPool", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    findFirst.mockReset();
  });

  it("nests the stats and second moments into the line the scorers read", async () => {
    queryRaw.mockResolvedValue([sqlLine]);

    const lines = await getFantasyPool({ range: "last10", season: "2025-26" });

    expect(lines).toEqual([
      {
        playerId: 7,
        firstName: "Tyrese",
        lastName: "Haliburton",
        fullName: "Tyrese Haliburton",
        teamAbbr: "IND",
        position: "G",
        nbaPersonId: 1630169,
        gamesPlayed: 2,
        playingTime: 71.5,
        stats: {
          pts: 40,
          reb: 8,
          ast: 20,
          stl: 3,
          blk: 1,
          fg3m: 6,
          tov: 4,
          fgm: 14,
          fga: 30,
          ftm: 6,
          fta: 7,
        },
        sq: {
          pts: 818,
          reb: 34,
          ast: 208,
          stl: 5,
          blk: 1,
          fg3m: 20,
          tov: 10,
          fgm: 100,
          fga: 452,
          ftm: 20,
          fta: 25,
        },
        cross: { fg: 212, ft: 22 },
      },
    ]);
  });

  it("binds the season and the window, with no window for the whole season", async () => {
    queryRaw.mockResolvedValue([]);

    await getFantasyPool({ range: "last5", season: "2024-25" });
    await getFantasyPool({ range: "all", season: "2024-25" });

    expect(queryRaw.mock.calls[0]?.slice(1)).toEqual(["2024-25", 5, 5]);
    expect(queryRaw.mock.calls[1]?.slice(1)).toEqual(["2024-25", null, null]);
  });

  it("values the latest season when none is requested", async () => {
    findFirst.mockResolvedValue({ season: "2025-26" });
    queryRaw.mockResolvedValue([]);

    await getFantasyPool({ range: "all" });

    expect(queryRaw.mock.calls[0]?.[1]).toBe("2025-26");
  });

  it("returns an empty pool without querying logs when no season has data", async () => {
    findFirst.mockResolvedValue(null);

    expect(await getFantasyPool({ range: "all" })).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("rejects rows whose totals are not plain numbers", async () => {
    queryRaw.mockResolvedValue([{ ...sqlLine, pts: BigInt(40) }]);

    await expect(getFantasyPool({ range: "last5", season: "2025-26" })).rejects.toThrow();
  });
});
