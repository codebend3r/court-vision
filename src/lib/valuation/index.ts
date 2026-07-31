import { type PlayerGameRange } from "@/lib/players/searchParams";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { scorePoints } from "@/lib/valuation/methods/points";
import { scoreSGP } from "@/lib/valuation/methods/sgp";
import { scoreSimValue } from "@/lib/valuation/methods/simvalue";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { positionalValues } from "@/lib/valuation/modifiers/positional";
import { replacementLevel } from "@/lib/valuation/modifiers/replacement";
import { computePoolStats } from "@/lib/valuation/pool";
import { buildLeague } from "@/lib/valuation/rosters";
import {
  type FantasyPlayerValues,
  type FantasyStatLine,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";

// Small leagues still standardize against a broad pool so values stay stable
// (PRD §5.1); deep leagues widen it to everyone rosterable.
const POOL_FLOOR = 150;

// Every method's score for every supplied line (PRD §9.3): Z-Score and
// G-Score share the pool primitives; PL Linear is the scoring dot product;
// VORP and Positional are replacement shifts over the Z-Score base; SGP and
// Sim Value both measure against a synthetic league built from the pool.
export const valuePlayers = ({
  lines,
  config,
  range,
}: {
  lines: readonly FantasyStatLine[];
  config: ValuationConfig;
  range: PlayerGameRange;
}): { values: FantasyPlayerValues[]; poolStats: PoolStats } => {
  const poolSize = Math.max(POOL_FLOOR, config.teams * config.rosterSlots);
  const poolStats = computePoolStats({ lines, basis: config.basis, poolSize, range });

  const zValues = scoreZScore({ lines, poolStats, config });
  const gValues = scoreGScore({ lines, poolStats, config });
  const pointsValues = scorePoints({ lines, basis: config.basis, scoring: config.scoring });
  // Both measure against the same synthetic league; building it once keeps the
  // extra ranking pass out of the hot path.
  const league = buildLeague({ lines, poolStats, config });
  const sgpValues = scoreSGP({ lines, poolStats, config, league });
  const simValues = scoreSimValue({ lines, poolStats, config, league });

  const zTotals = zValues.map(({ playerId, total }) => ({ playerId, total }));
  const globalReplacement = replacementLevel({
    totals: zTotals,
    rank: config.teams * config.rosterSlots,
  });
  const positionByPlayer = new Map(lines.map((line) => [line.playerId, line.position]));
  const positional = positionalValues({
    players: zTotals.map((entry) => ({
      ...entry,
      position: positionByPlayer.get(entry.playerId) ?? null,
    })),
    teams: config.teams,
    fallbackReplacement: globalReplacement,
  });

  const gById = new Map(gValues.map((value) => [value.playerId, value.total]));
  const pointsById = new Map(pointsValues.map((value) => [value.playerId, value.total]));
  const sgpById = new Map(sgpValues.map((value) => [value.playerId, value.total]));
  const simById = new Map(simValues.map((value) => [value.playerId, value.total]));

  const values = zValues.map(({ playerId, total }) => ({
    playerId,
    z: total,
    g: gById.get(playerId) ?? 0,
    points: pointsById.get(playerId) ?? 0,
    vorp: total - globalReplacement,
    positional: positional.get(playerId) ?? 0,
    sgp: sgpById.get(playerId) ?? 0,
    sim: simById.get(playerId) ?? 0,
  }));

  return { values, poolStats };
};
