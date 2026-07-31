import { describe, expect, it } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { scoreSimValue } from "@/lib/valuation/methods/simvalue";
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

// A spread of scorers so the synthetic teams differ and the simulation has a
// real opponent distribution to draw from.
const lines: FantasyStatLine[] = [
  makeStatLine({ playerId: 1, gamesPlayed: 10, pts: 500, reb: 150 }),
  makeStatLine({ playerId: 2, gamesPlayed: 10, pts: 380, reb: 130 }),
  makeStatLine({ playerId: 3, gamesPlayed: 10, pts: 300, reb: 110 }),
  makeStatLine({ playerId: 4, gamesPlayed: 10, pts: 220, reb: 90 }),
  makeStatLine({ playerId: 5, gamesPlayed: 10, pts: 150, reb: 70 }),
  makeStatLine({ playerId: 6, gamesPlayed: 10, pts: 90, reb: 50 }),
];

const poolStats = computePoolStats({ lines, basis: "perGame", poolSize: 6, range: "all" });

describe("scoreSimValue", () => {
  it("is deterministic — the same player always simulates the same weeks", () => {
    const first = scoreSimValue({ lines, poolStats, config: config() });
    const second = scoreSimValue({ lines, poolStats, config: config() });
    expect(first.map((value) => value.total)).toEqual(second.map((value) => value.total));
  });

  it("judges every player against the same simulated season", () => {
    // Two identical lines under different ids must score identically; if each
    // player drew its own opponents they would differ by simulation luck.
    const twins = [
      makeStatLine({ playerId: 10, gamesPlayed: 10, pts: 300, reb: 110 }),
      makeStatLine({ playerId: 11, gamesPlayed: 10, pts: 300, reb: 110 }),
    ];
    const values = scoreSimValue({ lines: [...lines, ...twins], poolStats, config: config() });
    const first = values.find((value) => value.playerId === 10)?.total;
    const second = values.find((value) => value.playerId === 11)?.total;
    expect(first).toBe(second ?? Number.NaN);
  });

  it("values a stronger player above a weaker one", () => {
    const values = scoreSimValue({ lines, poolStats, config: config() });
    const best = values.find((value) => value.playerId === 1)?.total ?? 0;
    const worst = values.find((value) => value.playerId === 6)?.total ?? 0;
    expect(best).toBeGreaterThan(worst);
  });

  it("cannot add more category wins than there are categories", () => {
    const values = scoreSimValue({ lines, poolStats, config: config() });
    values.forEach((value) => {
      expect(value.total).toBeLessThanOrEqual(config().categories.length);
      expect(value.total).toBeGreaterThanOrEqual(-config().categories.length);
    });
  });

  it("pays nothing for a category punted to weight 0", () => {
    const values = scoreSimValue({
      lines,
      poolStats,
      config: config({ weights: { pts: 0, reb: 0 } }),
    });
    expect(values.every((value) => value.total === 0)).toBe(true);
  });

  it("reports a per-category marginal win rate, not a raw count", () => {
    const values = scoreSimValue({ lines, poolStats, config: config(), iterations: 100 });
    const best = values.find((value) => value.playerId === 1);
    const rate = best?.breakdown.pts?.raw ?? 0;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it("never pays for a player below the replacement band", () => {
    const values = scoreSimValue({ lines, poolStats, config: config() });
    // Player 6 is the weakest line in the pool — worse than what the waiver
    // wire offers — so rostering him cannot add category wins.
    const marginal = values.find((value) => value.playerId === 6)?.total ?? 0;
    expect(marginal).toBeLessThanOrEqual(0);
  });

  it("scales the payoff with how far above replacement a player is", () => {
    const values = scoreSimValue({ lines, poolStats, config: config() });
    const star = values.find((value) => value.playerId === 1)?.total ?? 0;
    const fringe = values.find((value) => value.playerId === 5)?.total ?? 0;
    expect(star).toBeGreaterThan(fringe);
  });
});
