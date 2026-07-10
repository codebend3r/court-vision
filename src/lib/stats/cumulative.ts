export interface CumulativeSourceLog {
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
}

export interface CumulativePoint {
  gameIndex: number;
  gameDate: string;
  matchup: string;
  winLoss: string | null;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
}

export const buildCumulativeSeries = (args: { logs: CumulativeSourceLog[] }): CumulativePoint[] => {
  const { points } = args.logs.reduce(
    (acc, log, index) => {
      const gameIndex = index + 1;

      // Update running totals
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

      // Calculate cumulative means and percentages
      const point: CumulativePoint = {
        gameIndex,
        gameDate: log.gameDate.toISOString(),
        matchup: log.matchup,
        winLoss: log.winLoss,
        min: newTotals.minutes / gameIndex,
        pts: newTotals.pts / gameIndex,
        reb: newTotals.reb / gameIndex,
        ast: newTotals.ast / gameIndex,
        stl: newTotals.stl / gameIndex,
        blk: newTotals.blk / gameIndex,
        tov: newTotals.tov / gameIndex,
        fgPct: newTotals.fga === 0 ? null : (100 * newTotals.fgm) / newTotals.fga,
        fg3Pct: newTotals.fg3a === 0 ? null : (100 * newTotals.fg3m) / newTotals.fg3a,
        ftPct: newTotals.fta === 0 ? null : (100 * newTotals.ftm) / newTotals.fta,
      };

      return {
        points: [...acc.points, point],
        totals: newTotals,
      };
    },
    {
      points: [] as CumulativePoint[],
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
    },
  );

  return points;
};
