import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { categoryValue } from "#core/valuation/categories";
import {
  type CategoryContribution,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";

// What a per-category scorer reads from the config: which categories, their
// weights, and the basis. League size and the points table never reach it.
export type CategoryScoringConfig<K extends SportKeys> = Pick<
  ValuationConfig<K>,
  "categories" | "weights" | "basis"
>;

// The loop every category method shares: each included category's primitive
// value, turned into a raw score by the method's own formula, scaled by its
// weight (absent = 1), and summed in category order. Weights scale the
// contribution, never the raw score, so a punted category (weight 0) still
// shows what is being given up.
type RawProps<K extends SportKeys> = { category: Category<K>; value: number };

type ScorePerCategoryProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: Pick<PoolStats<K>, "leagueRate">;
  config: CategoryScoringConfig<K>;
  raw: (args: RawProps<K>) => number;
};

export const scorePerCategory = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
  raw,
}: ScorePerCategoryProps<K>): PlayerValue<K>[] =>
  lines.map((line) => {
    const { breakdown, total } = config.categories.reduce<{
      breakdown: Partial<Record<Category<K>, CategoryContribution>>;
      total: number;
    }>(
      (acc, category) => {
        const value = categoryValue({
          sport,
          line,
          category,
          basis: config.basis,
          leagueRate: poolStats.leagueRate,
        });
        const score = raw({ category, value });
        const weighted = score * (config.weights[category] ?? 1);
        return {
          breakdown: { ...acc.breakdown, [category]: { raw: score, weighted } },
          total: acc.total + weighted,
        };
      },
      { breakdown: {}, total: 0 },
    );
    return { playerId: line.playerId, total, breakdown };
  });
