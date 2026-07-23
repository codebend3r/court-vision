import { describe, expect, it } from "vitest";

import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { computePoolStats } from "@/lib/valuation/pool";
import { type FantasyStatLine, type ValuationConfig } from "@/lib/valuation/types";

// Per-game points 2, 4, 6, 8 across the pool (n = 50 games). Every player
// carries a game-level points variance of 100, injected via sq:
// sq = n · (variance + mean²).
const volatileLine = ({ playerId, pts }: { playerId: number; pts: number }): FantasyStatLine => {
  const base = makeStatLine({ playerId, pts });
  const mean = pts / base.gamesPlayed;
  return {
    ...base,
    sq: { ...base.sq, pts: base.gamesPlayed * (100 + mean ** 2) },
  };
};

const lines = [
  volatileLine({ playerId: 1, pts: 100 }),
  volatileLine({ playerId: 2, pts: 200 }),
  volatileLine({ playerId: 3, pts: 300 }),
  volatileLine({ playerId: 4, pts: 400 }),
];

const config: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
};

const poolStats = computePoolStats({ lines, basis: "perGame", poolSize: 150, range: "all" });

describe("scoreGScore", () => {
  it("compresses edges by game-level volatility: g = (x − μ) / √(σb² + σw²)", () => {
    const values = scoreGScore({ lines, poolStats, config });
    // Between-player per-game spread: values 2,4,6,8 → μ 5, σb² = 5.
    // Within variance 100 per player → σw² = 100. Denominator √105.
    expect(values[3]?.breakdown.pts?.raw).toBeCloseTo(3 / Math.sqrt(105), 10);
    expect(values[0]?.breakdown.pts?.raw).toBeCloseTo(-3 / Math.sqrt(105), 10);
  });

  it("scores volatile categories lower than Z-Score for the same edge", () => {
    const values = scoreGScore({ lines, poolStats, config });
    // Z would give 3/√5; G gives 3/√105 — strictly smaller in magnitude.
    const g = values[3]?.breakdown.pts?.raw ?? 0;
    expect(Math.abs(g)).toBeLessThan(Math.abs(3 / Math.sqrt(5)));
  });

  it("respects weights and punts like every category method", () => {
    const punted = scoreGScore({
      lines,
      poolStats,
      config: { ...config, weights: { pts: 0 } },
    });
    expect(punted[3]?.breakdown.pts?.weighted).toBe(0);
    expect(punted[3]?.breakdown.pts?.raw).toBeGreaterThan(0);
  });
});
