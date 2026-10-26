import { describe, expect, it } from "bun:test";

import { makeLine } from "@vision/core/testing/lines";

import { hockey, type HockeyKeys } from "#hockey/descriptor";
import { hockeyEngine } from "#hockey/engine";

// Sixty games, with time on ice as the playing time.
type LineProps = {
  playerId: number;
  position: string;
  stats: Partial<Record<HockeyKeys["valued"], number>>;
};

const line = ({ playerId, position, stats }: LineProps) =>
  makeLine({
    sport: hockey,
    playerId,
    position,
    gamesPlayed: 60,
    playingTime: stats.toi ?? 0,
    stats,
  });

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
