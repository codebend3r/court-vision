import { describe, expect, it } from "bun:test";

import { recordFromKeys } from "@vision/core/util/record";
import { type ValuationLine } from "@vision/core/valuation/types";

import { hockey, HOCKEY_VALUED_STATS, type HockeyKeys } from "#hockey/descriptor";
import { hockeyEngine } from "#hockey/engine";

type Stats = Partial<Record<HockeyKeys["valued"], number>>;

const line = ({
  playerId,
  position,
  stats,
}: {
  playerId: number;
  position: string;
  stats: Stats;
}): ValuationLine<HockeyKeys> => {
  const gamesPlayed = 60;
  const totals = recordFromKeys({ keys: HOCKEY_VALUED_STATS, value: (key) => stats[key] ?? 0 });
  return {
    playerId,
    position,
    gamesPlayed,
    playingTime: totals.toi,
    stats: totals,
    sq: recordFromKeys({
      keys: HOCKEY_VALUED_STATS,
      value: (key) => (totals[key] * totals[key]) / gamesPlayed,
    }),
    cross: { gaa: 0, svp: 0 },
  };
};

const [skaterPool, goaliePool] = hockey.pools;

describe("valuing skaters", () => {
  const skaters = Array.from({ length: 40 }, (_, index) =>
    line({
      playerId: index + 1,
      position: index % 2 === 0 ? "C" : "D",
      stats: { g: 10 + index, a: 15 + index, sog: 120 + index * 2, hit: 40, blk: 30, toi: 60 * 17 },
    }),
  );

  it("ranks the most productive skater first by Z-Score", () => {
    const { values } = hockeyEngine.valuePlayers({
      pool: skaterPool,
      lines: skaters,
      config: { ...hockeyEngine.defaultValuationConfig, categories: [...skaterPool.categories] },
      windowGames: null,
    });
    const best = [...values].sort((a, b) => b.z - a.z)[0];
    expect(best?.playerId).toBe(40);
  });
});

describe("valuing goalies", () => {
  // Same minutes; the first allows a third of the goals.
  const goalies = [
    line({
      playerId: 1,
      position: "G",
      stats: { w: 30, so: 4, ga: 60, sv: 1600, sa: 1660, toi: 60 * 55 },
    }),
    line({
      playerId: 2,
      position: "G",
      stats: { w: 30, so: 4, ga: 180, sv: 1480, sa: 1660, toi: 60 * 55 },
    }),
  ];
  const config = { ...hockeyEngine.defaultValuationConfig, categories: [...goaliePool.categories] };

  it("scores a lower goals-against average higher", () => {
    const poolStats = hockeyEngine.computePoolStats({
      pool: goaliePool,
      lines: goalies,
      basis: "perGame",
      poolSize: 40,
      windowGames: null,
    });
    const [stingy, leaky] = hockeyEngine.scoreZScore({ lines: goalies, poolStats, config });
    expect(stingy?.breakdown.gaa?.raw ?? 0).toBeGreaterThan(0);
    expect(leaky?.breakdown.gaa?.raw ?? 0).toBeLessThan(0);
  });

  it("reads GAA per 60 minutes", () => {
    expect(
      hockeyEngine.categoryPerGame({
        line: goalies[0] ?? line({ playerId: 0, position: "G", stats: {} }),
        category: "gaa",
      }),
    ).toBeCloseTo((60 * 60) / (60 * 55), 10);
  });
});

describe("hockey rosters", () => {
  it("keeps goalies out of the skater utility slot", () => {
    expect(hockeyEngine.eligibleForSlot({ slotType: "UTIL", position: "G" })).toBe(false);
    expect(hockeyEngine.eligibleForSlot({ slotType: "UTIL", position: "D" })).toBe(true);
  });
});
