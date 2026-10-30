import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { weightedConfig } from "#core/valuation/config";
import { scoreGScore } from "#core/valuation/methods/gscore";
import { scorePoints } from "#core/valuation/methods/points";
import { sgpScorer } from "#core/valuation/methods/sgp";
import { simValueScorer } from "#core/valuation/methods/simvalue";
import { scoreZScore } from "#core/valuation/methods/zscore";
import { positionalReplacement } from "#core/valuation/modifiers/positional";
import { replacementLevel } from "#core/valuation/modifiers/replacement";
import {
  type FantasyPlayerValues,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
  type WeightedMethodKey,
} from "#core/valuation/types";

// Everything a method measures a line against, built once from a pool: its
// stats, SGP's denominators, Sim Value's simulated season, and the VORP and
// positional replacement levels. `value` then scores any lines on every
// method: the pool's own rows (valuePlayers), or a rolling window held to the
// same league, so a recent-form reading and a season value share one scale.
export type Yardstick<K extends SportKeys> = {
  value: ({ lines }: YardstickValueProps<K>) => FantasyPlayerValues[];
};

type YardstickValueProps<K extends SportKeys> = { lines: readonly ValuationLine<K>[] };

type BuildYardstickProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
  methodWeights?: MethodWeights<K>;
};

export const buildYardstick = <K extends SportKeys>({
  sport,
  lines,
  poolStats,
  config,
  methodWeights = {},
}: BuildYardstickProps<K>): Yardstick<K> => {
  const configFor = (method: WeightedMethodKey): ValuationConfig<K> =>
    weightedConfig({ config, methodWeights, method });
  // Each builds its own synthetic league: the draft ranks by the method's own
  // weights, so the leagues only coincide when the weight sets do.
  const scoreSGP = sgpScorer({ sport, lines, poolStats, config: configFor("sgp") });
  const scoreSim = simValueScorer({ sport, lines, poolStats, config: configFor("sim") });

  // VORP and Positional shift a base value by a replacement level. Category
  // sports re-standardize with each method's own weight set; points-only
  // sports shift the points total.
  type ReplacementBaseProps = {
    method: "vorp" | "pos";
    scored: readonly ValuationLine<K>[];
  };

  const replacementBase = ({
    method,
    scored,
  }: ReplacementBaseProps): { playerId: number; total: number }[] =>
    sport.replacementBase === "points"
      ? scorePoints({ sport, lines: scored, basis: config.basis, scoring: config.scoring })
      : scoreZScore({ sport, lines: scored, poolStats, config: configFor(method) });
  const rank = config.teams * config.rosterSlots;
  const globalReplacement = replacementLevel({
    totals: replacementBase({ method: "vorp", scored: lines }),
    rank,
  });
  const posTotals = replacementBase({ method: "pos", scored: lines });
  const poolPositions = new Map(lines.map((line) => [line.playerId, line.position]));
  const positionalFor = positionalReplacement({
    sport,
    players: posTotals.map((entry) => ({
      ...entry,
      position: poolPositions.get(entry.playerId) ?? null,
    })),
    teams: config.teams,
    // The fallback replacement must come from the same weighted base as the
    // positional totals it patches.
    fallbackReplacement: replacementLevel({ totals: posTotals, rank }),
  });

  return {
    value: ({ lines: scored }) => {
      type TotalsByIdProps = { totals: readonly { playerId: number; total: number }[] };

      const totalsById = ({ totals }: TotalsByIdProps) =>
        new Map(totals.map((entry) => [entry.playerId, entry.total]));
      const zValues = scoreZScore({ sport, lines: scored, poolStats, config: configFor("z") });
      const g = totalsById({
        totals: scoreGScore({ sport, lines: scored, poolStats, config: configFor("g") }),
      });
      const points = totalsById({
        totals: scorePoints({ sport, lines: scored, basis: config.basis, scoring: config.scoring }),
      });
      const vorp = totalsById({ totals: replacementBase({ method: "vorp", scored }) });
      const pos = totalsById({ totals: replacementBase({ method: "pos", scored }) });
      const sgp = totalsById({ totals: scoreSGP({ lines: scored }) });
      const sim = totalsById({ totals: scoreSim({ lines: scored }) });
      const positionById = new Map(scored.map((line) => [line.playerId, line.position]));

      return zValues.map(({ playerId, total }) => ({
        playerId,
        z: total,
        g: g.get(playerId) ?? 0,
        points: points.get(playerId) ?? 0,
        vorp: (vorp.get(playerId) ?? 0) - globalReplacement,
        positional:
          (pos.get(playerId) ?? 0) -
          positionalFor({ position: positionById.get(playerId) ?? null }),
        sgp: sgp.get(playerId) ?? 0,
        sim: sim.get(playerId) ?? 0,
      }));
    },
  };
};
