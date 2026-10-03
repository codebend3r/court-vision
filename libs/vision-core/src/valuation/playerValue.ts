import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { type MetricPoint } from "#core/series/metricPoint";
import { isAppearance, type DatedLog } from "#core/valuation/aggregate";
import { buildCategoryBreakdown, type FantasyCategoryBreakdown } from "#core/valuation/breakdown";
import { buildFantasyGameValues, type FantasyGameValue } from "#core/valuation/gameValues";
import { fantasyMethods } from "#core/valuation/registry";
import { type FantasyTrendValue } from "#core/valuation/trend";
import {
  type FantasyMethodKey,
  type FantasyPlayerValues,
  type MethodWeights,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";
import { valuePlayers } from "#core/valuation/valuePlayers";

// One method column's score for the viewed player, with their standing among
// every player valued in the same window (competition ranking: ties share).
export type FantasyMethodReadout = {
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
  poolSize: number;
};

export type FantasyProfileLog<K extends SportKeys> = DatedLog<K> & {
  gameId: string;
  matchup: string;
  winLoss: string | null;
};

const VALUE_BY_METHOD: Record<FantasyMethodKey, (values: FantasyPlayerValues) => number> = {
  zscore: (values) => values.z,
  gscore: (values) => values.g,
  points: (values) => values.points,
  vorp: (values) => values.vorp,
  positional: (values) => values.positional,
  sgp: (values) => values.sgp,
  simvalue: (values) => values.sim,
};

const rankAmong = ({
  values,
  value,
  pick,
}: {
  values: readonly FantasyPlayerValues[];
  value: number;
  pick: (values: FantasyPlayerValues) => number;
}): number => values.filter((entry) => pick(entry) > value).length + 1;

// Everything the fantasy view shows for one player, scored the way the Fantasy
// Value tab scores the whole pool (valuePlayers) so the two agree to the
// decimal. `poolWindowGames` is the window the pool qualifies over (null for
// the season); `logs` is the player's full season in date order, and the trend
// windows to the last `windowGames` after scoring so every plotted game still
// looks back over the ten before it.
export const buildPlayerFantasyProfile = <K extends SportKeys>({
  sport,
  lines,
  playerId,
  config,
  methodWeights,
  poolWindowGames,
  logs,
  windowGames,
}: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  playerId: number;
  config: ValuationConfig<K>;
  methodWeights: MethodWeights<K>;
  poolWindowGames: number | null;
  logs: readonly FantasyProfileLog<K>[];
  windowGames: number | null;
}): PlayerFantasyProfile<K> | null => {
  const line = lines.find((entry) => entry.playerId === playerId);
  if (line === undefined) return null;

  const { values, poolStats } = valuePlayers({
    sport,
    lines,
    config,
    methodWeights,
    windowGames: poolWindowGames,
  });
  const own = values.find((entry) => entry.playerId === playerId);
  if (own === undefined) return null;

  const readouts = fantasyMethods({ sport }).map((method): FantasyMethodReadout => {
    const pick = VALUE_BY_METHOD[method.key];
    const value = pick(own);
    return {
      key: method.key,
      label: method.label,
      value,
      rank: rankAmong({ values, value, pick }),
      of: values.length,
    };
  });

  const breakdown = buildCategoryBreakdown({ sport, line, poolStats, config, methodWeights });

  // Game values compute the full-season rolling timeline once. The chart is
  // just a window onto those same readings, with metadata from the log spine.
  const games = buildFantasyGameValues({ sport, line, logs, poolStats, config, methodWeights });
  const points = logs.map((log, index): FantasyTrendPoint => ({
    gameIndex: index + 1,
    gameNumber: index + 1,
    gameDate: log.gameDate.toISOString(),
    matchup: log.matchup,
    winLoss: log.winLoss,
    dnp: !isAppearance(log),
    z: games[index]?.rollingZ ?? null,
    g: games[index]?.rollingG ?? null,
  }));
  const windowed = windowGames === null ? points : points.slice(-windowGames);
  const trend = windowed.map((point, index) => ({ ...point, gameIndex: index + 1 }));

  return { readouts, breakdown, trend, games, poolSize: poolStats.poolSize };
};
