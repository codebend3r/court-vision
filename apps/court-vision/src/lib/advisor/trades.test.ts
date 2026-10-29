import { describe, expect, it } from "bun:test";

import { player } from "@/lib/advisor/fixture";
import { buildTradeOffers, marginFor, OFFERS_PER_TIER } from "@/lib/advisor/trades";
import { type TradeGroup } from "@/lib/advisor/types";

const OTHER = { kind: "team", teamId: "t2", teamName: "Two", managerName: null } as const;
const TARGET = player({ playerId: 100, value: 8, categoryScore: 3, owner: OTHER });

// A margin of 2 on a target worth 8: fair is a balance within 2 of even,
// favors me under -2 (aiming at -3), favors them over 2 (aiming at 3).
const ROSTER = [
  player({ playerId: 1, value: 8 }),
  player({ playerId: 2, value: 5 }),
  player({ playerId: 3, value: 6 }),
  player({ playerId: 4, value: 5.5 }),
  player({ playerId: 5, value: 1 }),
];

type IdsOfProps = { groups: readonly TradeGroup[]; tier: TradeGroup["tier"] };

const idsOf = ({ groups, tier }: IdsOfProps): number[][] =>
  groups
    .find((group) => group.tier === tier)
    ?.offers.map((offer) => offer.give.map(({ playerId }) => playerId)) ?? [];

describe("marginFor", () => {
  it("is a quarter of the target's value, at least half a point", () => {
    expect(marginFor({ target: TARGET })).toBe(2);
    expect(marginFor({ target: player({ playerId: 1, value: 1 }) })).toBe(0.5);
    expect(marginFor({ target: player({ playerId: 1, value: -4 }) })).toBe(1);
  });
});

describe("buildTradeOffers", () => {
  const groups = buildTradeOffers({ target: TARGET, myRoster: ROSTER });

  it("gives every tier three options, in display order", () => {
    expect(groups.map(({ tier }) => tier)).toEqual(["favors_me", "fair", "favors_them"]);
    expect(groups.every(({ offers }) => offers.length === OFFERS_PER_TIER)).toBe(true);
  });

  it("ranks each tier by distance from its aim", () => {
    expect(idsOf({ groups, tier: "favors_me" })).toEqual([[2], [4], [5]]);
    expect(idsOf({ groups, tier: "fair" })).toEqual([[1], [1, 5], [3, 5]]);
    expect(idsOf({ groups, tier: "favors_them" })).toEqual([
      [2, 3],
      [2, 4],
      [3, 4],
    ]);
  });

  it("reads in order of value given, rows never overlapping", () => {
    const balances = (tier: TradeGroup["tier"]) =>
      groups.find((group) => group.tier === tier)?.offers.map(({ balance }) => balance) ?? [];
    expect(Math.max(...balances("favors_me"))).toBeLessThanOrEqual(Math.min(...balances("fair")));
    expect(Math.max(...balances("fair"))).toBeLessThanOrEqual(Math.min(...balances("favors_them")));
  });

  it("fills every row from a roster too thin to overpay, flagging what misses", () => {
    // Every package is worth less than the target.
    const thin = buildTradeOffers({
      target: player({ playerId: 100, value: 4, owner: OTHER }),
      myRoster: [2.2, -1.1, -3.9, 0.5].map((value, index) =>
        player({ playerId: index + 1, value }),
      ),
    });
    expect(thin.map(({ offers }) => offers.length)).toEqual([3, 3, 3]);
    const them = thin.find((group) => group.tier === "favors_them")?.offers ?? [];
    expect(them.every(({ reachesTier, balance }) => !reachesTier && balance < 0)).toBe(true);
    const fairBalances =
      thin.find((group) => group.tier === "fair")?.offers.map((o) => o.balance) ?? [];
    expect(Math.max(...fairBalances)).toBeLessThanOrEqual(Math.min(...them.map((o) => o.balance)));
  });

  it("lets a package level with fair's edge join a side row", () => {
    // Three trios are worth exactly the target; one takes fair, the others favor them.
    const level = buildTradeOffers({
      target: player({ playerId: 100, value: 9, owner: OTHER }),
      myRoster: [4, 4, 4, 1].map((value, index) => player({ playerId: index + 1, value })),
    });
    expect(level.map(({ offers }) => offers.length)).toEqual([3, 3, 3]);
  });

  it("keeps every option in its band when the roster can, and never repeats a package", () => {
    const offers = groups.flatMap(({ offers: tierOffers }) => tierOffers);
    expect(offers.every(({ reachesTier }) => reachesTier)).toBe(true);
    const keys = offers.map(({ give }) => give.map(({ playerId }) => playerId).join(","));
    expect(new Set(keys).size).toBe(offers.length);
  });

  it("reaches an overpay with a trio when no pair can", () => {
    const thin = buildTradeOffers({
      target: player({ playerId: 100, value: 9, owner: OTHER }),
      myRoster: [4, 4, 4, 1].map((value, index) => player({ playerId: index + 1, value })),
    });
    const them = thin.find((group) => group.tier === "favors_them")?.offers ?? [];
    expect(them[0]?.give).toHaveLength(3);
    expect(them[0]?.reachesTier).toBe(true);
  });

  it("would rather not give away the category being fixed", () => {
    const rebounder = player({ playerId: 7, value: 8, categoryScore: 4 });
    const other = player({ playerId: 8, value: 7.5, categoryScore: -1 });
    const fair = buildTradeOffers({ target: TARGET, myRoster: [rebounder, other] }).find(
      (group) => group.tier === "fair",
    );
    expect(fair?.offers[0]?.give.map(({ playerId }) => playerId)).toEqual([8]);
    expect(fair?.offers[0]?.categoryChange).toBe(4);
  });

  it("has empty tiers for an empty roster", () => {
    expect(
      buildTradeOffers({ target: TARGET, myRoster: [] }).flatMap(({ offers }) => offers),
    ).toEqual([]);
  });
});
