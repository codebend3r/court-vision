import { createSportEngine } from "#core/engine";
import {
  type RosterSlot as CoreRosterSlot,
  type SlotCounts as CoreSlotCounts,
} from "#core/roster/slots";
import { type Category as CoreCategory } from "#core/sport/types";
import {
  basketballFixture,
  parsePosition,
  VALUED_STATS,
  type BasketballKeys,
} from "#core/testing/basketballDescriptor";
import { makeLine } from "#core/testing/lines";
import { recordFromKeys } from "#core/util/record";
import {
  type DatedLog as CoreDatedLog,
  type WindowLog as CoreWindowLog,
  type WindowTotals as CoreWindowTotals,
} from "#core/valuation/aggregate";
import { type FantasyProfileLog as CoreFantasyProfileLog } from "#core/valuation/playerValue";
import {
  type MethodWeights as CoreMethodWeights,
  type PlayerValue as CorePlayerValue,
  type PoolStats as CorePoolStats,
  type ScoringSettings as CoreScoringSettings,
  type ValuationConfig as CoreValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";

// Core's test harness: the engine bound to the basketball fixture, under the
// names Court Vision uses, plus line and log builders with flat overrides.

export { basketballFixture, type BasketballKeys };

export type Category = CoreCategory<BasketballKeys>;
export type CountingCategory = BasketballKeys["counting"];
export type RatioCategory = BasketballKeys["ratio"];
export type StatKey = BasketballKeys["valued"];
export type RosterSlotType = BasketballKeys["slot"];
export type MethodWeights = CoreMethodWeights<BasketballKeys>;
export type PlayerValue = CorePlayerValue<BasketballKeys>;
export type PoolStats = CorePoolStats<BasketballKeys>;
export type ScoringSettings = CoreScoringSettings<BasketballKeys>;
export type ValuationConfig = CoreValuationConfig<BasketballKeys>;
export type WindowLog = CoreWindowLog<BasketballKeys>;
export type DatedLog = CoreDatedLog<BasketballKeys>;
export type WindowTotals = CoreWindowTotals<BasketballKeys>;
export type FantasyProfileLog = CoreFantasyProfileLog<BasketballKeys>;

// Lines carry identity like an app's would, so tests read naturally.
export type FantasyStatLine = ValuationLine<BasketballKeys> & {
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  nbaPersonId: number | null;
};

export type FantasyTeamPlayer = {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
};
export type RosterSlot = CoreRosterSlot<BasketballKeys, FantasyTeamPlayer>;
export type SlotCounts = CoreSlotCounts<BasketballKeys>;

export const engine = createSportEngine({ sport: basketballFixture });

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
  valuePlayers,
  buildYardstick,
  buildLeagueAverageLines,
} = engine;

export const CATEGORY_META = engine.categoryMeta;
export const CATEGORY_KEYS = engine.categoryKeys;
export const DEFAULT_POINTS_SCORING = basketballFixture.points.defaults;
export const SCORED_KEYS = basketballFixture.points.keys;
export const FANTASY_METHODS = engine.fantasyMethods;
export const SLOT_META = basketballFixture.slots;
export const SLOT_TYPES = engine.slotTypes;
export const DEFAULT_SLOT_COUNTS = engine.defaultSlotCounts;
export { parsePosition as parseEligibleGroups };

// The neutral read most tests score against: every category, no weights,
// per-game, a standard 12-team / 13-slot league.
export const DEFAULT_VALUATION_CONFIG = engine.defaultValuationConfig;

type FlatStats = Record<StatKey, number>;

export type FixtureOverrides = Partial<
  Omit<FantasyStatLine, "stats" | "playingTime" | "sq" | "cross"> & FlatStats
> & {
  playerId: number;
  minutes?: number;
  sq?: FantasyStatLine["sq"];
  cross?: FantasyStatLine["cross"];
};

const DEFAULT_STATS: FlatStats = {
  pts: 500,
  reb: 200,
  ast: 150,
  stl: 40,
  blk: 20,
  fg3m: 60,
  tov: 80,
  fgm: 180,
  fga: 400,
  ftm: 100,
  fta: 120,
};

// A 50-game, 1500-minute guard on a constant line (see `makeLine`) unless the
// overrides say otherwise.
export const makeStatLine = (overrides: FixtureOverrides): FantasyStatLine => ({
  firstName: overrides.firstName ?? "Test",
  lastName: overrides.lastName ?? `Player ${overrides.playerId}`,
  fullName: overrides.fullName ?? `Test Player ${overrides.playerId}`,
  teamAbbr: overrides.teamAbbr === undefined ? "BOS" : overrides.teamAbbr,
  nbaPersonId: overrides.nbaPersonId ?? null,
  ...makeLine({
    sport: basketballFixture,
    playerId: overrides.playerId,
    position: overrides.position === undefined ? "G" : overrides.position,
    gamesPlayed: overrides.gamesPlayed ?? 50,
    playingTime: overrides.minutes ?? 1500,
    stats: recordFromKeys({
      keys: VALUED_STATS,
      value: (key) => overrides[key] ?? DEFAULT_STATS[key],
    }),
    sq: overrides.sq,
    cross: overrides.cross,
  }),
});

// A game log from flat box-score fields (absent ones are 0) and minutes.
type MakeLogProps = Partial<FlatStats> & { minutes: number };

export const makeLog = (overrides: MakeLogProps): WindowLog => ({
  playingTime: overrides.minutes,
  stats: recordFromKeys({ keys: VALUED_STATS, value: (key) => overrides[key] ?? 0 }),
});

type MakeDatedLogProps = Partial<FlatStats> & { minutes: number; gameDate: Date };

export const makeDatedLog = (overrides: MakeDatedLogProps): DatedLog => ({
  ...makeLog(overrides),
  gameDate: overrides.gameDate,
});
