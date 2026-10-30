import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { scorePerCategory } from "#core/valuation/methods/perCategory";
import { buildLeague } from "#core/valuation/rosters";
import {
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
type StandingsGainDenominatorsProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
};

export const standingsGainDenominators = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
}: StandingsGainDenominatorsProps<K>): Partial<Record<Category<K>, number>> => {
  if (config.teams < 2) return {};
  const { spread } = buildLeague({ sport, lines, poolStats, config });
  return config.categories.reduce<Partial<Record<Category<K>, number>>>((acc, category) => {
    const { min, max } = spread[category] ?? { min: 0, max: 0 };
    return { ...acc, [category]: (max - min) / (config.teams - 1) };
  }, {});
};

type ScoreSGPProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
};

type ScoreLinesProps<K extends SportKeys> = { lines: readonly ValuationLine<K>[] };

// The denominators come from the pool once; the scorer then values any lines
// against them (the pool's own, or a rolling window held to the same league).
export const sgpScorer = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
}: ScoreSGPProps<K>) => {
  const denominators = standingsGainDenominators({ sport, lines, poolStats, config });
  return ({ lines: scored }: ScoreLinesProps<K>): PlayerValue<K>[] =>
    scorePerCategory({
      sport,
      lines: scored,
      poolStats,
      config,
      raw: ({ category, value }) => {
        const denominator = denominators[category] ?? 0;
        // A category every team ties in cannot move you in the standings, so it
        // carries no signal — same rule Z-Score applies to a zero sigma.
        return denominator === 0 ? 0 : value / denominator;
      },
    });
};

export const scoreSGP = <K extends SportKeys>(args: ScoreSGPProps<K>): PlayerValue<K>[] =>
  sgpScorer(args)({ lines: args.lines });
