import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { categoryValue } from "#core/valuation/categories";
import { buildLeague, type SyntheticLeague } from "#core/valuation/rosters";
import {
  type CategoryContribution,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";

// Standings Gain Points: a player's production divided by how much of that
// category separates two adjacent places in the standings. The answer is in
// units of standings places — "this player is worth 4.2 places" — which is the
// question a roto manager actually asks.
//
// The denominator normally comes from a league's finishing history. There is no
// sourced defaults table for that, so it is derived from the pool instead: build
// the synthetic league (lib/valuation/rosters), then take the average gap
// between adjacent teams in each category, (max − min) ÷ (teams − 1). That is
// the same quantity a history table would hold, measured on the player pool the
// league would actually draft from rather than on last year's results.
export const standingsGainDenominators = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
  league,
}: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
  league?: SyntheticLeague<K>;
}): Partial<Record<Category<K>, number>> => {
  if (config.teams < 2) return {};
  const { spread } = league ?? buildLeague({ sport, lines, poolStats, config });
  return config.categories.reduce<Partial<Record<Category<K>, number>>>((acc, category) => {
    const { min, max } = spread[category] ?? { min: 0, max: 0 };
    return { ...acc, [category]: (max - min) / (config.teams - 1) };
  }, {});
};

export const scoreSGP = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
  league,
}: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
  league?: SyntheticLeague<K>;
}): PlayerValue<K>[] => {
  const denominators = standingsGainDenominators({ sport, lines, poolStats, config, league });
  return lines.map((line) => {
    const breakdown = config.categories.reduce<Partial<Record<Category<K>, CategoryContribution>>>(
      (acc, category) => {
        const denominator = denominators[category] ?? 0;
        const value = categoryValue({
          sport,
          line,
          category,
          basis: config.basis,
          leagueRate: poolStats.leagueRate,
        });
        // A category every team ties in cannot move you in the standings, so it
        // carries no signal — same rule Z-Score applies to a zero sigma.
        const raw = denominator === 0 ? 0 : value / denominator;
        return { ...acc, [category]: { raw, weighted: raw * (config.weights[category] ?? 1) } };
      },
      {},
    );
    const total = config.categories.reduce(
      (sum, category) => sum + (breakdown[category]?.weighted ?? 0),
      0,
    );
    return { playerId: line.playerId, total, breakdown };
  });
};
