import { createSportEngine } from "@vision/core/engine";
import { type FantasyMethodKey } from "@vision/core/valuation/types";
import { type FantasyMethodMeta } from "@vision/core/valuation/registry";

import { basketball, parseBasketballPosition } from "#basketball/descriptor";

// The shared engine bound to basketball, under the names Court Vision has
// always used, so the app imports one module instead of threading the
// descriptor through every call.
export const basketballEngine = createSportEngine({ sport: basketball });

export const {
  aggregateWindowLogs,
  autoAssignSlotId,
  buildCategoryBreakdown,
  buildFantasyGameValues,
  buildFantasyTrend,
  buildLeague,
  buildPlayerFantasyProfile,
  buildPlayerInsights,
  buildRollingSeries,
  buildSlots,
  categoryPerGame,
  categoryValue,
  clampSlotCount,
  computePoolStats,
  countsFromSlots,
  defaultScoringConfig,
  eligibleForSlot,
  groupSlotsByKind,
  isCategory,
  isH2hCategoriesConfig,
  isH2hPointsConfig,
  isRotoConfig,
  leagueRates,
  positionalValues,
  parseScoringConfig,
  poolStatsFor,
  rankByValue,
  resizeSlots,
  rollingWindowLines,
  rosterSize,
  scoreGScore,
  scorePoints,
  scoreSGP,
  scoreSimValue,
  scoreZScore,
  slotMeta,
  standingsGainDenominators,
  teamCategoryTotals,
  valuePlayers,
  buildYardstick,
  buildLeagueAverageLines,
} = basketballEngine;

export const CATEGORY_META = basketballEngine.categoryMeta;
export const CATEGORY_KEYS = basketballEngine.categoryKeys;
export const DEFAULT_POINTS_SCORING = basketball.points.defaults;
export const SCORED_KEYS = basketball.points.keys;
export const FANTASY_METHODS = basketballEngine.fantasyMethods;
export const SLOT_META = basketball.slots;
export const SLOT_TYPES = basketballEngine.slotTypes;
export const DEFAULT_SLOT_COUNTS = basketballEngine.defaultSlotCounts;
export const DEFAULT_VALUATION_CONFIG = basketballEngine.defaultValuationConfig;
export const parseEligibleGroups = parseBasketballPosition;

type MethodMetaProps = { key: FantasyMethodKey };

export const methodMeta = ({ key }: MethodMetaProps): FantasyMethodMeta | undefined =>
  FANTASY_METHODS.find((method) => method.key === key);
