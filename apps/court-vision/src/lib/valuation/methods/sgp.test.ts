import { describe, expect, it } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { scoreSGP, standingsGainDenominators } from "@/lib/valuation/methods/sgp";
import { computePoolStats } from "@/lib/valuation/pool";
import { type FantasyStatLine, type ValuationConfig } from "@/lib/valuation/types";

const config = (overrides: Partial<ValuationConfig> = {}): ValuationConfig => ({
  categories: ["pts", "reb"],
  weights: {},
  basis: "perGame",
  teams: 2,
  rosterSlots: 2,
  scoring: DEFAULT_POINTS_SCORING,
  ...overrides,
});

// Four players with a clean points ladder so the synthetic league's spread is
// predictable: snake order gives team A the 1st and 4th, team B the 2nd and 3rd.
const lines: FantasyStatLine[] = [
  makeStatLine({ playerId: 1, gamesPlayed: 10, pts: 400, reb: 100 }),
  makeStatLine({ playerId: 2, gamesPlayed: 10, pts: 300, reb: 100 }),
  makeStatLine({ playerId: 3, gamesPlayed: 10, pts: 200, reb: 100 }),
  makeStatLine({ playerId: 4, gamesPlayed: 10, pts: 100, reb: 100 }),
];

const poolStats = computePoolStats({
  lines,
  basis: "perGame",
  poolSize: 4,
  range: "all",
});

describe("standingsGainDenominators", () => {
  it("measures the average gap between adjacent teams", () => {
    // Per game: 40/30/20/10 points. Snake over 2 teams → A = 40 + 10 = 50,
    // B = 30 + 20 = 50, so points are dead level and the gap is 0.
    const denominators = standingsGainDenominators({ lines, poolStats, config: config() });
    expect(denominators.pts).toBe(0);
  });

  it("widens as team totals spread out", () => {
    // One roster slot per team means no snake balancing: A takes the 40, B the
    // 30, so the adjacent-place gap is the raw 10-point difference.
    const denominators = standingsGainDenominators({
      lines,
      poolStats,
      config: config({ rosterSlots: 1 }),
    });
    expect(denominators.pts).toBeCloseTo(10, 6);
  });

  it("returns nothing for a one-team league, where nothing separates places", () => {
    expect(standingsGainDenominators({ lines, poolStats, config: config({ teams: 1 }) })).toEqual(
      {},
    );
  });
});

describe("scoreSGP", () => {
  it("prices production in standings places", () => {
    const values = scoreSGP({ lines, poolStats, config: config({ rosterSlots: 1 }) });
    const top = values.find((value) => value.playerId === 1);
    // 40 points per game over a 10-point gap = 4 places from points alone.
    expect(top?.breakdown.pts?.raw).toBeCloseTo(4, 6);
  });

  it("scores a tied category as zero rather than dividing by nothing", () => {
    const values = scoreSGP({ lines, poolStats, config: config() });
    // Rebounds are identical for everyone, so no rebound total can move you.
    expect(values.every((value) => value.breakdown.reb?.raw === 0)).toBe(true);
  });

  it("applies category weights", () => {
    const weighted = scoreSGP({
      lines,
      poolStats,
      config: config({ rosterSlots: 1, weights: { pts: 0 } }),
    });
    const top = weighted.find((value) => value.playerId === 1);
    expect(top?.breakdown.pts?.raw).toBeCloseTo(4, 6);
    expect(top?.breakdown.pts?.weighted).toBe(0);
    expect(top?.total).toBe(0);
  });

  it("ranks the better player higher", () => {
    const values = scoreSGP({ lines, poolStats, config: config({ rosterSlots: 1 }) });
    const first = values.find((value) => value.playerId === 1)?.total ?? 0;
    const last = values.find((value) => value.playerId === 4)?.total ?? 0;
    expect(first).toBeGreaterThan(last);
  });
});
