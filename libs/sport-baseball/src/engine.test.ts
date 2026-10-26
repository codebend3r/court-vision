import { describe, expect, it } from "bun:test";

import { makeLine } from "@vision/core/testing/lines";

import { baseball, type BaseballKeys } from "#baseball/descriptor";
import { baseballEngine } from "#baseball/engine";

// Thirty appearances, each counted as one unit of playing time.
type LineProps = {
  playerId: number;
  position: string;
  stats: Partial<Record<BaseballKeys["valued"], number>>;
};

const line = ({ playerId, position, stats }: LineProps) =>
  makeLine({ sport: baseball, playerId, position, gamesPlayed: 30, playingTime: 30, stats });

const pitchers = baseball.pools[1];

describe("valuing pitchers", () => {
  // Same innings (180 = 540 outs); ERA 1.00 against ERA 3.00.
  const lines = [
    line({ playerId: 1, position: "SP", stats: { w: 12, k: 200, er: 20, br: 150, outs: 540 } }),
    line({ playerId: 2, position: "SP", stats: { w: 12, k: 200, er: 60, br: 150, outs: 540 } }),
  ];
  const config = { ...baseballEngine.defaultValuationConfig, categories: [...pitchers.categories] };
  const poolStats = baseballEngine.computePoolStats({
    pool: pitchers,
    lines,
    basis: "total",
    poolSize: 120,
    windowGames: null,
  });

  it("puts the league ERA on the familiar per-nine scale", () => {
    // 80 earned runs over 1080 outs → 2.00 per nine innings.
    expect(27 * poolStats.leagueRate.era).toBeCloseTo(2, 10);
  });

  it("scores the lower ERA higher, by innings times the gap to league ERA", () => {
    const ace = baseballEngine.categoryValue({
      line: lines[0] ?? lines[1],
      category: "era",
      basis: "total",
      leagueRate: poolStats.leagueRate,
    });
    // 540 outs × (2.00 − 1.00) = 540, positive because lower is better.
    expect(ace).toBeCloseTo(540, 8);
    const [first, second] = baseballEngine.scoreZScore({ lines, poolStats, config });
    expect(first?.breakdown.era?.raw ?? 0).toBeGreaterThan(second?.breakdown.era?.raw ?? 0);
  });

  it("reads ERA and WHIP per nine innings and per inning", () => {
    const ace = lines[0] ?? lines[1];
    expect(
      ace === undefined ? 0 : baseballEngine.categoryPerGame({ line: ace, category: "era" }),
    ).toBeCloseTo(1, 10);
    expect(
      ace === undefined ? 0 : baseballEngine.categoryPerGame({ line: ace, category: "whip" }),
    ).toBeCloseTo(150 / 180, 10);
  });
});
