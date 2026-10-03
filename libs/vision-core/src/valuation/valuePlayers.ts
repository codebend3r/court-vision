import { type PoolDef, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { scoreGScore } from "#core/valuation/methods/gscore";
import { scorePoints } from "#core/valuation/methods/points";
import { scoreSGP } from "#core/valuation/methods/sgp";
import { scoreSimValue } from "#core/valuation/methods/simvalue";
import { scoreZScore } from "#core/valuation/methods/zscore";
import { positionalValues } from "#core/valuation/modifiers/positional";
import { replacementLevel } from "#core/valuation/modifiers/replacement";
import { computePoolStats, resolvePool } from "#core/valuation/pool";
import {
  type FantasyPlayerValues,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
  type WeightedMethodKey,
} from "#core/valuation/types";

// Small leagues still standardize against a broad pool so values stay stable
// (PRD §5.1); deep leagues widen it to everyone rosterable.
export const poolSizeFor = <K extends SportKeys>({
  pool,
  config,
}: {
  pool: PoolDef<K>;
  config: ValuationConfig<K>;
}): number => Math.max(pool.poolFloor, config.teams * config.rosterSlots);

// Every method's score for every supplied line (PRD §9.3): Z-Score and
// G-Score share the pool primitives; PL Linear is the scoring dot product;
// VORP and Positional are replacement shifts over a Z-Score base; SGP and
// Sim Value measure against a synthetic league built from the pool.
//
// Each weighted column owns its own weight set (`methodWeights`), resolved per
// method here — a punt tuned for the Z-Score column must not reshape G-Score.
// A method with no entry falls back to `config.weights` (all 1s by default).
//
// Lines are valued against one pool (the sport's first unless `pool` names
// another); a split-pool sport values each pool's lines separately.
export const valuePlayers = <K extends SportKeys>({
  sport,
  pool,
  lines,
  config,
  methodWeights = {},
  windowGames,
}: {
  sport: SportDescriptor<K>;
  pool?: PoolDef<K>;
  lines: readonly ValuationLine<K>[];
  config: ValuationConfig<K>;
  methodWeights?: MethodWeights<K>;
  windowGames: number | null;
}): { values: FantasyPlayerValues[]; poolStats: PoolStats<K> } => {
  const resolved = resolvePool({ sport, pool });
  const poolStats = computePoolStats({
    sport,
    pool: resolved,
    lines,
    basis: config.basis,
    poolSize: poolSizeFor({ pool: resolved, config }),
    windowGames,
  });
  const configFor = (method: WeightedMethodKey): ValuationConfig<K> => ({
    ...config,
    weights: methodWeights[method] ?? config.weights,
  });

  const zValues = scoreZScore({ sport, lines, poolStats, config: configFor("z") });
  const gValues = scoreGScore({ sport, lines, poolStats, config: configFor("g") });
  const pointsValues = scorePoints({ sport, lines, basis: config.basis, scoring: config.scoring });
  // Each builds its own synthetic league: the draft ranks by the method's own
  // weights, so the leagues only coincide when the weight sets do.
  const sgpValues = scoreSGP({ sport, lines, poolStats, config: configFor("sgp") });
  const simValues = scoreSimValue({ sport, lines, poolStats, config: configFor("sim") });

  // VORP and Positional shift a base value by a replacement level. Category
  // sports re-standardize with each method's own weight set; points-only
  // sports shift the points total.
  const replacementBase = (method: "vorp" | "pos"): { playerId: number; total: number }[] =>
    sport.replacementBase === "points"
      ? pointsValues
      : scoreZScore({ sport, lines, poolStats, config: configFor(method) }).map(
          ({ playerId, total }) => ({ playerId, total }),
        );
  const vorpTotals = replacementBase("vorp");
  const globalReplacement = replacementLevel({
    totals: vorpTotals,
    rank: config.teams * config.rosterSlots,
  });
  const positionByPlayer = new Map(lines.map((line) => [line.playerId, line.position]));
  const posTotals = replacementBase("pos");
  const positional = positionalValues({
    sport,
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
