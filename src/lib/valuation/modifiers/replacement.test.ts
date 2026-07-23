import { describe, expect, it } from "vitest";

import { replacementLevel } from "@/lib/valuation/modifiers/replacement";

const totals = [
  { playerId: 1, total: 10 },
  { playerId: 2, total: 8 },
  { playerId: 3, total: 6 },
  { playerId: 4, total: 4 },
];

describe("replacementLevel", () => {
  it("returns the value of the player at the replacement rank", () => {
    expect(replacementLevel({ totals, rank: 3 })).toBe(6);
  });

  it("clamps ranks beyond the population to the last player", () => {
    expect(replacementLevel({ totals, rank: 99 })).toBe(4);
    expect(replacementLevel({ totals, rank: 0 })).toBe(10);
  });

  it("breaks total ties by playerId", () => {
    const tied = [
      { playerId: 2, total: 5 },
      { playerId: 1, total: 5 },
    ];
    expect(replacementLevel({ totals: tied, rank: 1 })).toBe(5);
  });

  it("returns 0 for an empty population", () => {
    expect(replacementLevel({ totals: [], rank: 5 })).toBe(0);
  });
});
