import { describe, expect, it } from "vitest";

import { computePoolStats } from "@/lib/valuation/pool";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type ValuationConfig } from "@/lib/valuation/types";

const line = makeStatLine;

// Four players identical everywhere except points: 100, 200, 300, 400.
// mu = 250, population sigma = sqrt(12500) ≈ 111.803. Every other category
// has zero spread, so total value is the points z-score alone.
const lines = [
  line({ playerId: 1, pts: 100 }),
  line({ playerId: 2, pts: 200 }),
  line({ playerId: 3, pts: 300 }),
  line({ playerId: 4, pts: 400 }),
];

const config = (overrides: Partial<ValuationConfig> = {}): ValuationConfig => ({
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "total",
  teams: 12,
  rosterSlots: 13,
  ...overrides,
});

const poolStats = computePoolStats({ lines, basis: "total", poolSize: 150, range: "all" });

describe("scoreZScore", () => {
  it("matches the hand-computed golden fixture", () => {
    const values = scoreZScore({ lines, poolStats, config: config() });
    const sigma = Math.sqrt(12500);
    expect(values.map((value) => value.playerId)).toEqual([1, 2, 3, 4]);
    expect(values[0]?.total).toBeCloseTo(-150 / sigma, 10);
    expect(values[1]?.total).toBeCloseTo(-50 / sigma, 10);
    expect(values[2]?.total).toBeCloseTo(50 / sigma, 10);
    expect(values[3]?.total).toBeCloseTo(150 / sigma, 10);
    expect(values[3]?.breakdown.pts?.raw).toBeCloseTo(150 / sigma, 10);
    expect(values[3]?.breakdown.reb?.raw).toBe(0); // zero spread → z 0
  });

  it("scales weighted but not raw contributions", () => {
    const values = scoreZScore({ lines, poolStats, config: config({ weights: { pts: 2 } }) });
    const sigma = Math.sqrt(12500);
    expect(values[3]?.breakdown.pts?.raw).toBeCloseTo(150 / sigma, 10);
    expect(values[3]?.breakdown.pts?.weighted).toBeCloseTo(300 / sigma, 10);
    expect(values[3]?.total).toBeCloseTo(300 / sigma, 10);
  });

  it("keeps raw visible with a punt weight of 0", () => {
    const values = scoreZScore({ lines, poolStats, config: config({ weights: { pts: 0 } }) });
    expect(values[3]?.breakdown.pts?.raw).toBeGreaterThan(0);
    expect(values[3]?.breakdown.pts?.weighted).toBe(0);
    expect(values[3]?.total).toBe(0);
  });

  it("drops excluded categories from breakdown and total", () => {
    const included = CATEGORY_KEYS.filter((key) => key !== "pts");
    const values = scoreZScore({ lines, poolStats, config: config({ categories: included }) });
    expect(values[3]?.breakdown.pts).toBeUndefined();
    expect(values[3]?.total).toBe(0);
  });

  it("returns zero totals with an empty category set", () => {
    const values = scoreZScore({ lines, poolStats, config: config({ categories: [] }) });
    values.forEach((value) => {
      expect(value.total).toBe(0);
      expect(Object.keys(value.breakdown)).toEqual([]);
    });
  });

  it("is deterministic", () => {
    const first = scoreZScore({ lines, poolStats, config: config() });
    const second = scoreZScore({ lines, poolStats, config: config() });
    expect(first).toEqual(second);
  });
});
