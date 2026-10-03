import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { aggregateWindowLogs, type DatedLog } from "#core/valuation/aggregate";
import { scoreGScore } from "#core/valuation/methods/gscore";
import { scoreZScore } from "#core/valuation/methods/zscore";
import {
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";

// Ten games is the shortest window that smooths a single blow-up game without
// lagging a real change in role.
export const ROLLING_WINDOW_GAMES = 10;

export type TrendPoint = { date: number; value: number };
export type TrendSeries = { playerId: number; fullName: string; points: TrendPoint[] };

type TrendScorer<K extends SportKeys> = (args: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
}) => PlayerValue<K>[];

export type RollingSeriesArgs<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  playerId: number;
  fullName: string;
  logs: readonly DatedLog<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
  windowSize?: number;
};

// The rolling stat line ending at a game: that game and the windowSize − 1
// before it. Null until the window fills. Bound to one player's logs so a
// caller scoring a window more than once (Z and G) aggregates it only once.
export const rollingWindowLines =
  <K extends SportKeys>({
    sport,
    playerId,
    logs,
    windowSize = ROLLING_WINDOW_GAMES,
  }: Pick<RollingSeriesArgs<K>, "sport" | "playerId" | "logs" | "windowSize">) =>
  ({ index }: { index: number }): ValuationLine<K> | null =>
    index + 1 < windowSize
      ? null
      : {
          playerId,
          position: null,
          ...aggregateWindowLogs({ sport, logs: logs.slice(index + 1 - windowSize, index + 1) }),
        };

// One point per game from the window size onward: each scores that game and
// the previous nine, measured against a pool the caller holds fixed for the
// whole season. A rising line is the player improving, not the yardstick
// moving.
const buildRollingSeries = <K extends SportKeys>({
  sport,
  playerId,
  fullName,
  logs,
  poolStats,
  config,
  scorer,
  windowSize = ROLLING_WINDOW_GAMES,
}: RollingSeriesArgs<K> & { scorer: TrendScorer<K> }): TrendSeries => {
  // Under a full window there is no honest number to plot; the chart says so in
  // its legend rather than drawing a stub.
  if (logs.length < windowSize) {
    return { playerId, fullName, points: [] };
  }
  const lineEndingAt = rollingWindowLines({ sport, playerId, logs, windowSize });
  const points = logs.flatMap((log, index): TrendPoint[] => {
    const line = lineEndingAt({ index });
    if (line === null) return [];
    const [value] = scorer({ sport, lines: [line], poolStats, config });
    return [{ date: log.gameDate.getTime(), value: value?.total ?? 0 }];
  });
  return { playerId, fullName, points };
};

export const buildRollingZSeries = <K extends SportKeys>(args: RollingSeriesArgs<K>): TrendSeries =>
  buildRollingSeries({ ...args, scorer: scoreZScore });

export const buildRollingGSeries = <K extends SportKeys>(args: RollingSeriesArgs<K>): TrendSeries =>
  buildRollingSeries({ ...args, scorer: scoreGScore });
