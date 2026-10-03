import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { categoryValue } from "#core/valuation/categories";
import {
  type CategoryContribution,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";

// Z-Score valuation (PRD §6.1): distance from the pool mean in pool standard
// deviations, per included category. A zero-sigma category carries no signal
// and scores 0. Weights scale the contribution, never the raw z, so a punted
// category (weight 0) still shows what is being given up.
export const scoreZScore = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
}: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
}): PlayerValue<K>[] =>
  lines.map((line) => {
    const breakdown = config.categories.reduce<Partial<Record<Category<K>, CategoryContribution>>>(
      (acc, category) => {
        const { mu, sigma } = poolStats.byCategory[category];
        const value = categoryValue({
          sport,
          line,
          category,
          basis: config.basis,
          leagueRate: poolStats.leagueRate,
        });
        const raw = sigma === 0 ? 0 : (value - mu) / sigma;
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
