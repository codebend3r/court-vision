import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { createPrng, standardNormal } from "#core/util/prng";
import { scorePerCategory } from "#core/valuation/methods/perCategory";
import { buildLeague } from "#core/valuation/rosters";
import {
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";

// Enough draws that a one-decimal display is stable. Variance is already low
// because each iteration scores with and without the player against the *same*
// opponent (common random numbers), so everything except the categories near
// the win threshold cancels out.
const SIM_ITERATIONS = 400;

// Fixed seed: the simulated season must not change between renders, and a
// Math.random-based column could not be tested.
const SIM_SEED = 0x5eed;

// Weeks a team finishing on `total` wins: the opponents strictly below it, by
// binary search over the ascending draws. A NaN total beats nobody, and a NaN
// draw (sorted last by the typed array) loses to nobody, as `>` has it.
type WeeksWonProps = {
  sorted: Float64Array;
  total: number;
  low?: number;
  high?: number;
};

const weeksWon = ({ sorted, total, low = 0, high = sorted.length }: WeeksWonProps): number => {
  if (low >= high) return low;
  const middle = (low + high) >>> 1;
  return sorted[middle] < total
    ? weeksWon({ sorted, total, low: middle + 1, high })
    : weeksWon({ sorted, total, low, high: middle });
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
type ScoreSimValueProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
  iterations?: number;
};

type ScoreLinesProps<K extends SportKeys> = { lines: readonly ValuationLine<K>[] };

// The simulated season is built from the pool once; the scorer then values any
// lines against it (the pool's own, or a rolling window held to the same
// league).
export const simValueScorer = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
  iterations = SIM_ITERATIONS,
}: ScoreSimValueProps<K>) => {
  const { replacement, spread } = buildLeague({ sport, lines, poolStats, config });

  // One simulated season, drawn once and faced by every player. Re-rolling
  // opponents per player would cost 600× the draws and, worse, would rank
  // players against different luck; this way the column is a paired comparison.
  // Opponents' weekly category totals are modelled as normal around the
  // league's average team, spread by how far apart teams actually finish.
  const random = createPrng({ seed: SIM_SEED });
  const opponents = config.categories.reduce<Partial<Record<Category<K>, number[]>>>(
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

  // Each category's season sorted once, with the average team's wins against
  // it. Scoring a player is then one binary search (nine comparisons) rather
  // than a pass over every simulated week (eight hundred): the same whole-week
  // count, across a 600-player pool.
  const seasons = new Map(
    config.categories.map((category) => {
      const sorted = Float64Array.from(opponents[category] ?? []).sort();
      const { mean } = spread[category] ?? { mean: 0 };
      const season = {
        mean,
        sorted,
        baselineWins: weeksWon({ sorted, total: mean }),
        freeAgent: replacement[category] ?? 0,
      };
      return [category, season];
    }),
  );

  return ({ lines: scored }: ScoreLinesProps<K>): PlayerValue<K>[] =>
    scorePerCategory({
      sport,
      lines: scored,
      poolStats,
      config,
      raw: ({ category, value }) => {
        const season = seasons.get(category);
        if (season === undefined || season.sorted.length === 0) return 0;
        const { mean, sorted, baselineWins, freeAgent } = season;
        const withPlayer = mean + (value - freeAgent);
        // Common random numbers: the same weeks are scored with and without the
        // player, so every week that is not close to the threshold cancels
        // instead of adding noise.
        const gained = weeksWon({ sorted, total: withPlayer }) - baselineWins;
        return gained / sorted.length;
      },
    });
};

export const scoreSimValue = <K extends SportKeys>(args: ScoreSimValueProps<K>): PlayerValue<K>[] =>
  simValueScorer(args)({ lines: args.lines });
