import { describe, expect, it } from "bun:test";

import {
  defaultScoringConfig,
  isH2hCategoriesConfig,
  isH2hPointsConfig,
  isLeagueMutationResult,
  isLeagueScoringType,
  isRotoConfig,
  parseScoringConfig,
} from "@/lib/leagues/guards";
import type { LeagueScoringConfig } from "@/lib/leagues/types";

describe("isLeagueScoringType", () => {
  it("accepts the three scoring types", () => {
    expect(isLeagueScoringType("h2h_categories")).toBe(true);
    expect(isLeagueScoringType("h2h_points")).toBe(true);
    expect(isLeagueScoringType("roto")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isLeagueScoringType("dynasty")).toBe(false);
    expect(isLeagueScoringType("")).toBe(false);
  });
});

describe("isH2hCategoriesConfig", () => {
  it("accepts categories with optional weights", () => {
    expect(isH2hCategoriesConfig({ categories: ["pts", "reb"] })).toBe(true);
    expect(isH2hCategoriesConfig({ categories: ["pts"], weights: { pts: 1.5 } })).toBe(true);
  });
  it("rejects empty, unknown, or malformed categories", () => {
    expect(isH2hCategoriesConfig({ categories: [] })).toBe(false);
    expect(isH2hCategoriesConfig({ categories: ["dunks"] })).toBe(false);
    expect(isH2hCategoriesConfig({ categories: ["pts"], weights: { pts: "high" } })).toBe(false);
    expect(isH2hCategoriesConfig(null)).toBe(false);
    expect(isH2hCategoriesConfig({ weights: {} })).toBe(false);
  });
});

describe("isH2hPointsConfig", () => {
  it("accepts a full scoring table", () => {
    expect(
      isH2hPointsConfig({
        scoring: { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, fg3m: 0, tov: -1 },
      }),
    ).toBe(true);
  });
  it("rejects missing keys and non-numbers", () => {
    expect(isH2hPointsConfig({ scoring: { pts: 1 } })).toBe(false);
    expect(isH2hPointsConfig({ scoring: { pts: "1" } })).toBe(false);
    expect(isH2hPointsConfig({})).toBe(false);
  });
});

describe("isRotoConfig", () => {
  it("accepts a category list", () => {
    expect(isRotoConfig({ categories: ["pts", "fg"] })).toBe(true);
  });
  it("rejects empty or unknown categories", () => {
    expect(isRotoConfig({ categories: [] })).toBe(false);
    expect(isRotoConfig({ categories: ["pts", "nope"] })).toBe(false);
  });
});

describe("parseScoringConfig", () => {
  it("returns a valid config unchanged", () => {
    const value: LeagueScoringConfig = { categories: ["pts", "reb"] };
    expect(parseScoringConfig({ scoringType: "h2h_categories", value })).toEqual(value);
  });
  it("falls back to the type default on invalid input", () => {
    expect(parseScoringConfig({ scoringType: "h2h_points", value: { junk: true } })).toEqual(
      defaultScoringConfig({ scoringType: "h2h_points" }),
    );
    expect(parseScoringConfig({ scoringType: "roto", value: null })).toEqual(
      defaultScoringConfig({ scoringType: "roto" }),
    );
  });
  it("rejects a config that belongs to a different scoring type", () => {
    expect(
      parseScoringConfig({ scoringType: "h2h_points", value: { categories: ["pts"] } }),
    ).toEqual(defaultScoringConfig({ scoringType: "h2h_points" }));
  });
});

describe("isLeagueMutationResult", () => {
  it("accepts every status arm", () => {
    const league = {
      id: "1",
      name: "A",
      slug: "a",
      scoringType: "roto",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
      createdAt: "2026-07-31T00:00:00.000Z",
    };
    expect(isLeagueMutationResult({ status: "ok", league })).toBe(true);
    expect(isLeagueMutationResult({ status: "limit" })).toBe(true);
    expect(isLeagueMutationResult({ status: "invalid" })).toBe(true);
    expect(isLeagueMutationResult({ status: "unauthenticated" })).toBe(true);
    expect(isLeagueMutationResult({ status: "error" })).toBe(true);
  });
  it("rejects ok without a league and unknown statuses", () => {
    expect(isLeagueMutationResult({ status: "ok" })).toBe(false);
    expect(isLeagueMutationResult({ status: "nope" })).toBe(false);
    expect(isLeagueMutationResult(null)).toBe(false);
  });
});
