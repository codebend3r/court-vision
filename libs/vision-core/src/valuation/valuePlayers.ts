import { type PoolDef, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { poolStatsFor } from "#core/valuation/pool";
import {
  type FantasyPlayerValues,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";
import { buildYardstick } from "#core/valuation/yardstick";

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
type ValuePlayersProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  pool?: PoolDef<K>;
  lines: readonly ValuationLine<K>[];
  config: ValuationConfig<K>;
  methodWeights?: MethodWeights<K>;
  windowGames: number | null;
};

export const valuePlayers = <K extends SportKeys>({
  sport,
  pool,
  lines,
  config,
  methodWeights = {},
  windowGames,
}: ValuePlayersProps<K>): { values: FantasyPlayerValues[]; poolStats: PoolStats<K> } => {
  const poolStats = poolStatsFor({ sport, pool, lines, config, windowGames });
  const yardstick = buildYardstick({ sport, lines, poolStats, config, methodWeights });
  return { values: yardstick.value({ lines }), poolStats };
};
