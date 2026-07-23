import type { StatKey } from "@/lib/valuation/types";

export type WindowLog = Record<StatKey, number> & { minutes: number };

export type WindowTotals = WindowLog & {
  gamesPlayed: number;
  sq: Record<StatKey, number>;
  cross: { fg: number; ft: number };
};

const STAT_KEYS: readonly StatKey[] = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fg3m",
  "tov",
  "fgm",
  "fga",
  "ftm",
  "fta",
];

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
export const aggregateWindowLogs = ({ logs }: { logs: readonly WindowLog[] }): WindowTotals =>
  logs.reduce<WindowTotals>(
    (totals, game) => ({
      ...STAT_KEYS.reduce<WindowTotals>(
        (acc, key) => ({
          ...acc,
          [key]: acc[key] + game[key],
          sq: { ...acc.sq, [key]: acc.sq[key] + game[key] * game[key] },
        }),
        totals,
      ),
      gamesPlayed: totals.gamesPlayed + (game.minutes > 0 ? 1 : 0),
      minutes: totals.minutes + game.minutes,
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
