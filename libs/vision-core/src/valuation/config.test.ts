import { describe, expect, it } from "bun:test";

import { basketballFixture } from "#core/testing/basketball";
import { defaultValuationConfig } from "#core/valuation/config";

describe("defaultValuationConfig", () => {
  it("includes every category unweighted, per game, in the default league", () => {
    expect(defaultValuationConfig({ sport: basketballFixture })).toEqual({
      categories: ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"],
      weights: {},
      basis: "perGame",
      teams: 12,
      rosterSlots: 13,
      scoring: { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, fg3m: 0, tov: -1 },
    });
  });

  it("hands out a scoring table the caller may change without touching the sport", () => {
    const config = defaultValuationConfig({ sport: basketballFixture });
    expect(config.scoring).not.toBe(basketballFixture.points.defaults);
  });
});
