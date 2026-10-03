import { categoryValue } from "@/lib/valuation/categories";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import {
  type Category,
  type FantasyStatLine,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";

export type CategoryTotals = Partial<Record<Category, number>>;

// What SGP and the matchup simulation both need, and neither pool statistics
// nor player values contain: what a *team* looks like, and how far apart two
// teams finish.
export type SyntheticLeague = {
  rosters: CategoryTotals[];
  replacement: CategoryTotals; // production available for free on waivers
  spread: Partial<Record<Category, { min: number; max: number; mean: number; sd: number }>>;
};

// Players ordered by the user's own configuration, so the synthetic league is
// drafted off the same valuation the table is showing.
export const rankByValue = ({
  lines,
  poolStats,
  config,
}: {
  lines: readonly FantasyStatLine[];
  poolStats: PoolStats;
  config: ValuationConfig;
}): FantasyStatLine[] => {
  const totals = new Map(
    scoreZScore({ lines, poolStats, config }).map((value) => [value.playerId, value.total]),
  );
  return [...lines].sort(
    (a, b) =>
      (totals.get(b.playerId) ?? 0) - (totals.get(a.playerId) ?? 0) || a.playerId - b.playerId,
  );
};

const totalsOver = ({
  lines,
  poolStats,
  config,
  divideBy = 1,
}: {
  lines: readonly FantasyStatLine[];
  poolStats: PoolStats;
  config: ValuationConfig;
  divideBy?: number;
}): CategoryTotals =>
  config.categories.reduce<CategoryTotals>((totals, category) => {
    const sum = lines.reduce(
      (acc, line) =>
        acc +
        categoryValue({
          line,
          category,
          basis: config.basis,
          leagueFgPct: poolStats.leagueFgPct,
          leagueFtPct: poolStats.leagueFtPct,
        }),
      0,
    );
    return { ...totals, [category]: sum / divideBy };
  }, {});

const spreadOf = ({
  rosters,
  category,
}: {
  rosters: readonly CategoryTotals[];
  category: Category;
}): { min: number; max: number; mean: number; sd: number } => {
  const totals = rosters.map((roster) => roster[category] ?? 0);
  const mean = totals.reduce((sum, total) => sum + total, 0) / (totals.length || 1);
  const variance =
    totals.reduce((sum, total) => sum + (total - mean) ** 2, 0) / (totals.length || 1);
  return { min: Math.min(...totals), max: Math.max(...totals), mean, sd: Math.sqrt(variance) };
};

export const teamTotalsSpread = spreadOf;

// With no league history to read, the league is reconstructed from the pool:
// take the rosterable players (teams × slots) and deal them out in snake order
// by value, which is what a competent draft approximates. The spread of the
// resulting team totals is the standings spread.
//
// Built once per valuation and shared by both consumers — each ranks the pool,
// and ranking runs a full Z-Score pass, so doing it per method tripled the work.
export const buildLeague = ({
  lines,
  poolStats,
  config,
}: {
  lines: readonly FantasyStatLine[];
  poolStats: PoolStats;
  config: ValuationConfig;
}): SyntheticLeague => {
  const { teams, rosterSlots } = config;
  const ranked = rankByValue({ lines, poolStats, config });
  const rostered = ranked.slice(0, teams * rosterSlots);

  // Group first, total second: totalling into a fresh copy of every roster on
  // each pick is O(players × teams) object churn for no benefit.
  const squads = rostered.reduce<FantasyStatLine[][]>(
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

  const rosters = squads.map((squad) => totalsOver({ lines: squad, poolStats, config }));

  const bandStart = teams * rosterSlots;
  const band = ranked.slice(bandStart, bandStart + teams);
  const sample = band.length > 0 ? band : ranked.slice(-teams);
  const replacement =
    sample.length === 0
      ? {}
      : totalsOver({ lines: sample, poolStats, config, divideBy: sample.length });

  const spread = config.categories.reduce<SyntheticLeague["spread"]>(
    (acc, category) => ({ ...acc, [category]: spreadOf({ rosters, category }) }),
    {},
  );

  return { rosters, replacement, spread };
};
