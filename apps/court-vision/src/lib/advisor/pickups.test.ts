import { describe, expect, it } from "bun:test";

import { player } from "@/lib/advisor/fixture";
import { pickDrop, pickFreeAgents } from "@/lib/advisor/pickups";

const FREE = { kind: "free_agent" } as const;

describe("pickDrop", () => {
  it("drops the lowest value, protecting the weak category", () => {
    const rebounder = player({ playerId: 1, value: 0.5, categoryScore: 2 });
    const filler = player({ playerId: 2, value: 1 });
    const star = player({ playerId: 3, value: 6 });
    expect(pickDrop({ myRoster: [rebounder, filler, star] })).toBe(filler);
  });

  it("has nobody to drop from an empty roster", () => {
    expect(pickDrop({ myRoster: [] })).toBeNull();
  });
});

describe("pickFreeAgents", () => {
  const drop = player({ playerId: 1, value: 1 });

  it("lists up to five upgrades, best in the category first", () => {
    const pool = [2, 3, 4, 5, 6, 7].map((playerId) =>
      player({ playerId, value: 2, categoryScore: playerId, owner: FREE }),
    );
    const picks = pickFreeAgents({ freePool: pool, drop });
    expect(picks.map(({ playerId }) => playerId)).toEqual([7, 6, 5, 4, 3]);
    expect(picks.every(({ isUpgrade }) => isUpgrade)).toBe(true);
    expect(picks[0]?.gainOverDrop).toBe(1);
  });

  it("fills to two with category help that is no overall upgrade", () => {
    const upgrade = player({ playerId: 2, value: 3, categoryScore: 1, owner: FREE });
    const specialist = player({ playerId: 3, value: 0, categoryScore: 4, owner: FREE });
    const other = player({ playerId: 4, value: -1, categoryScore: 2, owner: FREE });
    const picks = pickFreeAgents({ freePool: [other, specialist, upgrade], drop });
    expect(picks.map(({ playerId, isUpgrade }) => [playerId, isUpgrade])).toEqual([
      [2, true],
      [3, false],
    ]);
  });

  it("counts everyone as an upgrade with nobody to drop", () => {
    const picks = pickFreeAgents({
      freePool: [player({ playerId: 2, value: -3, owner: FREE })],
      drop: null,
    });
    expect(picks).toEqual([expect.objectContaining({ isUpgrade: true, gainOverDrop: null })]);
  });
});
