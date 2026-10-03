import {
  defaultScoringConfig,
  parseScoringConfig,
  scoringConfigGuards,
} from "#core/league/scoring";
import { buildPlayerInsights } from "#core/roster/insights";
import {
  autoAssignSlotId,
  buildSlots,
  clampSlotCount,
  countsFromSlots,
  defaultSlotCounts,
  eligibleForSlot,
  resizeSlots,
  rosterSize,
  slotMeta,
  slotTypes,
  type RosterPlayer,
} from "#core/roster/slots";
import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { aggregateWindowLogs } from "#core/valuation/aggregate";
import { buildCategoryBreakdown } from "#core/valuation/breakdown";
import {
  categoryDef,
  categoryGuard,
  categoryMeta,
  categoryPerGame,
  categoryValue,
} from "#core/valuation/categories";
import { defaultValuationConfig } from "#core/valuation/config";
import { buildFantasyGameValues } from "#core/valuation/gameValues";
import { scoreGScore } from "#core/valuation/methods/gscore";
import { scorePoints } from "#core/valuation/methods/points";
import { scoreSGP, standingsGainDenominators } from "#core/valuation/methods/sgp";
import { scoreSimValue } from "#core/valuation/methods/simvalue";
import { scoreZScore } from "#core/valuation/methods/zscore";
import { positionalValues } from "#core/valuation/modifiers/positional";
import { buildPlayerFantasyProfile } from "#core/valuation/playerValue";
import { computePoolStats, leagueRates } from "#core/valuation/pool";
import { enabledMethods, fantasyMethods } from "#core/valuation/registry";
import {
  buildRollingGSeries,
  buildRollingZSeries,
  rollingWindowLines,
} from "#core/valuation/rolling";
import { buildLeague, rankByValue } from "#core/valuation/rosters";
import { buildFantasyTrend } from "#core/valuation/trend";
import { type ValuationLine } from "#core/valuation/types";
import { valuePlayers } from "#core/valuation/valuePlayers";

// A function's argument object minus the sport the engine already holds.
type WithoutSport<T> = Omit<T, "sport">;

// The whole engine bound to one sport: an app builds this once and calls
// every function without threading its descriptor through each call. Each
// function's own module stays the source of truth (and takes `sport`
// explicitly), so a binding here is never more than a forward.
export const createSportEngine = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}) => {
  const methods = fantasyMethods({ sport });
  return {
    sport,
    categoryMeta: categoryMeta({ sport }),
    categoryKeys: sport.categoryOrder,
    isCategory: categoryGuard({ sport }),
    fantasyMethods: methods,
    enabledMethods: enabledMethods({ methods }),
    slotTypes: slotTypes({ sport }),
    defaultSlotCounts: defaultSlotCounts({ sport }),
    defaultValuationConfig: defaultValuationConfig({ sport }),
    ...scoringConfigGuards({ sport }),

    categoryDef: (args: WithoutSport<Parameters<typeof categoryDef<K>>[0]>) =>
      categoryDef<K>({ ...args, sport }),
    categoryValue: (args: WithoutSport<Parameters<typeof categoryValue<K>>[0]>) =>
      categoryValue<K>({ ...args, sport }),
    categoryPerGame: (args: WithoutSport<Parameters<typeof categoryPerGame<K>>[0]>) =>
      categoryPerGame<K>({ ...args, sport }),
    leagueRates: (args: WithoutSport<Parameters<typeof leagueRates<K>>[0]>) =>
      leagueRates<K>({ ...args, sport }),
    computePoolStats: (args: WithoutSport<Parameters<typeof computePoolStats<K>>[0]>) =>
      computePoolStats<K>({ ...args, sport }),
    aggregateWindowLogs: (args: WithoutSport<Parameters<typeof aggregateWindowLogs<K>>[0]>) =>
      aggregateWindowLogs<K>({ ...args, sport }),
    scoreZScore: (args: WithoutSport<Parameters<typeof scoreZScore<K>>[0]>) =>
      scoreZScore<K>({ ...args, sport }),
    scoreGScore: (args: WithoutSport<Parameters<typeof scoreGScore<K>>[0]>) =>
      scoreGScore<K>({ ...args, sport }),
    scorePoints: (args: WithoutSport<Parameters<typeof scorePoints<K>>[0]>) =>
      scorePoints<K>({ ...args, sport }),
    scoreSGP: (args: WithoutSport<Parameters<typeof scoreSGP<K>>[0]>) =>
      scoreSGP<K>({ ...args, sport }),
    standingsGainDenominators: (
      args: WithoutSport<Parameters<typeof standingsGainDenominators<K>>[0]>,
    ) => standingsGainDenominators<K>({ ...args, sport }),
    scoreSimValue: (args: WithoutSport<Parameters<typeof scoreSimValue<K>>[0]>) =>
      scoreSimValue<K>({ ...args, sport }),
    positionalValues: (args: WithoutSport<Parameters<typeof positionalValues<K>>[0]>) =>
      positionalValues<K>({ ...args, sport }),
    rankByValue: <L extends ValuationLine<K>>(
      args: WithoutSport<Parameters<typeof rankByValue<K, L>>[0]>,
    ) => rankByValue<K, L>({ ...args, sport }),
    buildLeague: (args: WithoutSport<Parameters<typeof buildLeague<K>>[0]>) =>
      buildLeague<K>({ ...args, sport }),
    valuePlayers: (args: WithoutSport<Parameters<typeof valuePlayers<K>>[0]>) =>
      valuePlayers<K>({ ...args, sport }),
    buildCategoryBreakdown: (args: WithoutSport<Parameters<typeof buildCategoryBreakdown<K>>[0]>) =>
      buildCategoryBreakdown<K>({ ...args, sport }),
    buildFantasyGameValues: (args: WithoutSport<Parameters<typeof buildFantasyGameValues<K>>[0]>) =>
      buildFantasyGameValues<K>({ ...args, sport }),
    buildFantasyTrend: (args: WithoutSport<Parameters<typeof buildFantasyTrend<K>>[0]>) =>
      buildFantasyTrend<K>({ ...args, sport }),
    rollingWindowLines: (args: WithoutSport<Parameters<typeof rollingWindowLines<K>>[0]>) =>
      rollingWindowLines<K>({ ...args, sport }),
    buildRollingZSeries: (args: WithoutSport<Parameters<typeof buildRollingZSeries<K>>[0]>) =>
      buildRollingZSeries<K>({ ...args, sport }),
    buildRollingGSeries: (args: WithoutSport<Parameters<typeof buildRollingGSeries<K>>[0]>) =>
      buildRollingGSeries<K>({ ...args, sport }),
    buildPlayerFantasyProfile: (
      args: WithoutSport<Parameters<typeof buildPlayerFantasyProfile<K>>[0]>,
    ) => buildPlayerFantasyProfile<K>({ ...args, sport }),

    buildPlayerInsights: (args: WithoutSport<Parameters<typeof buildPlayerInsights<K>>[0]>) =>
      buildPlayerInsights<K>({ ...args, sport }),

    defaultScoringConfig: (args: WithoutSport<Parameters<typeof defaultScoringConfig<K>>[0]>) =>
      defaultScoringConfig<K>({ ...args, sport }),
    parseScoringConfig: (args: WithoutSport<Parameters<typeof parseScoringConfig<K>>[0]>) =>
      parseScoringConfig<K>({ ...args, sport }),

    slotMeta: (args: WithoutSport<Parameters<typeof slotMeta<K>>[0]>) =>
      slotMeta<K>({ ...args, sport }),
    clampSlotCount: (args: WithoutSport<Parameters<typeof clampSlotCount<K>>[0]>) =>
      clampSlotCount<K>({ ...args, sport }),
    rosterSize: (args: WithoutSport<Parameters<typeof rosterSize<K>>[0]>) =>
      rosterSize<K>({ ...args, sport }),
    eligibleForSlot: (args: WithoutSport<Parameters<typeof eligibleForSlot<K>>[0]>) =>
      eligibleForSlot<K>({ ...args, sport }),
    buildSlots: <P extends RosterPlayer>(
      args: WithoutSport<Parameters<typeof buildSlots<K, P>>[0]>,
    ) => buildSlots<K, P>({ ...args, sport }),
    resizeSlots: <P extends RosterPlayer>(
      args: WithoutSport<Parameters<typeof resizeSlots<K, P>>[0]>,
    ) => resizeSlots<K, P>({ ...args, sport }),
    countsFromSlots: <P extends RosterPlayer>(
      args: WithoutSport<Parameters<typeof countsFromSlots<K, P>>[0]>,
    ) => countsFromSlots<K, P>({ ...args, sport }),
    autoAssignSlotId: <P extends RosterPlayer>(
      args: WithoutSport<Parameters<typeof autoAssignSlotId<K, P>>[0]>,
    ) => autoAssignSlotId<K, P>({ ...args, sport }),
  };
};

export type SportEngine<K extends SportKeys> = ReturnType<typeof createSportEngine<K>>;
