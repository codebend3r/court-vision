import { describe, expect, it } from "vitest";

import { parseEligibleGroups, positionalValues } from "@/lib/valuation/modifiers/positional";

describe("parseEligibleGroups", () => {
  it("parses single and hyphenated Balldontlie positions", () => {
    expect(parseEligibleGroups("G")).toEqual(["G"]);
    expect(parseEligibleGroups("F-C")).toEqual(["F", "C"]);
    expect(parseEligibleGroups("G-F")).toEqual(["G", "F"]);
  });

  it("ignores unknown fragments and null", () => {
    expect(parseEligibleGroups(null)).toEqual([]);
    expect(parseEligibleGroups("")).toEqual([]);
    expect(parseEligibleGroups("PG")).toEqual([]);
  });
});

describe("positionalValues", () => {
  // 1 team → replacement ranks: G at 4, F at 4, C at 2.
  const players = [
    { playerId: 1, total: 10, position: "G" },
    { playerId: 2, total: 8, position: "G" },
    { playerId: 3, total: 6, position: "G" },
    { playerId: 4, total: 4, position: "G" },
    { playerId: 5, total: 9, position: "C" },
    { playerId: 6, total: 1, position: "C" },
  ];

  it("subtracts the per-position replacement level", () => {
    const values = positionalValues({ players, teams: 1, fallbackReplacement: 0 });
    // Guard replacement = 4th guard (total 4); center replacement = 2nd center (total 1).
    expect(values.get(1)).toBe(10 - 4);
    expect(values.get(5)).toBe(9 - 1);
  });

  it("values multi-eligible players at the slot with the lowest replacement level", () => {
    const multi = [...players, { playerId: 7, total: 7, position: "G-C" }];
    const values = positionalValues({ players: multi, teams: 1, fallbackReplacement: 0 });
    // With player 7 in both groups: guards rank 10,8,7,6,4 → 4th is 6;
    // centers rank 9,7,1 → 2nd is 7. Lowest replacement level is G's 6.
    expect(values.get(7)).toBe(7 - 6);
    // A pure center is still measured against the center level of 7.
    expect(values.get(5)).toBe(9 - 7);
  });

  it("falls back to the global replacement for unparseable positions", () => {
    const unknown = [...players, { playerId: 8, total: 5, position: null }];
    const values = positionalValues({ players: unknown, teams: 1, fallbackReplacement: 3 });
    expect(values.get(8)).toBe(5 - 3);
  });
});
