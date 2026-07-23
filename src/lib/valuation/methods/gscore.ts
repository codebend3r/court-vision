import { categoryValue } from "@/lib/valuation/categories";
import {
  type Category,
  type CategoryContribution,
  type FantasyStatLine,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";

// G-Score (PRD §6.2 sketch): the Z-Score numerator over a denominator that
// adds the pool's typical game-level volatility to the between-player spread,
// g = (x − μ) / sqrt(σ_between² + σ_within²). Categories that swing hard game
// to game get compressed, because a season-average edge there converts less
// reliably into weekly category wins. The games-per-week scaling and exact
// ratio-category treatment from the Rosenof paper remain to be verified
// (PRD implementation gate); this is the documented sketch.
export const scoreGScore = ({
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
        const { mu, sigma, sigmaWithin } = poolStats.byCategory[category];
        const denominator = Math.sqrt(sigma ** 2 + sigmaWithin ** 2);
        const value = categoryValue({
          line,
          category,
          basis: config.basis,
          leagueFgPct: poolStats.leagueFgPct,
          leagueFtPct: poolStats.leagueFtPct,
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
