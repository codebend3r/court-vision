import { ADVANCED_METRIC_KEYS, type AdvancedMetricKey } from "@/lib/players/searchParams";
import type { StatMode } from "@/lib/stats/searchParams";

// The box-score log is the spine of the series: it decides game numbering,
// dates, matchups, and DNPs, so the advanced chart's x-axis lines up with the
// regular chart and the game log table. Advanced rows attach by gameId.
export type AdvancedSourceLog = {
  gameId: string;
  gameDate: Date;
  matchup: string;
  winLoss: string | null;
  minutes: number;
};

export type AdvancedSeriesLog = Record<AdvancedMetricKey, number | null> & { gameId: string };

// Two readings only: the game's own value, or the running mean of every game
// so far that recorded the metric. Totals and per-36 are meaningless for rates.
export type AdvancedSeriesMode = "game" | "avg";

export const ADVANCED_MODES: readonly StatMode[] = ["game", "avg"];

// The URL's mode may have been picked on the regular view; every cumulative
// reading of a rate collapses to its running average here.
export const toAdvancedMode = ({ mode }: { mode: StatMode }): AdvancedSeriesMode =>
  mode === "game" ? "game" : "avg";

export type AdvancedPoint = Record<AdvancedMetricKey, number | null> & {
  gameIndex: number;
  gameDate: string;
  matchup: string;
  winLoss: string | null;
  dnp: boolean;
};

type Running = { sum: number; count: number };
type RunningByKey = Record<AdvancedMetricKey, Running>;

const EMPTY_RUNNING: RunningByKey = {
  pie: { sum: 0, count: 0 },
  pace: { sum: 0, count: 0 },
  assistPercentage: { sum: 0, count: 0 },
  assistRatio: { sum: 0, count: 0 },
  assistToTurnover: { sum: 0, count: 0 },
  defensiveRating: { sum: 0, count: 0 },
  defensiveReboundPercentage: { sum: 0, count: 0 },
  effectiveFieldGoalPercentage: { sum: 0, count: 0 },
  netRating: { sum: 0, count: 0 },
  offensiveRating: { sum: 0, count: 0 },
  offensiveReboundPercentage: { sum: 0, count: 0 },
  reboundPercentage: { sum: 0, count: 0 },
  trueShootingPercentage: { sum: 0, count: 0 },
  turnoverRatio: { sum: 0, count: 0 },
  usagePercentage: { sum: 0, count: 0 },
};

const NULL_METRICS: Record<AdvancedMetricKey, number | null> = {
  pie: null,
  pace: null,
  assistPercentage: null,
  assistRatio: null,
  assistToTurnover: null,
  defensiveRating: null,
  defensiveReboundPercentage: null,
  effectiveFieldGoalPercentage: null,
  netRating: null,
  offensiveRating: null,
  offensiveReboundPercentage: null,
  reboundPercentage: null,
  trueShootingPercentage: null,
  turnoverRatio: null,
  usagePercentage: null,
};

// One game's fifteen metrics from a stored advanced row, without its ids and
// dates: what the game log needs, and nothing more to serialize.
export const pickAdvancedMetrics = ({
  log,
}: {
  log: AdvancedSeriesLog;
}): Record<AdvancedMetricKey, number | null> =>
  ADVANCED_METRIC_KEYS.reduce<Record<AdvancedMetricKey, number | null>>(
    (acc, key) => ({ ...acc, [key]: log[key] }),
    NULL_METRICS,
  );

export const buildAdvancedSeries = ({
  logs,
  advancedLogs,
  mode,
}: {
  logs: readonly AdvancedSourceLog[];
  advancedLogs: readonly AdvancedSeriesLog[];
  mode: AdvancedSeriesMode;
}): AdvancedPoint[] => {
  const byGameId = new Map(advancedLogs.map((row) => [row.gameId, row]));

  const { points } = logs.reduce<{ points: AdvancedPoint[]; running: RunningByKey }>(
    (acc, log, index) => {
      const row = byGameId.get(log.gameId);
      // A null metric neither counts toward nor breaks the running mean; the
      // mean stays null until the metric first appears.
      const running = ADVANCED_METRIC_KEYS.reduce<RunningByKey>((next, key) => {
        const value = row?.[key] ?? null;
        const previous = acc.running[key];
        return {
          ...next,
          [key]:
            value === null ? previous : { sum: previous.sum + value, count: previous.count + 1 },
        };
      }, acc.running);
      const metrics = ADVANCED_METRIC_KEYS.reduce<Record<AdvancedMetricKey, number | null>>(
        (next, key) => {
          if (mode === "game") return { ...next, [key]: row?.[key] ?? null };
          const { sum, count } = running[key];
          return { ...next, [key]: count === 0 ? null : sum / count };
        },
        NULL_METRICS,
      );
      const point: AdvancedPoint = {
        ...metrics,
        gameIndex: index + 1,
        gameDate: log.gameDate.toISOString(),
        matchup: log.matchup,
        winLoss: log.winLoss,
        dnp: log.minutes === 0,
      };
      return { points: [...acc.points, point], running };
    },
    { points: [], running: EMPTY_RUNNING },
  );

  return points;
};
