import { type StatKey } from "@/lib/valuation/types";

export type WindowLog = Record<StatKey, number> & { minutes: number };

export type WindowTotals = WindowLog & {
  gamesPlayed: number;
  sq: Record<StatKey, number>;
  cross: { fg: number; ft: number };
};

const ZERO_STATS: Record<StatKey, number> = {
  pts: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  fg3m: 0,
  tov: 0,
  fgm: 0,
  fga: 0,
  ftm: 0,
  fta: 0,
};

// Collapses a lastN game-log window into one stat line. An appearance is a
// game with minutes; a DNP contributes nothing but also costs nothing. The
// second moments (sums of squares, made·attempt cross products) let the
// scorer reconstruct game-level variance for any league percentage without
// re-reading the logs (G-Score's within-player term).
//
// One accumulator object per game, not one per stat key per game: rolling
// trends re-aggregate a ten-game window for every plotted point, and the
// nested-spread version allocated ~8x the objects for the same totals.
export const aggregateWindowLogs = ({ logs }: { logs: readonly WindowLog[] }): WindowTotals =>
  logs.reduce<WindowTotals>(
    (totals, game) => ({
      pts: totals.pts + game.pts,
      reb: totals.reb + game.reb,
      ast: totals.ast + game.ast,
      stl: totals.stl + game.stl,
      blk: totals.blk + game.blk,
      fg3m: totals.fg3m + game.fg3m,
      tov: totals.tov + game.tov,
      fgm: totals.fgm + game.fgm,
      fga: totals.fga + game.fga,
      ftm: totals.ftm + game.ftm,
      fta: totals.fta + game.fta,
      gamesPlayed: totals.gamesPlayed + (game.minutes > 0 ? 1 : 0),
      minutes: totals.minutes + game.minutes,
      sq: {
        pts: totals.sq.pts + game.pts * game.pts,
        reb: totals.sq.reb + game.reb * game.reb,
        ast: totals.sq.ast + game.ast * game.ast,
        stl: totals.sq.stl + game.stl * game.stl,
        blk: totals.sq.blk + game.blk * game.blk,
        fg3m: totals.sq.fg3m + game.fg3m * game.fg3m,
        tov: totals.sq.tov + game.tov * game.tov,
        fgm: totals.sq.fgm + game.fgm * game.fgm,
        fga: totals.sq.fga + game.fga * game.fga,
        ftm: totals.sq.ftm + game.ftm * game.ftm,
        fta: totals.sq.fta + game.fta * game.fta,
      },
      cross: {
        fg: totals.cross.fg + game.fgm * game.fga,
        ft: totals.cross.ft + game.ftm * game.fta,
      },
    }),
    {
      ...ZERO_STATS,
      gamesPlayed: 0,
      minutes: 0,
      sq: { ...ZERO_STATS },
      cross: { fg: 0, ft: 0 },
    },
  );
