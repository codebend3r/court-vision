import type { StatMode } from "@/lib/stats/searchParams";

export type CumulativeSourceLog = {
  gameDate: Date;
  matchup: string;
  winLoss: string | null;
  minutes: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
};

export type CumulativePoint = {
  gameIndex: number;
  gameDate: string;
  matchup: string;
  winLoss: string | null;
  dnp: boolean;
  min: number;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
};

// game: individual-game value; avg: running mean; totals: running sum; per36:
// running sum scaled to a 36-minute pace (null until any minutes accrue).
// Shooting percentages are ratio-of-sums in every mode, but the game chart
// deliberately omits them because it focuses on raw counting stats.
const countingValue = (args: {
  currentValue: number;
  total: number;
  gameIndex: number;
  minutesTotal: number;
  mode: StatMode;
}): number | null => {
  if (args.mode === "game") {
    return args.currentValue;
  }
  if (args.mode === "avg") {
    return args.total / args.gameIndex;
  }
  if (args.mode === "totals") {
    return args.total;
  }
  return args.minutesTotal === 0 ? null : (args.total / args.minutesTotal) * 36;
};

export const buildStatSeries = (args: {
  logs: CumulativeSourceLog[];
  mode: StatMode;
}): CumulativePoint[] => {
  type Accumulator = {
    points: CumulativePoint[];
    totals: {
      minutes: number;
      pts: number;
      reb: number;
      ast: number;
      stl: number;
      blk: number;
      tov: number;
      fgm: number;
      fga: number;
      fg3m: number;
      fg3a: number;
      ftm: number;
      fta: number;
    };
  };

  const initial: Accumulator = {
    points: [],
    totals: {
      minutes: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
    },
  };

  const { points } = args.logs.reduce((acc, log, index) => {
    const gameIndex = index + 1;

    const newTotals = {
      minutes: acc.totals.minutes + log.minutes,
      pts: acc.totals.pts + log.pts,
      reb: acc.totals.reb + log.reb,
      ast: acc.totals.ast + log.ast,
      stl: acc.totals.stl + log.stl,
      blk: acc.totals.blk + log.blk,
      tov: acc.totals.tov + log.tov,
      fgm: acc.totals.fgm + log.fgm,
      fga: acc.totals.fga + log.fga,
      fg3m: acc.totals.fg3m + log.fg3m,
      fg3a: acc.totals.fg3a + log.fg3a,
      ftm: acc.totals.ftm + log.ftm,
      fta: acc.totals.fta + log.fta,
    };

    const counting = (total: number, currentValue: number): number | null =>
      countingValue({
        currentValue,
        total,
        gameIndex,
        minutesTotal: newTotals.minutes,
        mode: args.mode,
      });

    const point: CumulativePoint = {
      gameIndex,
      gameDate: log.gameDate.toISOString(),
      matchup: log.matchup,
      winLoss: log.winLoss,
      dnp: log.minutes === 0,
      // per36 minutes would be the constant 36, so min carries the running
      // minutes total in both totals and per36 modes.
      min:
        args.mode === "game"
          ? log.minutes
          : args.mode === "avg"
            ? newTotals.minutes / gameIndex
            : newTotals.minutes,
      pts: counting(newTotals.pts, log.pts),
      reb: counting(newTotals.reb, log.reb),
      ast: counting(newTotals.ast, log.ast),
      stl: counting(newTotals.stl, log.stl),
      blk: counting(newTotals.blk, log.blk),
      tov: counting(newTotals.tov, log.tov),
      fgPct: newTotals.fga === 0 ? null : (100 * newTotals.fgm) / newTotals.fga,
      fg3Pct: newTotals.fg3a === 0 ? null : (100 * newTotals.fg3m) / newTotals.fg3a,
      ftPct: newTotals.fta === 0 ? null : (100 * newTotals.ftm) / newTotals.fta,
    };

    return {
      points: [...acc.points, point],
      totals: newTotals,
    };
  }, initial);

  return points;
};
