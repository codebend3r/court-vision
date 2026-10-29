import { describe, expect, it } from "bun:test";

import { player } from "@/lib/advisor/fixture";
import { findTargets, median, TARGET_LIMIT } from "@/lib/advisor/target";

const OTHER = { kind: "team", teamId: "t2", teamName: "Two", managerName: null } as const;

describe("median", () => {
  it("takes the middle value, or the mean of the middle two", () => {
    expect(median({ values: [3, 1, 2] })).toBe(2);
    expect(median({ values: [4, 1, 2, 3] })).toBe(2.5);
    expect(median({ values: [] })).toBeNull();
  });
});

describe("findTargets", () => {
  const myRoster = [player({ playerId: 1, value: 2 }), player({ playerId: 2, value: 4 })];

  it("ranks players worth my median or more by the focus score, then the rest", () => {
    const specialist = player({ playerId: 10, value: 1, categoryScore: 5, owner: OTHER });
    const allRounder = player({ playerId: 11, value: 6, categoryScore: 3, owner: OTHER });
    const freeAgent = player({
      playerId: 12,
      value: 3,
      categoryScore: 2,
      owner: { kind: "free_agent" },
    });
    expect(
      findTargets({ candidates: [specialist, allRounder, freeAgent], myRoster }).map(
        ({ playerId }) => playerId,
      ),
    ).toEqual([11, 12, 10]);
  });

  it("breaks a focus tie by value", () => {
    const low = player({ playerId: 10, value: 3, categoryScore: 3, owner: OTHER });
    const high = player({ playerId: 11, value: 7, categoryScore: 3, owner: OTHER });
    expect(findTargets({ candidates: [low, high], myRoster })[0]).toBe(high);
  });

  it("stops at five", () => {
    const candidates = [10, 11, 12, 13, 14, 15, 16].map((playerId) =>
      player({ playerId, value: 5, categoryScore: playerId, owner: OTHER }),
    );
    const targets = findTargets({ candidates, myRoster });
    expect(targets).toHaveLength(TARGET_LIMIT);
    expect(targets[0]?.playerId).toBe(16);
  });

  it("has no targets without candidates", () => {
    expect(findTargets({ candidates: [], myRoster })).toEqual([]);
  });
});
