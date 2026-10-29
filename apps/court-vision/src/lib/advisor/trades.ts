import { type AdvisorPlayer, type TradeOffer, type TradeTier } from "@/lib/advisor/types";

// How far past even the lopsided offers aim, in margins, and the smallest
// margin, so a low-value target still gets three different offers.
const LOPSIDED_MARGINS = 1.5;
const MARGIN_SHARE = 0.25;
const MIN_MARGIN = 0.5;
// Giving away the weak category's production costs this much per point, and
// each extra player in a package this share of a margin.
const CATEGORY_COST = 0.5;
const EXTRA_PLAYER_COST = 0.25;
// A lopsided offer on the wrong side of even costs this many margins.
const WRONG_SIDE_MARGINS = 10;
// Each tier's cheapest packages that the joint choice considers.
const SHORTLIST = 8;

const TIER_ORDER: readonly TradeTier[] = ["fair", "favors_me", "favors_them"];
const SHOWN_ORDER: readonly TradeTier[] = ["favors_me", "fair", "favors_them"];

type Package = { give: AdvisorPlayer[]; key: string; value: number; categoryScore: number };
type Choice = { tier: TradeTier; pkg: Package; cost: number };

const toPackage = (give: AdvisorPlayer[]): Package => ({
  give,
  key: give
    .map((player) => player.playerId)
    .toSorted((a, b) => a - b)
    .join(","),
  value: give.reduce((sum, player) => sum + player.value, 0),
  categoryScore: give.reduce((sum, player) => sum + player.categoryScore, 0),
});

// Every single player and every pair.
type PackagesOfProps = { roster: readonly AdvisorPlayer[] };

const packagesOf = ({ roster }: PackagesOfProps): Package[] => [
  ...roster.map((player) => toPackage([player])),
  ...roster.flatMap((first, index) =>
    roster.slice(index + 1).map((second) => toPackage([first, second])),
  ),
];

/** A quarter of the target's value, never under half a point. */
type MarginForProps = { target: AdvisorPlayer };

export const marginFor = ({ target }: MarginForProps): number =>
  Math.max(MIN_MARGIN, Math.abs(target.value) * MARGIN_SHARE);

/**
 * Three trades for a player on another team, as distinct packages of one or
 * two of my healthy players: one that favours me (I give about 1.5 margins
 * less value than I get), one that is even, and one that favours them (about
 * 1.5 margins more). A package that gives away weak-category production, or
 * more players, costs extra, so the offers keep what the trade is for, and a
 * lopsided offer on the wrong side of even costs most of all. The three are
 * chosen together, from each tier's cheapest few, at the lowest total cost.
 * Fewer than three only when my roster has fewer than three packages.
 */
type BuildTradeOffersProps = {
  target: AdvisorPlayer;
  myRoster: readonly AdvisorPlayer[];
};

export const buildTradeOffers = ({ target, myRoster }: BuildTradeOffersProps): TradeOffer[] => {
  const margin = marginFor({ target });
  const aims: Record<TradeTier, number> = {
    favors_me: -LOPSIDED_MARGINS * margin,
    fair: 0,
    favors_them: LOPSIDED_MARGINS * margin,
  };
  const onSide: Record<TradeTier, (balance: number) => boolean> = {
    favors_me: (balance) => balance < 0,
    fair: () => true,
    favors_them: (balance) => balance > 0,
  };
  type CostOfProps = { pkg: Package; tier: TradeTier };

  const costOf = ({ pkg, tier }: CostOfProps): number => {
    const balance = pkg.value - target.value;
    return (
      Math.abs(balance - aims[tier]) +
      CATEGORY_COST * Math.max(0, pkg.categoryScore) +
      EXTRA_PLAYER_COST * margin * (pkg.give.length - 1) +
      (onSide[tier](balance) ? 0 : WRONG_SIDE_MARGINS * margin)
    );
  };

  const packages = packagesOf({ roster: myRoster });
  const shortlist = (tier: TradeTier): Choice[] =>
    packages
      .map((pkg) => ({ tier, pkg, cost: costOf({ pkg, tier }) }))
      .toSorted((a, b) => a.cost - b.cost || a.pkg.key.localeCompare(b.pkg.key))
      .slice(0, SHORTLIST);

  // Every way to give each tier its own package, cheapest overall first. A
  // roster too small for three distinct packages fills as many tiers as it can.
  const combos = TIER_ORDER.reduce<Choice[][]>(
    (partials, tier) => {
      const extended = partials.flatMap((partial) =>
        shortlist(tier)
          .filter((choice) => !partial.some((entry) => entry.pkg.key === choice.pkg.key))
          .map((choice) => [...partial, choice]),
      );
      return extended.length ? extended : partials;
    },
    [[]],
  );
  const totalOf = (combo: readonly Choice[]): number =>
    combo.reduce((sum, choice) => sum + choice.cost, 0);
  const best = combos.toSorted((a, b) => b.length - a.length || totalOf(a) - totalOf(b))[0] ?? [];

  return SHOWN_ORDER.flatMap((tier) => {
    const entry = best.find((candidate) => candidate.tier === tier);
    return entry === undefined
      ? []
      : [
          {
            tier,
            give: entry.pkg.give,
            get: target,
            balance: entry.pkg.value - target.value,
            categoryChange: target.categoryScore - entry.pkg.categoryScore,
          },
        ];
  });
};
