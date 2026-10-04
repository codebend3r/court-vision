import {
  type H2hCategoriesConfig as CoreH2hCategoriesConfig,
  type H2hPointsConfig as CoreH2hPointsConfig,
  type LeagueScoringConfig as CoreLeagueScoringConfig,
  type RotoConfig as CoreRotoConfig,
} from "@vision/core/league/scoring";
import {
  type PlayerCategoryInsight as CorePlayerCategoryInsight,
  type PlayerInsight as CorePlayerInsight,
} from "@vision/core/roster/insights";
import { type SlotCounts as CoreSlotCounts } from "@vision/core/roster/slots";
import { type Category as CoreCategory } from "@vision/core/sport/types";
import {
  type DatedLog as CoreDatedLog,
  type WindowLog as CoreWindowLog,
  type WindowTotals as CoreWindowTotals,
} from "@vision/core/valuation/aggregate";
import { type FantasyCategoryBreakdown as CoreFantasyCategoryBreakdown } from "@vision/core/valuation/breakdown";
import { type CategoryMeta as CoreCategoryMeta } from "@vision/core/valuation/categories";
import { type FantasyGameValue as CoreFantasyGameValue } from "@vision/core/valuation/gameValues";
import {
  type FantasyProfileLog as CoreFantasyProfileLog,
  type PlayerFantasyProfile as CorePlayerFantasyProfile,
} from "@vision/core/valuation/playerValue";
import { type SyntheticLeague as CoreSyntheticLeague } from "@vision/core/valuation/rosters";
import {
  type CategoryWeights as CoreCategoryWeights,
  type MethodWeights as CoreMethodWeights,
  type PlayerValue as CorePlayerValue,
  type PoolStats as CorePoolStats,
  type ScoringSettings as CoreScoringSettings,
  type ValuationConfig as CoreValuationConfig,
  type ValuationLine as CoreValuationLine,
} from "@vision/core/valuation/types";

import { type BasketballKeys } from "#basketball/descriptor";

// The shared engine's generic types, bound to basketball's keys.
export type CountingCategory = BasketballKeys["counting"];
export type RatioCategory = BasketballKeys["ratio"];
export type Category = CoreCategory<BasketballKeys>;
export type StatKey = BasketballKeys["valued"];
export type ScoringStatKey = BasketballKeys["scoring"];
export type PositionGroup = BasketballKeys["group"];
export type RosterSlotType = BasketballKeys["slot"];

export type BasketballLine = CoreValuationLine<BasketballKeys>;
export type CategoryWeights = CoreCategoryWeights<BasketballKeys>;
export type MethodWeights = CoreMethodWeights<BasketballKeys>;
export type PlayerValue = CorePlayerValue<BasketballKeys>;
export type PoolStats = CorePoolStats<BasketballKeys>;
export type ScoringSettings = CoreScoringSettings<BasketballKeys>;
export type ValuationConfig = CoreValuationConfig<BasketballKeys>;
export type CategoryMeta = CoreCategoryMeta<BasketballKeys>;
export type FantasyCategoryBreakdown = CoreFantasyCategoryBreakdown<BasketballKeys>;
export type FantasyGameValue = CoreFantasyGameValue<BasketballKeys>;
export type FantasyProfileLog = CoreFantasyProfileLog<BasketballKeys>;
export type PlayerFantasyProfile = CorePlayerFantasyProfile<BasketballKeys>;
export type SyntheticLeague = CoreSyntheticLeague<BasketballKeys>;
export type WindowLog = CoreWindowLog<BasketballKeys>;
export type DatedLog = CoreDatedLog<BasketballKeys>;
export type WindowTotals = CoreWindowTotals<BasketballKeys>;
export type SlotCounts = CoreSlotCounts<BasketballKeys>;
export type PlayerInsight = CorePlayerInsight<BasketballKeys>;
export type PlayerCategoryInsight = CorePlayerCategoryInsight<BasketballKeys>;
export type H2hCategoriesConfig = CoreH2hCategoriesConfig<BasketballKeys>;
export type H2hPointsConfig = CoreH2hPointsConfig<BasketballKeys>;
export type RotoConfig = CoreRotoConfig<BasketballKeys>;
export type LeagueScoringConfig = CoreLeagueScoringConfig<BasketballKeys>;
