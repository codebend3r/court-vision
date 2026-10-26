import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { scorePerCategory, type CategoryScoringConfig } from "#core/valuation/methods/perCategory";
import { type PlayerValue, type PoolStats, type ValuationLine } from "#core/valuation/types";

// Z-Score valuation (PRD §6.1): distance from the pool mean in pool standard
// deviations, per included category. A zero-sigma category carries no signal
// and scores 0.
type ScoreZScoreProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: CategoryScoringConfig<K>;
};

export const scoreZScore = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
}: ScoreZScoreProps<K>): PlayerValue<K>[] =>
  scorePerCategory({
    sport,
    lines,
    poolStats,
    config,
    raw: ({ category, value }) => {
      const { mu, sigma } = poolStats.byCategory[category];
      return sigma === 0 ? 0 : (value - mu) / sigma;
    },
  });
