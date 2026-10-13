import { describe, expect, it } from "bun:test";

import { byTotalDescending } from "#core/valuation/rank";

describe("byTotalDescending", () => {
  it("puts the higher total first", () => {
    const sorted = [
      { playerId: 1, total: 2 },
      { playerId: 2, total: 5 },
      { playerId: 3, total: -1 },
    ].sort(byTotalDescending);
    expect(sorted.map((entry) => entry.playerId)).toEqual([2, 1, 3]);
  });

  it("breaks a tie by the lower player id", () => {
    const sorted = [
      { playerId: 9, total: 3 },
      { playerId: 4, total: 3 },
    ].sort(byTotalDescending);
    expect(sorted.map((entry) => entry.playerId)).toEqual([4, 9]);
  });
});
