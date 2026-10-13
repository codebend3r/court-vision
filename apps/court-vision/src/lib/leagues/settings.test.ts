import { describe, expect, it } from "bun:test";

import {
  clampInt,
  clampScore,
  LEAGUE_BOUNDS,
  normalizeCount,
  normalizeScore,
  normalizeWeight,
  SCORING_TYPE_LABELS,
  SCORING_TYPES,
  snapWeight,
  withoutWeight,
} from "@/lib/leagues/settings";
import { DEFAULT_POINTS_SCORING, DEFAULT_VALUATION_CONFIG } from "@vision/sport-basketball/engine";

describe("LEAGUE_BOUNDS", () => {
  it("falls back to the sport's standard league size", () => {
    expect(LEAGUE_BOUNDS.teams).toEqual({ min: 2, max: 30, fallback: 12 });
    expect(LEAGUE_BOUNDS.slots).toEqual({ min: 1, max: 25, fallback: 13 });
    expect(LEAGUE_BOUNDS.teams.fallback).toBe(DEFAULT_VALUATION_CONFIG.teams);
    expect(LEAGUE_BOUNDS.slots.fallback).toBe(DEFAULT_VALUATION_CONFIG.rosterSlots);
  });
});

describe("clampInt", () => {
  it("clamps a whole number into the bounds", () => {
    expect(clampInt({ value: 99, ...LEAGUE_BOUNDS.teams })).toBe(30);
    expect(clampInt({ value: 0, ...LEAGUE_BOUNDS.teams })).toBe(2);
    expect(clampInt({ value: 8, ...LEAGUE_BOUNDS.teams })).toBe(8);
  });

  it("returns the fallback for anything that is not a safe integer", () => {
    expect(clampInt({ value: Number.NaN, ...LEAGUE_BOUNDS.teams })).toBe(12);
    expect(clampInt({ value: 2.5, ...LEAGUE_BOUNDS.slots })).toBe(13);
    expect(clampInt({ value: Number.POSITIVE_INFINITY, ...LEAGUE_BOUNDS.slots })).toBe(13);
  });
});

describe("normalizeCount", () => {
  it("parses and clamps a typed count", () => {
    expect(normalizeCount({ raw: "99", bounds: LEAGUE_BOUNDS.teams })).toBe(30);
    expect(normalizeCount({ raw: "10", bounds: LEAGUE_BOUNDS.slots })).toBe(10);
  });

  it("falls back to the standard league on a cleared or missing box", () => {
    expect(normalizeCount({ raw: "", bounds: LEAGUE_BOUNDS.teams })).toBe(12);
    expect(normalizeCount({ raw: null, bounds: LEAGUE_BOUNDS.slots })).toBe(13);
  });
});

describe("snapWeight", () => {
  it("clamps to [0, 2]", () => {
    expect(snapWeight({ value: -1 })).toBe(0);
    expect(snapWeight({ value: 5 })).toBe(2);
  });

  it("snaps to 0.25 steps", () => {
    expect(snapWeight({ value: 0.6 })).toBe(0.5);
    expect(snapWeight({ value: 0.63 })).toBe(0.75);
    expect(snapWeight({ value: 1.1 })).toBe(1);
  });

  it("treats NaN as the default weight", () => {
    expect(snapWeight({ value: Number.NaN })).toBe(1);
  });
});

describe("normalizeWeight", () => {
  it("parses and snaps a typed weight", () => {
    expect(normalizeWeight({ raw: "0.6" })).toBe(0.5);
  });

  it("reads a cleared or missing box as the default weight", () => {
    expect(normalizeWeight({ raw: "" })).toBe(1);
    expect(normalizeWeight({ raw: null })).toBe(1);
  });
});

describe("clampScore", () => {
  it("clamps to [-10, 10] and rounds to hundredths", () => {
    expect(clampScore({ value: 12 })).toBe(10);
    expect(clampScore({ value: -12 })).toBe(-10);
    expect(clampScore({ value: 1.234 })).toBe(1.23);
  });
});

describe("normalizeScore", () => {
  it("parses and clamps a typed score", () => {
    expect(normalizeScore({ raw: "-2.5", stat: "tov" })).toBe(-2.5);
    expect(normalizeScore({ raw: "40", stat: "pts" })).toBe(10);
  });

  it("restores the stat's default on a cleared or missing box", () => {
    expect(normalizeScore({ raw: "", stat: "reb" })).toBe(DEFAULT_POINTS_SCORING.reb);
    expect(normalizeScore({ raw: null, stat: "stl" })).toBe(DEFAULT_POINTS_SCORING.stl);
  });
});

describe("withoutWeight", () => {
  it("drops one category's weight and keeps the rest", () => {
    expect(withoutWeight({ weights: { pts: 0, ft: 0.5 }, category: "pts" })).toEqual({ ft: 0.5 });
  });

  it("returns the weights unchanged when the category has none", () => {
    expect(withoutWeight({ weights: { ft: 0.5 }, category: "ast" })).toEqual({ ft: 0.5 });
  });
});

describe("SCORING_TYPES", () => {
  it("labels every scoring type, in the form's order", () => {
    expect(SCORING_TYPES.map((type) => SCORING_TYPE_LABELS[type])).toEqual([
      "H2H Categories",
      "H2H Points",
      "Rotisserie",
    ]);
  });
});
