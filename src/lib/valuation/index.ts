import type { PlayerGameRange } from "@/lib/players/searchParams";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { scorePoints } from "@/lib/valuation/methods/points";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { positionalValues } from "@/lib/valuation/modifiers/positional";
import { replacementLevel } from "@/lib/valuation/modifiers/replacement";
import { computePoolStats } from "@/lib/valuation/pool";
import type {
  FantasyPlayerValues,
  FantasyStatLine,
  PoolStats,
  ValuationConfig,
} from "@/lib/valuation/types";

// Small leagues still standardize against a broad pool so values stay stable
// (PRD §5.1); deep leagues widen it to everyone rosterable.
const POOL_FLOOR = 150;

// Every method's score for every supplied line (PRD §9.3): Z-Score and
// G-Score share the pool primitives; Points is the scoring dot product; VORP
// and Positional are replacement shifts over the Z-Score base.
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
  const pointsValues = scorePoints({ lines, basis: config.basis });

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

  const values = zValues.map(({ playerId, total }) => ({
    playerId,
    z: total,
    g: gById.get(playerId) ?? 0,
    points: pointsById.get(playerId) ?? 0,
    vorp: total - globalReplacement,
    positional: positional.get(playerId) ?? 0,
  }));

  return { values, poolStats };
};
