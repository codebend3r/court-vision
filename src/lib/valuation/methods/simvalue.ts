import { categoryValue } from "@/lib/valuation/categories";
import { buildLeague, type SyntheticLeague } from "@/lib/valuation/rosters";
import {
  type Category,
  type CategoryContribution,
  type FantasyStatLine,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";

// Enough draws that a one-decimal display is stable. Variance is already low
// because each iteration scores with and without the player against the *same*
// opponent (common random numbers), so everything except the categories near
// the win threshold cancels out.
export const SIM_ITERATIONS = 400;

// Fixed seed: the simulated season must not change between renders, and a
// Math.random-based column could not be tested.
const SIM_SEED = 0x5eed;

// Deterministic PRNG (mulberry32).
const mulberry32 = ({ seed }: { seed: number }) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Box-Muller: opponents' weekly category totals are modelled as normal around
// the league's average team, spread by how far apart teams actually finish.
const standardNormal = ({ random }: { random: () => number }): number => {
  const u = Math.max(random(), Number.MIN_VALUE);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Monte Carlo Matchup Simulation: how many extra category wins a player buys.
//
// The player is added to an average team in place of a freely available one,
// and that team plays many simulated weeks against opponents drawn from the
// league's own spread. The score is the average change in weighted category
// wins — so a category you already dominate (or have punted to weight 0) pays
// nothing extra, which is the whole point of a roster-aware valuation.
//
// The baseline roster is the league-average team rather than the signed-in
// user's, so the column stays comparable across every row; valuing against
// your own roster is the natural next step.
export const scoreSimValue = ({
  lines,
  poolStats,
  config,
  league,
  iterations = SIM_ITERATIONS,
}: {
  lines: readonly FantasyStatLine[];
  poolStats: PoolStats;
  config: ValuationConfig;
  league?: SyntheticLeague;
  iterations?: number;
}): PlayerValue[] => {
  const { replacement, spread } = league ?? buildLeague({ lines, poolStats, config });

  // One simulated season, drawn once and faced by every player. Re-rolling
  // opponents per player would cost 600× the draws and, worse, would rank
  // players against different luck; this way the column is a paired comparison.
  const random = mulberry32({ seed: SIM_SEED });
  const opponents = config.categories.reduce<Partial<Record<Category, number[]>>>(
    (acc, category) => {
      const { mean, sd } = spread[category] ?? { mean: 0, sd: 0 };
      return {
        ...acc,
        [category]: Array.from(
          { length: iterations },
          () => mean + sd * standardNormal({ random }),
        ),
      };
    },
    {},
  );

  return lines.map((line) => {
    const breakdown = config.categories.reduce<Partial<Record<Category, CategoryContribution>>>(
      (acc, category) => {
        const { mean } = spread[category] ?? { mean: 0 };
        const weeks = opponents[category] ?? [];
        const value = categoryValue({
          line,
          category,
          basis: config.basis,
          leagueFgPct: poolStats.leagueFgPct,
          leagueFtPct: poolStats.leagueFtPct,
        });
        const withPlayer = mean + (value - (replacement[category] ?? 0));
        // Common random numbers: the same week is scored with and without the
        // player, so every week that is not close to the threshold cancels
        // instead of adding noise.
        const gained = weeks.reduce(
          (sum, opponent) => sum + ((withPlayer > opponent ? 1 : 0) - (mean > opponent ? 1 : 0)),
          0,
        );
        const raw = weeks.length === 0 ? 0 : gained / weeks.length;
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
