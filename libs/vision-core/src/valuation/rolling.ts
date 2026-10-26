import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { aggregateWindowLogs, type DatedLog } from "#core/valuation/aggregate";
import { scoreGScore } from "#core/valuation/methods/gscore";
import { type CategoryScoringConfig } from "#core/valuation/methods/perCategory";
import { scoreZScore } from "#core/valuation/methods/zscore";
import { type PoolStats, type ValuationLine } from "#core/valuation/types";

// Ten games is the shortest window that smooths a single blow-up game without
// lagging a real change in role.
export const ROLLING_WINDOW_GAMES = 10;

// The two methods a rolling trend reads: Z-Score, or G-Score's volatility-
// damped version of it.
export type RollingMethod = "z" | "g";

export type TrendPoint = { date: number; value: number };
export type TrendSeries = { playerId: number; fullName: string; points: TrendPoint[] };

export type RollingSeriesArgs<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  playerId: number;
  fullName: string;
  logs: readonly DatedLog<K>[];
  poolStats: PoolStats<K>;
  config: CategoryScoringConfig<K>;
  windowSize?: number;
};

// The rolling stat line ending at a game: that game and the windowSize − 1
// before it. Null until the window fills. Bound to one player's logs so a
// caller scoring a window more than once (Z and G) aggregates it only once.
type RollingWindowLinesProps = { index: number };

export const rollingWindowLines =
  <K extends SportKeys>({
    sport,
    playerId,
    logs,
    windowSize = ROLLING_WINDOW_GAMES,
  }: Pick<RollingSeriesArgs<K>, "sport" | "playerId" | "logs" | "windowSize">) =>
  ({ index }: RollingWindowLinesProps): ValuationLine<K> | null =>
    index + 1 < windowSize
      ? null
      : {
          playerId,
          position: null,
          ...aggregateWindowLogs({ sport, logs: logs.slice(index + 1 - windowSize, index + 1) }),
        };

// One rolling line's total under a method, against a pool the caller holds
// fixed. Every rolling reading (the watchlist series, the Fantasy tab's and
// the player page's trends) is scored here.
type RollingValueProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  method: RollingMethod;
  line: ValuationLine<K>;
  poolStats: PoolStats<K>;
  config: CategoryScoringConfig<K>;
};

export const rollingValue = <K extends SportKeys>({
  sport,
  method,
  line,
  poolStats,
  config,
}: RollingValueProps<K>): number => {
  const args = { sport, lines: [line], poolStats, config };
  const [value] = method === "z" ? scoreZScore(args) : scoreGScore(args);
  return value?.total ?? 0;
};

// One point per game from the window size onward: each scores that game and
// the previous nine, measured against a pool the caller holds fixed for the
// whole season. A rising line is the player improving, not the yardstick
// moving. Under a full window there is no honest number to plot, so a player
// short of one gets no points and the chart says so in its legend.
type BuildRollingSeriesProps<K extends SportKeys> = RollingSeriesArgs<K> & {
  method: RollingMethod;
};

export const buildRollingSeries = <K extends SportKeys>({
  sport,
  method,
  playerId,
  fullName,
  logs,
  poolStats,
  config,
  windowSize = ROLLING_WINDOW_GAMES,
}: BuildRollingSeriesProps<K>): TrendSeries => {
  const lineEndingAt = rollingWindowLines({ sport, playerId, logs, windowSize });
  const points = logs.flatMap((log, index): TrendPoint[] => {
    const line = lineEndingAt({ index });
    if (line === null) return [];
    const value = rollingValue({ sport, method, line, poolStats, config });
    return [{ date: log.gameDate.getTime(), value }];
  });
  return { playerId, fullName, points };
};
