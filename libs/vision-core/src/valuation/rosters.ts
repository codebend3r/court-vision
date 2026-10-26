import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { categoryValue } from "#core/valuation/categories";
import { scoreZScore } from "#core/valuation/methods/zscore";
import { meanSigma } from "#core/valuation/pool";
import { byTotalDescending } from "#core/valuation/rank";
import { type PoolStats, type ValuationConfig, type ValuationLine } from "#core/valuation/types";

type CategoryTotals<K extends SportKeys> = Partial<Record<Category<K>, number>>;

type CategorySpread = { min: number; max: number; mean: number; sd: number };

// What SGP and the matchup simulation both need, and neither pool statistics
// nor player values contain: what a *team* looks like, and how far apart two
// teams finish.
export type SyntheticLeague<K extends SportKeys> = {
  rosters: CategoryTotals<K>[];
  replacement: CategoryTotals<K>; // production available for free on waivers
  spread: Partial<Record<Category<K>, CategorySpread>>;
};

// Players ordered by the user's own configuration, so the synthetic league is
// drafted off the same valuation the table is showing.
type RankByValueProps<L extends ValuationLine<K>, K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly L[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
};

export const rankByValue = <K extends SportKeys, L extends ValuationLine<K>>({
  sport,
  lines,
  poolStats,
  config,
}: RankByValueProps<L, K>): L[] => {
  const totals = new Map(
    scoreZScore({ sport, lines, poolStats, config }).map((value) => [value.playerId, value.total]),
  );
  return lines
    .map((line) => ({ line, playerId: line.playerId, total: totals.get(line.playerId) ?? 0 }))
    .sort(byTotalDescending)
    .map((entry) => entry.line);
};

type TotalsOverProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
  divideBy?: number;
};

const totalsOver = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
  divideBy = 1,
}: TotalsOverProps<K>): CategoryTotals<K> =>
  config.categories.reduce<CategoryTotals<K>>((totals, category) => {
    const sum = lines.reduce(
      (acc, line) =>
        acc +
        categoryValue({
          sport,
          line,
          category,
          basis: config.basis,
          leagueRate: poolStats.leagueRate,
        }),
      0,
    );
    return { ...totals, [category]: sum / divideBy };
  }, {});

type SpreadOfProps<K extends SportKeys> = {
  rosters: readonly CategoryTotals<K>[];
  category: Category<K>;
};

const spreadOf = <K extends SportKeys>({ rosters, category }: SpreadOfProps<K>): CategorySpread => {
  const totals = rosters.map((roster) => roster[category] ?? 0);
  const { mu, sigma } = meanSigma({ values: totals });
  return { min: Math.min(...totals), max: Math.max(...totals), mean: mu, sd: sigma };
};

// With no league history to read, the league is reconstructed from the pool:
// take the rosterable players (teams × slots) and deal them out in snake order
// by value, which is what a competent draft approximates. The spread of the
// resulting team totals is the standings spread.
//
// SGP and Sim Value each build their own: the draft ranks by the method's own
// weight set, so two methods share a league only when their weights match.
type BuildLeagueProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
};

export const buildLeague = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
}: BuildLeagueProps<K>): SyntheticLeague<K> => {
  const { teams, rosterSlots } = config;
  const ranked = rankByValue({ sport, lines, poolStats, config });
  const rostered = ranked.slice(0, teams * rosterSlots);

  // Group first, total second: totalling into a fresh copy of every roster on
  // each pick is O(players × teams) object churn for no benefit.
  const squads = rostered.reduce<ValuationLine<K>[][]>(
    (acc, line, index) => {
      const round = Math.floor(index / teams);
      const seat = index % teams;
      // Snake: even rounds run left to right, odd rounds back again, so no one
      // team collects every top pick.
      const teamIndex = round % 2 === 0 ? seat : teams - 1 - seat;
      return acc.map((squad, squadIndex) => (squadIndex === teamIndex ? [...squad, line] : squad));
    },
    Array.from({ length: teams }, () => []),
  );

  const rosters = squads.map((squad) => totalsOver({ sport, lines: squad, poolStats, config }));

  const bandStart = teams * rosterSlots;
  const band = ranked.slice(bandStart, bandStart + teams);
  const sample = band.length > 0 ? band : ranked.slice(-teams);
  const replacement =
    sample.length === 0
      ? {}
      : totalsOver({ sport, lines: sample, poolStats, config, divideBy: sample.length });

  const spread = config.categories.reduce<SyntheticLeague<K>["spread"]>(
    (acc, category) => ({ ...acc, [category]: spreadOf({ rosters, category }) }),
    {},
  );

  return { rosters, replacement, spread };
};
