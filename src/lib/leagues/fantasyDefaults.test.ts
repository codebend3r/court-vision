import { describe, expect, it } from "bun:test";

import { buildLeagueSeed, SORT_KEY_BY_METHOD } from "@/lib/leagues/fantasyDefaults";
import { type LeagueSummary } from "@/lib/leagues/types";

const base: LeagueSummary = {
  id: "a",
  name: "Alpha",
  slug: "alpha",
  scoringType: "h2h_categories",
  teamCount: 10,
  rosterSlots: 15,
  scoringConfig: { categories: ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg"] },
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
};

describe("buildLeagueSeed", () => {
  it("seeds teams/slots and excluded categories for a categories league", () => {
    const seed = buildLeagueSeed({ league: base, preferredFormula: null, presentKeys: new Set() });
    expect(seed.teams).toBe(10);
    expect(seed.slots).toBe(15);
    expect(seed.x).toEqual(["ft"]);
    expect(seed.sort).toBeUndefined();
  });

  it("never seeds a key already present in the URL", () => {
    const seed = buildLeagueSeed({
      league: base,
      preferredFormula: "gscore",
      presentKeys: new Set(["teams", "sort"]),
    });
    expect(seed.teams).toBeUndefined();
    expect(seed.sort).toBeUndefined();
    expect(seed.slots).toBe(15);
  });

  it("maps league weights onto every weighted method column", () => {
    const league: LeagueSummary = {
      ...base,
      scoringConfig: { categories: ["pts", "reb"], weights: { pts: 1.5 } },
    };
    const seed = buildLeagueSeed({ league, preferredFormula: null, presentKeys: new Set() });
    expect(seed.w?.z).toEqual({ pts: 1.5 });
    expect(seed.w?.sim).toEqual({ pts: 1.5 });
  });

  it("seeds the scoring table and points sort for a points league", () => {
    const league: LeagueSummary = {
      ...base,
      scoringType: "h2h_points",
      scoringConfig: { scoring: { pts: 1, reb: 2, ast: 1.5, stl: 3, blk: 3, fg3m: 0.5, tov: -1 } },
    };
    const seed = buildLeagueSeed({ league, preferredFormula: null, presentKeys: new Set() });
    expect(seed.s?.reb).toBe(2);
    expect(seed.sort).toBe("points");
  });

  it("preferred formula wins the sort seed", () => {
    const seed = buildLeagueSeed({
      league: base,
      preferredFormula: "positional",
      presentKeys: new Set(),
    });
    expect(seed.sort).toBe(SORT_KEY_BY_METHOD.positional);
  });

  it("returns an empty seed without a league beyond the formula sort", () => {
    const seed = buildLeagueSeed({
      league: null,
      preferredFormula: "zscore",
      presentKeys: new Set(),
    });
    expect(seed).toEqual({ sort: "z" });
  });
});
