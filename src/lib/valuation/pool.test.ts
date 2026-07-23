import { describe, expect, it } from "vitest";

import { makeStatLine } from "@/lib/valuation/fixtures";
import {
  attemptWeightedPcts,
  computePoolStats,
  meanSigma,
  MIN_AVG_MINUTES,
} from "@/lib/valuation/pool";
import { type FantasyStatLine } from "@/lib/valuation/types";

const line = makeStatLine;

describe("meanSigma", () => {
  it("computes population mean and standard deviation", () => {
    const { mu, sigma } = meanSigma([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(mu).toBe(5);
    expect(sigma).toBe(2);
  });

  it("returns sigma 0 for fewer than two values", () => {
    expect(meanSigma([])).toEqual({ mu: 0, sigma: 0 });
    expect(meanSigma([3])).toEqual({ mu: 3, sigma: 0 });
  });

  it("returns sigma 0 when every value is identical", () => {
    expect(meanSigma([4, 4, 4])).toEqual({ mu: 4, sigma: 0 });
  });
});

describe("attemptWeightedPcts", () => {
  it("weights by attempts instead of averaging per-player percentages", () => {
    const lines = [
      line({ playerId: 1, fgm: 9, fga: 10, ftm: 0, fta: 0 }), // 90% on 10
      line({ playerId: 2, fgm: 100, fga: 250, ftm: 0, fta: 0 }), // 40% on 250
    ];
    const { leagueFgPct } = attemptWeightedPcts({ lines });
    // (9 + 100) / (10 + 250) ≈ 0.419, not the naive mean 0.65
    expect(leagueFgPct).toBeCloseTo(109 / 260, 10);
  });

  it("returns 0 when there are no attempts", () => {
    const lines = [line({ playerId: 1, fgm: 0, fga: 0, ftm: 0, fta: 0 })];
    expect(attemptWeightedPcts({ lines })).toEqual({ leagueFgPct: 0, leagueFtPct: 0 });
  });
});

describe("computePoolStats", () => {
  const scorer = ({ playerId, pts }: { playerId: number; pts: number }): FantasyStatLine =>
    line({ playerId, pts });

  it("drops players below the games or minutes thresholds from the pool", () => {
    const lines = [
      scorer({ playerId: 1, pts: 900 }),
      scorer({ playerId: 2, pts: 800 }),
      line({ playerId: 3, pts: 2000, gamesPlayed: 10, minutes: 300 }), // 10 GP < 25 for full season
      line({ playerId: 4, pts: 2000, minutes: 50 * (MIN_AVG_MINUTES - 1) }), // low minutes
    ];
    const stats = computePoolStats({ lines, basis: "perGame", poolSize: 150, range: "all" });
    expect(stats.poolSize).toBe(2);
    // Pool mean reflects only the two qualifying players: 18 and 16 pts/game.
    expect(stats.byCategory.pts.mu).toBeCloseTo(17, 10);
  });

  it("scales the games threshold to lastN windows", () => {
    const lines = [
      line({ playerId: 1, gamesPlayed: 4, minutes: 4 * 30 }),
      line({ playerId: 2, gamesPlayed: 4, minutes: 4 * 30, pts: 300 }),
    ];
    // last10 window: ceil(10 * 0.3) = 3 games required; both qualify.
    const stats = computePoolStats({ lines, basis: "perGame", poolSize: 150, range: "last10" });
    expect(stats.poolSize).toBe(2);
  });

  it("trims to poolSize by provisional value and recomputes stats on the pool", () => {
    const lines = [
      scorer({ playerId: 1, pts: 2500 }),
      scorer({ playerId: 2, pts: 2000 }),
      scorer({ playerId: 3, pts: 1500 }),
      scorer({ playerId: 4, pts: 500 }),
      scorer({ playerId: 5, pts: 100 }),
    ];
    const trimmed = computePoolStats({ lines, basis: "total", poolSize: 3, range: "all" });
    const untrimmed = computePoolStats({ lines, basis: "total", poolSize: 150, range: "all" });
    expect(trimmed.poolSize).toBe(3);
    expect(untrimmed.poolSize).toBe(5);
    // Top three by points: 2500, 2000, 1500 → mean 2000.
    expect(trimmed.byCategory.pts.mu).toBeCloseTo(2000, 10);
    expect(untrimmed.byCategory.pts.mu).toBeCloseTo(1320, 10);
    expect(trimmed.byCategory.pts.sigma).not.toBeCloseTo(untrimmed.byCategory.pts.sigma, 10);
  });

  it("returns neutral stats when fewer than two players qualify", () => {
    const lines = [line({ playerId: 1 }), line({ playerId: 2, gamesPlayed: 1, minutes: 30 })];
    const stats = computePoolStats({ lines, basis: "perGame", poolSize: 150, range: "all" });
    expect(stats.poolSize).toBe(1);
    expect(stats.byCategory.pts.sigma).toBe(0);
  });

  it("derives within-player volatility from the second moments", () => {
    // Player 1 alternates 5 and 15 points (variance 25); player 2 is constant.
    const volatile = line({
      playerId: 1,
      gamesPlayed: 4,
      minutes: 120,
      pts: 40,
      sq: { ...line({ playerId: 1 }).sq, pts: 500 },
    });
    const steady = line({ playerId: 2, gamesPlayed: 4, minutes: 120, pts: 40 });
    const stats = computePoolStats({
      lines: [volatile, steady],
      basis: "perGame",
      poolSize: 150,
      range: "last5",
    });
    expect(stats.byCategory.pts.sigmaWithin).toBeCloseTo(Math.sqrt(12.5), 10);
    expect(stats.byCategory.reb.sigmaWithin).toBeCloseTo(0, 10);
  });

  it("keeps sigma 0 for a category with no spread", () => {
    const lines = [
      scorer({ playerId: 1, pts: 900 }),
      scorer({ playerId: 2, pts: 800 }),
      scorer({ playerId: 3, pts: 700 }),
    ];
    const stats = computePoolStats({ lines, basis: "total", poolSize: 150, range: "all" });
    expect(stats.byCategory.reb.sigma).toBe(0); // identical rebounds everywhere
    expect(stats.byCategory.pts.sigma).toBeGreaterThan(0);
  });
});
