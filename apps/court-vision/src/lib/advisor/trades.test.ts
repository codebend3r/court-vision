import { describe, expect, it } from "bun:test";

import { player } from "@/lib/advisor/fixture";
import { buildTradeOffers, marginFor } from "@/lib/advisor/trades";

const OTHER = { kind: "team", teamId: "t2", teamName: "Two", managerName: null } as const;
const TARGET = player({ playerId: 100, value: 8, categoryScore: 3, owner: OTHER });

// A margin of 2 on a target worth 8, so the lopsided offers aim at 5 and 11.
const ROSTER = [
  player({ playerId: 1, value: 8 }),
  player({ playerId: 2, value: 5 }),
  player({ playerId: 3, value: 6 }),
  player({ playerId: 4, value: 5.5 }),
  player({ playerId: 5, value: 1 }),
];

type IdsOfProps = { give: { playerId: number }[] } | undefined;

const idsOf = (offer: IdsOfProps): number[] => offer?.give.map(({ playerId }) => playerId) ?? [];

describe("marginFor", () => {
  it("is a quarter of the target's value, at least half a point", () => {
    expect(marginFor({ target: TARGET })).toBe(2);
    expect(marginFor({ target: player({ playerId: 1, value: 1 }) })).toBe(0.5);
    expect(marginFor({ target: player({ playerId: 1, value: -4 }) })).toBe(1);
  });
});

describe("buildTradeOffers", () => {
  it("offers one trade per tier, shown favours-me first", () => {
    const offers = buildTradeOffers({ target: TARGET, myRoster: ROSTER });
    expect(offers.map(({ tier }) => tier)).toEqual(["favors_me", "fair", "favors_them"]);
  });

  it("aims each tier at its balance", () => {
    const [favorsMe, fair, favorsThem] = buildTradeOffers({ target: TARGET, myRoster: ROSTER });
    expect(idsOf(fair)).toEqual([1]);
    expect(fair?.balance).toBe(0);
    expect(idsOf(favorsMe)).toEqual([2]);
    expect(favorsMe?.balance).toBe(-3);
    // 6 + 5 = 11 beats any single player for the high side.
    expect(idsOf(favorsThem)).toEqual([2, 3]);
    expect(favorsThem?.balance).toBe(3);
  });

  it("never repeats a package", () => {
    const offers = buildTradeOffers({ target: TARGET, myRoster: ROSTER.slice(0, 2) });
    const keys = offers.map((offer) => idsOf(offer).toSorted().join(","));
    expect(new Set(keys).size).toBe(keys.length);
    expect(offers).toHaveLength(3);
  });

  it("would rather not give away the category being fixed", () => {
    const rebounder = player({ playerId: 7, value: 8, categoryScore: 4 });
    const other = player({ playerId: 8, value: 7.5, categoryScore: -1 });
    const bench = player({ playerId: 9, value: 4 });
    const [, fair] = buildTradeOffers({ target: TARGET, myRoster: [rebounder, other, bench] });
    expect(idsOf(fair)).toEqual([8]);
    expect(fair?.categoryChange).toBe(4);
  });

  it("keeps the lopsided offers on their own side of even", () => {
    const offers = buildTradeOffers({
      target: TARGET,
      myRoster: [player({ playerId: 1, value: 7 }), player({ playerId: 2, value: 9 })],
    });
    expect(offers.find((offer) => offer.tier === "favors_me")?.balance).toBeLessThan(0);
    expect(offers.find((offer) => offer.tier === "favors_them")?.balance).toBeGreaterThan(0);
  });

  it("has nothing to offer from an empty roster", () => {
    expect(buildTradeOffers({ target: TARGET, myRoster: [] })).toEqual([]);
  });
});
