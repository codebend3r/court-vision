import { type BasketballLine } from "@vision/sport-basketball/types";

// Court Vision's valuation vocabulary: the shared engine's types bound to
// basketball (re-exported under the names the app has always used), plus the
// app's own stat line.
export {
  type Basis,
  type CategoryContribution,
  type FantasyMethodKey,
  type FantasyPlayerValues,
  type WeightedMethodKey,
} from "@vision/core/valuation/types";
export {
  type Category,
  type CategoryWeights,
  type CountingCategory,
  type MethodWeights,
  type PlayerValue,
  type PoolStats,
  type RatioCategory,
  type ScoringSettings,
  type ScoringStatKey,
  type StatKey,
  type ValuationConfig,
} from "@vision/sport-basketball/types";

// One player's stat totals over the active window (full season or lastN): the
// engine's line plus the identity fields the tables render. Produced by
// lib/valuation/loader.
export type FantasyStatLine = BasketballLine & {
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  nbaPersonId: number | null;
};
