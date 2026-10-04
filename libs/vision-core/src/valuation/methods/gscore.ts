import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { categoryValue } from "#core/valuation/categories";
import {
  type CategoryContribution,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";

// G-Score (PRD §6.2 sketch): the Z-Score numerator over a denominator that
// adds the pool's typical game-level volatility to the between-player spread,
// g = (x − μ) / sqrt(σ_between² + σ_within²). Categories that swing hard game
// to game get compressed, because a season-average edge there converts less
// reliably into weekly category wins. The games-per-week scaling and exact
// ratio-category treatment from the Rosenof paper remain to be verified
// (PRD implementation gate); this is the documented sketch.
export const scoreGScore = <K extends SportKeys>({
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
        const { mu, sigma, sigmaWithin } = poolStats.byCategory[category];
        const denominator = Math.sqrt(sigma ** 2 + sigmaWithin ** 2);
        const value = categoryValue({
          sport,
          line,
          category,
          basis: config.basis,
          leagueRate: poolStats.leagueRate,
        });
        const raw = denominator === 0 ? 0 : (value - mu) / denominator;
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
