import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { type MetricPoint } from "#core/series/metricPoint";
import { type DatedLog } from "#core/valuation/aggregate";
import { buildCategoryBreakdown, type FantasyCategoryBreakdown } from "#core/valuation/breakdown";
import { buildFantasyGameValues, type FantasyGameValue } from "#core/valuation/gameValues";
import { fantasyMethods } from "#core/valuation/registry";
import { poolStatsFor } from "#core/valuation/pool";
import {
  type DatedAverageLine,
  type DatedMethodValues,
  scoreAverageLines,
} from "#core/valuation/leagueAverage";
import { buildFantasyTrend, type FantasyTrendValue } from "#core/valuation/trend";
import {
  type FantasyMethodKey,
  type FantasyPlayerValues,
  type MethodValueKey,
  type MethodWeights,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";
import { buildYardstick } from "#core/valuation/yardstick";

// One method column's score for the viewed player, with their standing among
// every player valued in the same window (competition ranking: ties share).
type FantasyMethodReadout = {
  key: FantasyMethodKey;
  label: string;
  value: number;
  rank: number;
  of: number;
};

// Rolling value per game: null until the window fills, so the chart draws
// nothing rather than a stub built on too few games.
export type FantasyTrendPoint = FantasyTrendValue & Pick<MetricPoint, "matchup" | "winLoss">;

export type PlayerFantasyProfile<K extends SportKeys> = {
  readouts: FantasyMethodReadout[];
  breakdown: FantasyCategoryBreakdown<K>[];
  trend: FantasyTrendPoint[];
  // Every game in `logs`, unwindowed and aligned by index, for the game log.
  games: FantasyGameValue<K>[];
  // The league's average rolling value on every method, per game date, scored
  // like the player's own trend: the chart's moving league-average line.
  averages: DatedMethodValues[];
  poolSize: number;
};

export type FantasyProfileLog<K extends SportKeys> = DatedLog<K> & {
  gameId: string;
  matchup: string;
  winLoss: string | null;
};

type RankAmongProps = {
  values: readonly FantasyPlayerValues[];
  value: number;
  valueKey: MethodValueKey;
};

const rankAmong = ({ values, value, valueKey }: RankAmongProps): number =>
  values.filter((entry) => entry[valueKey] > value).length + 1;

// Everything the fantasy view shows for one player, scored the way the Fantasy
// Value tab scores the whole pool (valuePlayers) so the two agree to the
// decimal. `poolWindowGames` is the window the pool qualifies over (null for
// the season); `logs` is the player's full season in date order, and the trend
// windows to the last `windowGames` after scoring so every plotted game still
// looks back over the ten before it.
type BuildPlayerFantasyProfileProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  playerId: number;
  config: ValuationConfig<K>;
  methodWeights: MethodWeights<K>;
  poolWindowGames: number | null;
  logs: readonly FantasyProfileLog<K>[];
  windowGames: number | null;
  // The season's league-average rolling line per game date.
  averageLines: readonly DatedAverageLine<K>[];
};

export const buildPlayerFantasyProfile = <K extends SportKeys>({
  sport,
  lines,
  playerId,
  config,
  methodWeights,
  poolWindowGames,
  logs,
  windowGames,
  averageLines,
}: BuildPlayerFantasyProfileProps<K>): PlayerFantasyProfile<K> | null => {
  const line = lines.find((entry) => entry.playerId === playerId);
  if (line === undefined) return null;

  const poolStats = poolStatsFor({ sport, lines, config, windowGames: poolWindowGames });
  // Built once: the season values and every rolling window share it.
  const yardstick = buildYardstick({ sport, lines, poolStats, config, methodWeights });
  const values = yardstick.value({ lines });
  const own = values.find((entry) => entry.playerId === playerId);
  if (own === undefined) return null;

  const readouts = fantasyMethods({ sport }).map((method): FantasyMethodReadout => {
    const value = own[method.valueKey];
    return {
      key: method.key,
      label: method.label,
      value,
      rank: rankAmong({ values, value, valueKey: method.valueKey }),
      of: values.length,
    };
  });

  const breakdown = buildCategoryBreakdown({ sport, line, poolStats, config, methodWeights });

  // The full-season rolling timeline, computed once: the game log reads every
  // game of it, and the chart is a window onto the same readings, with
  // metadata from the log spine.
  const season = buildFantasyTrend({ sport, line, logs, yardstick, windowGames: null });
  const games = buildFantasyGameValues({
    sport,
    line,
    logs,
    season,
    poolStats,
    config,
    methodWeights,
  });
  const points = season.flatMap((value, index): FantasyTrendPoint[] => {
    const log = logs[index];
    return log === undefined ? [] : [{ ...value, matchup: log.matchup, winLoss: log.winLoss }];
  });
  const windowed = windowGames === null ? points : points.slice(-windowGames);
  const trend = windowed.map((point, index) => ({ ...point, gameIndex: index + 1 }));

  return {
    readouts,
    breakdown,
    trend,
    games,
    averages: scoreAverageLines({ yardstick, lines: averageLines }),
    poolSize: poolStats.poolSize,
  };
};
