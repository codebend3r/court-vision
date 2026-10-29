import {
  type AdvisorPlayer,
  type TradeGroup,
  type TradeOffer,
  type TradeTier,
} from "@/lib/advisor/types";

// A margin is a quarter of the target's value, never under half a point, so a
// low-value target still spreads its offers. Fair is within one margin of
// even; the lopsided tiers sit beyond it and aim 1.5 margins out.
const MARGIN_SHARE = 0.25;
const MIN_MARGIN = 0.5;
const LOPSIDED_MARGINS = 1.5;
// Giving away the weak category's production costs this much per point, and
// each extra player in a package this share of a margin.
const CATEGORY_COST = 0.5;
const EXTRA_PLAYER_COST = 0.25;
// Options shown per tier.
export const OFFERS_PER_TIER = 3;

export const TRADE_TIERS: readonly TradeTier[] = ["favors_me", "fair", "favors_them"];

type Package = { give: AdvisorPlayer[]; key: string; value: number; categoryScore: number };

const toPackage = (give: AdvisorPlayer[]): Package => ({
  give,
  key: give
    .map((player) => player.playerId)
    .toSorted((a, b) => a - b)
    .join(","),
  value: give.reduce((sum, player) => sum + player.value, 0),
  categoryScore: give.reduce((sum, player) => sum + player.categoryScore, 0),
});

// Every single player, pair and trio: a trio is how a thin roster reaches an
// overpay for a star.
type PackagesOfProps = { roster: readonly AdvisorPlayer[] };

const packagesOf = ({ roster }: PackagesOfProps): Package[] => [
  ...roster.map((player) => toPackage([player])),
  ...roster.flatMap((first, i) => roster.slice(i + 1).map((second) => toPackage([first, second]))),
  ...roster.flatMap((first, i) =>
    roster
      .slice(i + 1)
      .flatMap((second, j) =>
        roster.slice(i + j + 2).map((third) => toPackage([first, second, third])),
      ),
  ),
];

/** A quarter of the target's value, at least half a point. */
type MarginForProps = { target: AdvisorPlayer };

export const marginFor = ({ target }: MarginForProps): number =>
  Math.max(MIN_MARGIN, Math.abs(target.value) * MARGIN_SHARE);

/**
 * Up to three trades per tier for a player on another team, every one a
 * distinct package of one to three of my healthy players. Each tier has a
 * band of value balance (what I give minus what I get): favors me under minus
 * one margin, fair within one margin of even, favors them over one margin.
 * Fair takes the three nearest even, leaving the three cheapest and three
 * richest packages for the other rows. Favors me then picks from packages
 * worth less than every fair one, and favors them from packages worth more,
 * each in band first (by distance from an aim 1.5 margins out) and then the
 * furthest toward its side, so the rows always read in order of value given.
 * Giving away the weak category, and each extra player, costs extra.
 * `reachesTier` is false for an offer outside its tier's band.
 */
type BuildTradeOffersProps = {
  target: AdvisorPlayer;
  myRoster: readonly AdvisorPlayer[];
};

export const buildTradeOffers = ({ target, myRoster }: BuildTradeOffersProps): TradeGroup[] => {
  const margin = marginFor({ target });
  const balanceOf = (pkg: Package): number => pkg.value - target.value;
  const aims: Record<TradeTier, number> = {
    favors_me: -LOPSIDED_MARGINS * margin,
    fair: 0,
    favors_them: LOPSIDED_MARGINS * margin,
  };
  const inBand: Record<TradeTier, (balance: number) => boolean> = {
    favors_me: (balance) => balance < -margin,
    fair: (balance) => Math.abs(balance) <= margin,
    favors_them: (balance) => balance > margin,
  };
  type CostOfProps = { pkg: Package; tier: TradeTier };

  const costOf = ({ pkg, tier }: CostOfProps): number =>
    Math.abs(balanceOf(pkg) - aims[tier]) +
    CATEGORY_COST * Math.max(0, pkg.categoryScore) +
    EXTRA_PLAYER_COST * margin * (pkg.give.length - 1);
  type BestForProps = { tier: TradeTier; packages: readonly Package[] };

  const bestFor = ({ tier, packages }: BestForProps): Package[] =>
    packages
      .map((pkg) => ({ pkg, cost: costOf({ pkg, tier }) }))
      .toSorted((a, b) => a.cost - b.cost || a.pkg.key.localeCompare(b.pkg.key))
      .slice(0, OFFERS_PER_TIER)
      .map(({ pkg }) => pkg);

  const packages = packagesOf({ roster: myRoster });
  const byBalance = packages.toSorted(
    (a, b) => balanceOf(a) - balanceOf(b) || a.key.localeCompare(b.key),
  );
  // The three cheapest and three richest packages are kept from fair, so a
  // lopsided row always has somewhere to go, once there are enough to spare.
  const reserved =
    packages.length >= OFFERS_PER_TIER * TRADE_TIERS.length
      ? [...byBalance.slice(0, OFFERS_PER_TIER), ...byBalance.slice(-OFFERS_PER_TIER)]
      : [];
  const fair = bestFor({
    tier: "fair",
    packages: packages.filter((pkg) => !reserved.includes(pkg)),
  });
  const fairLow = Math.min(...fair.map(balanceOf));
  const fairHigh = Math.max(...fair.map(balanceOf));

  // A lopsided row from its side of fair: in band by distance from its aim,
  // then, if the band is thin, the packages furthest toward its side.
  type SideForProps = { tier: "favors_me" | "favors_them"; from: readonly Package[] };

  const sideFor = ({ tier, from }: SideForProps): Package[] => {
    const banded = bestFor({ tier, packages: from.filter((pkg) => inBand[tier](balanceOf(pkg))) });
    const outward = tier === "favors_me" ? 1 : -1;
    const rest = from
      .filter((pkg) => !banded.includes(pkg))
      .toSorted((a, b) => outward * (balanceOf(a) - balanceOf(b)) || a.key.localeCompare(b.key));
    return [...banded, ...rest].slice(0, OFFERS_PER_TIER);
  };
  // A package level with fair's edge may join a side row; fair's own never.
  const open = packages.filter((pkg) => !fair.includes(pkg));
  const favorsThem = sideFor({
    tier: "favors_them",
    from: open.filter((pkg) => balanceOf(pkg) >= fairHigh),
  });
  const favorsMe = sideFor({
    tier: "favors_me",
    from: open.filter((pkg) => balanceOf(pkg) <= fairLow && !favorsThem.includes(pkg)),
  });
  const picks: Record<TradeTier, Package[]> = {
    favors_me: favorsMe,
    fair,
    favors_them: favorsThem,
  };

  return TRADE_TIERS.map((tier) => ({
    tier,
    offers: picks[tier].map((pkg): TradeOffer => ({
      tier,
      give: pkg.give,
      get: target,
      balance: balanceOf(pkg),
      reachesTier: inBand[tier](balanceOf(pkg)),
      categoryChange: target.categoryScore - pkg.categoryScore,
    })),
  }));
};
