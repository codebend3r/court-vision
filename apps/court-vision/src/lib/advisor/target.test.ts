import { describe, expect, it } from "bun:test";

import { player } from "@/lib/advisor/fixture";
import { findTarget, median } from "@/lib/advisor/target";

const OTHER = { kind: "team", teamId: "t2", teamName: "Two", managerName: null } as const;

describe("median", () => {
  it("takes the middle value, or the mean of the middle two", () => {
    expect(median({ values: [3, 1, 2] })).toBe(2);
    expect(median({ values: [4, 1, 2, 3] })).toBe(2.5);
    expect(median({ values: [] })).toBeNull();
  });
});

describe("findTarget", () => {
  const myRoster = [player({ playerId: 1, value: 2 }), player({ playerId: 2, value: 4 })];

  it("picks the best in the category among players worth my median or more", () => {
    const specialist = player({ playerId: 10, value: 1, categoryScore: 5, owner: OTHER });
    const allRounder = player({ playerId: 11, value: 6, categoryScore: 3, owner: OTHER });
    const freeAgent = player({
      playerId: 12,
      value: 3,
      categoryScore: 2,
      owner: { kind: "free_agent" },
    });
    expect(findTarget({ candidates: [specialist, allRounder, freeAgent], myRoster })).toBe(
      allRounder,
    );
  });

  it("breaks a category tie by value", () => {
    const low = player({ playerId: 10, value: 3, categoryScore: 3, owner: OTHER });
    const high = player({ playerId: 11, value: 7, categoryScore: 3, owner: OTHER });
    expect(findTarget({ candidates: [low, high], myRoster })).toBe(high);
  });

  it("falls back to the best in the category when nobody clears the bar", () => {
    const a = player({ playerId: 10, value: 1, categoryScore: 5, owner: OTHER });
    const b = player({ playerId: 11, value: 0, categoryScore: 1, owner: OTHER });
    expect(findTarget({ candidates: [b, a], myRoster })).toBe(a);
  });

  it("has no target without candidates", () => {
    expect(findTarget({ candidates: [], myRoster })).toBeNull();
  });
});
