import { categoryValue } from "@/lib/valuation/categories";
import {
  type Category,
  type CategoryContribution,
  type FantasyStatLine,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";

// Z-Score valuation (PRD §6.1): distance from the pool mean in pool standard
// deviations, per included category. A zero-sigma category carries no signal
// and scores 0. Weights scale the contribution, never the raw z, so a punted
// category (weight 0) still shows what is being given up.
export const scoreZScore = ({
  lines,
  poolStats,
  config,
}: {
  lines: readonly FantasyStatLine[];
  poolStats: PoolStats;
  config: ValuationConfig;
}): PlayerValue[] =>
  lines.map((line) => {
    const breakdown = config.categories.reduce<Partial<Record<Category, CategoryContribution>>>(
      (acc, category) => {
        const { mu, sigma } = poolStats.byCategory[category];
        const value = categoryValue({
          line,
          category,
          basis: config.basis,
          leagueFgPct: poolStats.leagueFgPct,
          leagueFtPct: poolStats.leagueFtPct,
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
