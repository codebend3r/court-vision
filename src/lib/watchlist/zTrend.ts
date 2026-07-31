import { aggregateWindowLogs, type WindowLog } from "@/lib/valuation/aggregate";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { type FantasyStatLine, type PoolStats, type ValuationConfig } from "@/lib/valuation/types";

// Ten games is the shortest window that smooths a single blow-up game without
// lagging a real change in role.
export const ROLLING_WINDOW_GAMES = 10;

export type DatedLog = WindowLog & { gameDate: Date };
export type ZTrendPoint = { date: number; z: number };
export type ZTrendSeries = { playerId: number; fullName: string; points: ZTrendPoint[] };

// scoreZScore takes whole stat lines, but reads only the stat fields; the
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

// One point per game from the window size onward: each is the z-score of that
// game and the previous nine, measured against a pool the caller holds fixed
// for the whole season. A rising line is the player improving, not the
// yardstick moving.
export const buildRollingZSeries = ({
  playerId,
  fullName,
  logs,
  poolStats,
  config,
  windowSize = ROLLING_WINDOW_GAMES,
}: {
  playerId: number;
  fullName: string;
  logs: readonly DatedLog[];
  poolStats: PoolStats;
  config: ValuationConfig;
  windowSize?: number;
}): ZTrendSeries => {
  // Under a full window there is no honest number to plot; the chart says so in
  // its legend rather than drawing a stub.
  if (logs.length < windowSize) {
    return { playerId, fullName, points: [] };
  }
  const points = logs.reduce<ZTrendPoint[]>((acc, log, index) => {
    if (index + 1 < windowSize) return acc;
    const window = logs.slice(index + 1 - windowSize, index + 1);
    const line: FantasyStatLine = {
      ...identity({ playerId, fullName }),
      ...aggregateWindowLogs({ logs: window }),
    };
    const [value] = scoreZScore({ lines: [line], poolStats, config });
    return [...acc, { date: log.gameDate.getTime(), z: value?.total ?? 0 }];
  }, []);
  return { playerId, fullName, points };
};
