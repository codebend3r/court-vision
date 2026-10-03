import { aggregateWindowLogs, type WindowLog } from "@/lib/valuation/aggregate";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import {
  type FantasyStatLine,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";

// Ten games is the shortest window that smooths a single blow-up game without
// lagging a real change in role.
export const ROLLING_WINDOW_GAMES = 10;

export type DatedLog = WindowLog & { gameDate: Date };
export type TrendPoint = { date: number; value: number };
export type TrendSeries = { playerId: number; fullName: string; points: TrendPoint[] };

type TrendScorer = (args: {
  lines: readonly FantasyStatLine[];
  poolStats: PoolStats;
  config: ValuationConfig;
}) => PlayerValue[];

// The scorers take whole stat lines, but read only the stat fields; the
// identity below exists to satisfy the type, not to be displayed.
const identity = ({ playerId, fullName }: { playerId: number; fullName: string }) => ({
  playerId,
  firstName: fullName.split(" ")[0] ?? fullName,
  lastName: fullName.split(" ").slice(1).join(" "),
  fullName,
  teamAbbr: null,
  position: null,
  nbaPersonId: null,
});

export type RollingSeriesArgs = {
  playerId: number;
  fullName: string;
  logs: readonly DatedLog[];
  poolStats: PoolStats;
  config: ValuationConfig;
  windowSize?: number;
};

// The rolling stat line ending at a game: that game and the windowSize − 1
// before it, under the player's identity. Null until the window fills. Bound
// to one player's logs so the identity is built once per series, and a caller
// scoring a window more than once (Z and G) aggregates it only once.
export const rollingWindowLines = ({
  playerId,
  fullName,
  logs,
  windowSize = ROLLING_WINDOW_GAMES,
}: Pick<RollingSeriesArgs, "playerId" | "fullName" | "logs" | "windowSize">) => {
  const player = identity({ playerId, fullName });
  return ({ index }: { index: number }): FantasyStatLine | null =>
    index + 1 < windowSize
      ? null
      : {
          ...player,
          ...aggregateWindowLogs({ logs: logs.slice(index + 1 - windowSize, index + 1) }),
        };
};

// One point per game from the window size onward: each scores that game and
// the previous nine, measured against a pool the caller holds fixed for the
// whole season. A rising line is the player improving, not the yardstick
// moving.
const buildRollingSeries = ({
  playerId,
  fullName,
  logs,
  poolStats,
  config,
  scorer,
  windowSize = ROLLING_WINDOW_GAMES,
}: RollingSeriesArgs & { scorer: TrendScorer }): TrendSeries => {
  // Under a full window there is no honest number to plot; the chart says so in
  // its legend rather than drawing a stub.
  if (logs.length < windowSize) {
    return { playerId, fullName, points: [] };
  }
  const lineEndingAt = rollingWindowLines({ playerId, fullName, logs, windowSize });
  const points = logs.flatMap((log, index): TrendPoint[] => {
    const line = lineEndingAt({ index });
    if (line === null) return [];
    const [value] = scorer({ lines: [line], poolStats, config });
    return [{ date: log.gameDate.getTime(), value: value?.total ?? 0 }];
  });
  return { playerId, fullName, points };
};

export const buildRollingZSeries = (args: RollingSeriesArgs): TrendSeries =>
  buildRollingSeries({ ...args, scorer: scoreZScore });

export const buildRollingGSeries = (args: RollingSeriesArgs): TrendSeries =>
  buildRollingSeries({ ...args, scorer: scoreGScore });
