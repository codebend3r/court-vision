import { describe, expect, it } from "bun:test";

import {
  defaultScoringConfig,
  isLeagueScoringType,
  parseScoringConfig,
  scoringConfigGuards,
} from "#core/league/scoring";
import { basketballFixture as sport } from "#core/testing/basketball";

const { isH2hCategoriesConfig, isH2hPointsConfig, isRotoConfig } = scoringConfigGuards({ sport });
const POINTS = { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, fg3m: 0, tov: -1 };

describe("isLeagueScoringType", () => {
  it("accepts the three scoring types only", () => {
    expect(isLeagueScoringType("roto")).toBe(true);
    expect(isLeagueScoringType("h2h_points")).toBe(true);
    expect(isLeagueScoringType("points")).toBe(false);
  });
});

describe("scoringConfigGuards", () => {
  it("accepts category configs over the sport's own categories, with optional weights", () => {
    expect(isH2hCategoriesConfig({ categories: ["pts", "fg"] })).toBe(true);
    expect(isH2hCategoriesConfig({ categories: ["pts"], weights: { pts: 2 } })).toBe(true);
    expect(isH2hCategoriesConfig({ categories: ["goals"] })).toBe(false);
    expect(isH2hCategoriesConfig({ categories: [] })).toBe(false);
    expect(isH2hCategoriesConfig({ categories: ["pts"], weights: { pts: "2" } })).toBe(false);
  });

  it("needs every scoring key, finite, for a points config", () => {
    expect(isH2hPointsConfig({ scoring: POINTS })).toBe(true);
    expect(isH2hPointsConfig({ scoring: { ...POINTS, tov: Number.NaN } })).toBe(false);
    expect(isH2hPointsConfig({ scoring: { pts: 1 } })).toBe(false);
  });

  it("rejects weights on a roto config", () => {
    expect(isRotoConfig({ categories: ["pts"] })).toBe(true);
    expect(isRotoConfig({ categories: ["pts"], weights: {} })).toBe(false);
  });
});

describe("parseScoringConfig", () => {
  it("keeps a valid stored config", () => {
    expect(
      parseScoringConfig({ sport, scoringType: "roto", value: { categories: ["reb"] } }),
    ).toEqual({ categories: ["reb"] });
  });

  it("falls back to the scoring type's default for anything malformed", () => {
    expect(parseScoringConfig({ sport, scoringType: "h2h_points", value: null })).toEqual({
      scoring: POINTS,
    });
    expect(parseScoringConfig({ sport, scoringType: "roto", value: { categories: [] } })).toEqual(
      defaultScoringConfig({ sport, scoringType: "roto" }),
    );
  });

  it("defaults category leagues to every category in table order", () => {
    expect(defaultScoringConfig({ sport, scoringType: "h2h_categories" })).toEqual({
      categories: ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"],
    });
  });
});
