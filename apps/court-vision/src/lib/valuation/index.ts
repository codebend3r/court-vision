import { type PlayerGameRange } from "@/lib/players/searchParams";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { scorePoints } from "@/lib/valuation/methods/points";
import { scoreSGP } from "@/lib/valuation/methods/sgp";
import { scoreSimValue } from "@/lib/valuation/methods/simvalue";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { positionalValues } from "@/lib/valuation/modifiers/positional";
import { replacementLevel } from "@/lib/valuation/modifiers/replacement";
import { computePoolStats } from "@/lib/valuation/pool";
import {
  type FantasyPlayerValues,
  type FantasyStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  type WeightedMethodKey,
} from "@/lib/valuation/types";

// Small leagues still standardize against a broad pool so values stay stable
// (PRD §5.1); deep leagues widen it to everyone rosterable.
const POOL_FLOOR = 150;

// Every method's score for every supplied line (PRD §9.3): Z-Score and
// G-Score share the pool primitives; PL Linear is the scoring dot product;
// VORP and Positional are replacement shifts over a Z-Score base; SGP and
// Sim Value measure against a synthetic league built from the pool.
//
// Each weighted column owns its own weight set (`methodWeights`), resolved per
// method here — a punt tuned for the Z-Score column must not reshape G-Score.
// A method with no entry falls back to `config.weights` (all 1s by default).
export const valuePlayers = ({
  lines,
  config,
  methodWeights = {},
  range,
}: {
  lines: readonly FantasyStatLine[];
  config: ValuationConfig;
  methodWeights?: MethodWeights;
  range: PlayerGameRange;
}): { values: FantasyPlayerValues[]; poolStats: PoolStats } => {
  const poolSize = Math.max(POOL_FLOOR, config.teams * config.rosterSlots);
  const poolStats = computePoolStats({ lines, basis: config.basis, poolSize, range });
  const configFor = (method: WeightedMethodKey): ValuationConfig => ({
    ...config,
    weights: methodWeights[method] ?? config.weights,
  });

  const zValues = scoreZScore({ lines, poolStats, config: configFor("z") });
  const gValues = scoreGScore({ lines, poolStats, config: configFor("g") });
  const pointsValues = scorePoints({ lines, basis: config.basis, scoring: config.scoring });
  // Each builds its own synthetic league: the draft ranks by the method's own
  // weights, so the leagues only coincide when the weight sets do.
  const sgpValues = scoreSGP({ lines, poolStats, config: configFor("sgp") });
  const simValues = scoreSimValue({ lines, poolStats, config: configFor("sim") });

  // VORP and Positional re-standardize with their own weight sets before the
  // replacement shift.
  const vorpTotals = scoreZScore({ lines, poolStats, config: configFor("vorp") }).map(
    ({ playerId, total }) => ({ playerId, total }),
  );
  const globalReplacement = replacementLevel({
    totals: vorpTotals,
    rank: config.teams * config.rosterSlots,
  });
  const positionByPlayer = new Map(lines.map((line) => [line.playerId, line.position]));
  const posTotals = scoreZScore({ lines, poolStats, config: configFor("pos") }).map(
    ({ playerId, total }) => ({ playerId, total }),
  );
  const positional = positionalValues({
    players: posTotals.map((entry) => ({
      ...entry,
      position: positionByPlayer.get(entry.playerId) ?? null,
    })),
    teams: config.teams,
    // The fallback replacement must come from the same weighted base as the
    // positional totals it patches.
    fallbackReplacement: replacementLevel({
      totals: posTotals,
      rank: config.teams * config.rosterSlots,
    }),
  });

  const vorpById = new Map(vorpTotals.map((entry) => [entry.playerId, entry.total]));
  const gById = new Map(gValues.map((value) => [value.playerId, value.total]));
  const pointsById = new Map(pointsValues.map((value) => [value.playerId, value.total]));
  const sgpById = new Map(sgpValues.map((value) => [value.playerId, value.total]));
  const simById = new Map(simValues.map((value) => [value.playerId, value.total]));

  const values = zValues.map(({ playerId, total }) => ({
    playerId,
    z: total,
    g: gById.get(playerId) ?? 0,
    points: pointsById.get(playerId) ?? 0,
    vorp: (vorpById.get(playerId) ?? 0) - globalReplacement,
    positional: positional.get(playerId) ?? 0,
    sgp: sgpById.get(playerId) ?? 0,
    sim: simById.get(playerId) ?? 0,
  }));

  return { values, poolStats };
};
