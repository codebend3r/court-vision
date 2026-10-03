import {
  buildRunningSeries,
  type CountingSpec,
  type RatioSpec,
  type RunningMode,
} from "@vision/core/series/running";

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

type CountingKey = "pts" | "reb" | "ast" | "stl" | "blk" | "tov";
type RatioKey = "fgPct" | "fg3Pct" | "ftPct";

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

const COUNTING: readonly CountingSpec<CumulativeSourceLog, CountingKey>[] = [
  { key: "pts", value: (log) => log.pts },
  { key: "reb", value: (log) => log.reb },
  { key: "ast", value: (log) => log.ast },
  { key: "stl", value: (log) => log.stl },
  { key: "blk", value: (log) => log.blk },
  { key: "tov", value: (log) => log.tov },
];

// Shooting percentages are ratio-of-sums in every mode, but the game chart
// deliberately omits them because it focuses on raw counting stats.
const RATIOS: readonly RatioSpec<CumulativeSourceLog, RatioKey>[] = [
  { key: "fgPct", made: (log) => log.fgm, attempted: (log) => log.fga, scale: 100 },
  { key: "fg3Pct", made: (log) => log.fg3m, attempted: (log) => log.fg3a, scale: 100 },
  { key: "ftPct", made: (log) => log.ftm, attempted: (log) => log.fta, scale: 100 },
];

const RUNNING_MODE: Record<StatMode, RunningMode> = {
  game: "game",
  avg: "avg",
  totals: "totals",
  per36: "pace",
};

// The shared running series over basketball's box score. per36 is the pace
// mode at 36 minutes; min carries the running minutes total in both totals
// and per36 modes (per-36 minutes would be the constant 36).
export const buildStatSeries = (args: {
  logs: CumulativeSourceLog[];
  mode: StatMode;
}): CumulativePoint[] =>
  buildRunningSeries({
    logs: args.logs,
    mode: RUNNING_MODE[args.mode],
    playingTime: (log) => log.minutes,
    perUnit: 36,
    counting: COUNTING,
    ratios: RATIOS,
  }).map((point): CumulativePoint => ({
    gameIndex: point.gameIndex,
    gameDate: point.gameDate,
    matchup: point.matchup,
    winLoss: point.winLoss,
    dnp: point.dnp,
    min: point.playingTime,
    ...point.counting,
    ...point.ratios,
  }));
