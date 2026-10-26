import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { scorePerCategory, type CategoryScoringConfig } from "#core/valuation/methods/perCategory";
import { type PlayerValue, type PoolStats, type ValuationLine } from "#core/valuation/types";

// G-Score (PRD §6.2 sketch): the Z-Score numerator over a denominator that
// adds the pool's typical game-level volatility to the between-player spread,
// g = (x − μ) / sqrt(σ_between² + σ_within²). Categories that swing hard game
// to game get compressed, because a season-average edge there converts less
// reliably into weekly category wins. The games-per-week scaling and exact
// ratio-category treatment from the Rosenof paper remain to be verified
// (PRD implementation gate); this is the documented sketch.
type ScoreGScoreProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: CategoryScoringConfig<K>;
};

export const scoreGScore = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
}: ScoreGScoreProps<K>): PlayerValue<K>[] =>
  scorePerCategory({
    sport,
    lines,
    poolStats,
    config,
    raw: ({ category, value }) => {
      const { mu, sigma, sigmaWithin } = poolStats.byCategory[category];
      const denominator = Math.sqrt(sigma ** 2 + sigmaWithin ** 2);
      return denominator === 0 ? 0 : (value - mu) / denominator;
    },
  });
