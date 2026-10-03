import { createSportEngine } from "#core/engine";
import {
  type RosterSlot as CoreRosterSlot,
  type SlotCounts as CoreSlotCounts,
} from "#core/roster/slots";
import { type Category as CoreCategory } from "#core/sport/types";
import {
  basketballFixture,
  parsePosition,
  POSITION_GROUPS,
  VALUED_STATS,
  type BasketballKeys,
} from "#core/testing/basketballDescriptor";
import { recordFromKeys } from "#core/util/record";
import {
  type DatedLog as CoreDatedLog,
  type WindowLog as CoreWindowLog,
  type WindowTotals as CoreWindowTotals,
} from "#core/valuation/aggregate";
import { type FantasyProfileLog as CoreFantasyProfileLog } from "#core/valuation/playerValue";
import { type SyntheticLeague as CoreSyntheticLeague } from "#core/valuation/rosters";
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
export type PositionGroup = BasketballKeys["group"];
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
export type SyntheticLeague = CoreSyntheticLeague<BasketballKeys>;

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
  buildRollingGSeries,
  buildRollingZSeries,
  buildSlots,
  categoryPerGame,
  categoryValue,
  clampSlotCount,
  computePoolStats,
  countsFromSlots,
  defaultScoringConfig,
  eligibleForSlot,
  isCategory,
  isH2hCategoriesConfig,
  isH2hPointsConfig,
  isRotoConfig,
  leagueRates,
  positionalValues,
  parseScoringConfig,
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
} = engine;

export const CATEGORY_META = engine.categoryMeta;
export const CATEGORY_KEYS = engine.categoryKeys;
export const DEFAULT_POINTS_SCORING = basketballFixture.points.defaults;
export const SCORED_KEYS = basketballFixture.points.keys;
export const FANTASY_METHODS = engine.fantasyMethods;
export const ENABLED_METHODS = engine.enabledMethods;
export const SLOT_META = basketballFixture.slots;
export const SLOT_TYPES = engine.slotTypes;
export const DEFAULT_SLOT_COUNTS = engine.defaultSlotCounts;
export const DEFAULT_GROUP_SLOTS = basketballFixture.positions.replacementSlots;
export { parsePosition as parseEligibleGroups, POSITION_GROUPS };

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

// Unless a test overrides `sq`/`cross`, the moments describe a player who
// posts an identical line every game, so within-player variance is exactly 0
// and G-Score degenerates to Z-Score — the neutral baseline most tests want.
export const makeStatLine = (overrides: FixtureOverrides): FantasyStatLine => {
  const games = overrides.gamesPlayed ?? 50;
  const stats = recordFromKeys({
    keys: VALUED_STATS,
    value: (key) => overrides[key] ?? DEFAULT_STATS[key],
  });
  const constantSq = (total: number): number => (games > 0 ? (total * total) / games : 0);
  const sq =
    overrides.sq ?? recordFromKeys({ keys: VALUED_STATS, value: (key) => constantSq(stats[key]) });
  const cross = overrides.cross ?? {
    fg: games > 0 ? (stats.fgm * stats.fga) / games : 0,
    ft: games > 0 ? (stats.ftm * stats.fta) / games : 0,
  };
  return {
    playerId: overrides.playerId,
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? `Player ${overrides.playerId}`,
    fullName: overrides.fullName ?? `Test Player ${overrides.playerId}`,
    teamAbbr: overrides.teamAbbr === undefined ? "BOS" : overrides.teamAbbr,
    position: overrides.position === undefined ? "G" : overrides.position,
    nbaPersonId: overrides.nbaPersonId ?? null,
    gamesPlayed: games,
    playingTime: overrides.minutes ?? 1500,
    stats,
    sq,
    cross,
  };
};

// A game log from flat box-score fields (absent ones are 0) and minutes.
export const makeLog = (overrides: Partial<FlatStats> & { minutes: number }): WindowLog => ({
  playingTime: overrides.minutes,
  stats: recordFromKeys({ keys: VALUED_STATS, value: (key) => overrides[key] ?? 0 }),
});

export const makeDatedLog = (
  overrides: Partial<FlatStats> & { minutes: number; gameDate: Date },
): DatedLog => ({ ...makeLog(overrides), gameDate: overrides.gameDate });
