import { describe, expect, it } from "vitest";

import {
  CATEGORY_KEYS,
  CATEGORY_META,
  categoryValue,
  isCategory,
} from "@/lib/valuation/categories";
import { makeStatLine } from "@/lib/valuation/fixtures";
import type { FantasyStatLine } from "@/lib/valuation/types";

const line = (overrides: Partial<FantasyStatLine> = {}): FantasyStatLine =>
  makeStatLine({
    playerId: 1,
    gamesPlayed: 10,
    minutes: 300,
    pts: 200,
    reb: 50,
    ast: 40,
    stl: 12,
    blk: 8,
    fg3m: 20,
    tov: 30,
    fgm: 80,
    fga: 160,
    ftm: 20,
    fta: 25,
    ...overrides,
  });

describe("CATEGORY_META", () => {
  it("defines all nine categories in table order with complete metadata", () => {
    expect(CATEGORY_META.map((meta) => meta.key)).toEqual([
      "pts",
      "reb",
      "ast",
      "stl",
      "blk",
      "tpm",
      "tov",
      "fg",
      "ft",
    ]);
    CATEGORY_META.forEach((meta) => {
      expect(meta.label).not.toBe("");
      expect(meta.fullName).not.toBe("");
      expect(meta.description).not.toBe("");
      expect(meta.formula).not.toBe("");
    });
    expect(new Set(CATEGORY_META.map((meta) => meta.label)).size).toBe(CATEGORY_META.length);
  });

  it("keeps CATEGORY_KEYS in sync with CATEGORY_META", () => {
    expect(CATEGORY_KEYS).toEqual(CATEGORY_META.map((meta) => meta.key));
  });
});

describe("isCategory", () => {
  it("accepts every category key and rejects other strings", () => {
    CATEGORY_KEYS.forEach((key) => {
      expect(isCategory(key)).toBe(true);
    });
    expect(isCategory("pie")).toBe(false);
    expect(isCategory("")).toBe(false);
  });
});

describe("categoryValue", () => {
  const league = { leagueFgPct: 0.47, leagueFtPct: 0.78 };

  it("returns counting totals under the total basis", () => {
    expect(categoryValue({ line: line(), category: "pts", basis: "total", ...league })).toBe(200);
  });

  it("returns counting per-game rates under the perGame basis", () => {
    expect(categoryValue({ line: line(), category: "pts", basis: "perGame", ...league })).toBe(20);
  });

  it("maps tpm to made threes", () => {
    expect(categoryValue({ line: line(), category: "tpm", basis: "total", ...league })).toBe(20);
  });

  it("negates turnovers so higher is better", () => {
    expect(categoryValue({ line: line(), category: "tov", basis: "total", ...league })).toBe(-30);
    expect(categoryValue({ line: line(), category: "tov", basis: "perGame", ...league })).toBe(-3);
  });

  it("computes the volume-weighted ratio impact", () => {
    // fga * (fgm/fga - leagueFgPct) = 160 * (0.5 - 0.47) = 4.8
    expect(categoryValue({ line: line(), category: "fg", basis: "total", ...league })).toBeCloseTo(
      4.8,
      10,
    );
    // per game: (160/10) * (0.5 - 0.47) = 0.48
    expect(
      categoryValue({ line: line(), category: "fg", basis: "perGame", ...league }),
    ).toBeCloseTo(0.48, 10);
    // fta * (ftm/fta - leagueFtPct) = 25 * (0.8 - 0.78) = 0.5
    expect(categoryValue({ line: line(), category: "ft", basis: "total", ...league })).toBeCloseTo(
      0.5,
      10,
    );
  });

  it("returns a neutral 0 impact for zero attempts", () => {
    const noShots = line({ fgm: 0, fga: 0, ftm: 0, fta: 0 });
    expect(categoryValue({ line: noShots, category: "fg", basis: "total", ...league })).toBe(0);
    expect(categoryValue({ line: noShots, category: "ft", basis: "perGame", ...league })).toBe(0);
  });

  it("returns 0 per-game values for players with no appearances", () => {
    const dnp = line({ gamesPlayed: 0 });
    expect(categoryValue({ line: dnp, category: "pts", basis: "perGame", ...league })).toBe(0);
    expect(categoryValue({ line: dnp, category: "fg", basis: "perGame", ...league })).toBe(0);
  });
});
