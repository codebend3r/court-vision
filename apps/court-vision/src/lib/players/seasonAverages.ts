import {
  buildLeaderLine,
  buildUnrankedLine,
  type LeaderDef,
  type LeaderStat,
  type RankTone,
  percentage,
  perGame,
} from "@vision/core/series/leaders";
import { recordFromKeys } from "@vision/core/util/record";

import { MIN_FG3M, MIN_FGM, MIN_FTM } from "@/lib/players/minimums";

// Every summable total on a season row.
const SEASON_TOTAL_KEYS = [
  "gamesPlayed",
  "minutes",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "pts",
] as const;

export type SeasonStatTotals = { playerId: number } & Record<
  (typeof SEASON_TOTAL_KEYS)[number],
  number
>;

export type { RankTone } from "@vision/core/series/leaders";
export type SeasonAverageStat = LeaderStat;

// NBA-style statistical minimums so tiny samples cannot top a leaderboard:
// per-game averages need a floor of games played, percentages need made
// volume (the official percentage-leader qualifiers).
const MIN_GAMES = 20;

const formatAverage = (value: number): string => value.toFixed(1);
const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

type StatDef = LeaderDef<SeasonStatTotals>;

const perGameDef = ({
  key,
  label,
  rankTone = "leader",
  total,
}: {
  key: string;
  label: string;
  rankTone?: RankTone;
  total: (row: SeasonStatTotals) => number;
}): StatDef => ({
  key,
  label,
  rankTone,
  valueOf: (row) => perGame({ total: total(row), gamesPlayed: row.gamesPlayed }),
  qualifies: (row) => row.gamesPlayed >= MIN_GAMES,
  format: formatAverage,
});

const STAT_DEFS: readonly StatDef[] = [
  perGameDef({ key: "pts", label: "PTS", total: (row) => row.pts }),
  perGameDef({ key: "reb", label: "REB", total: (row) => row.reb }),
  perGameDef({ key: "ast", label: "AST", total: (row) => row.ast }),
  perGameDef({ key: "stl", label: "STL", total: (row) => row.stl }),
  perGameDef({ key: "blk", label: "BLK", total: (row) => row.blk }),
  perGameDef({ key: "min", label: "MIN", total: (row) => row.minutes }),
  perGameDef({ key: "tov", label: "TOV", rankTone: "neutral", total: (row) => row.tov }),
  {
    key: "fgPct",
    label: "FG%",
    rankTone: "leader",
    valueOf: (row) => percentage({ made: row.fgm, attempted: row.fga }),
    qualifies: (row) => row.fgm >= MIN_FGM,
    format: formatPercent,
  },
  {
    key: "fg3Pct",
    label: "3P%",
    rankTone: "leader",
    valueOf: (row) => percentage({ made: row.fg3m, attempted: row.fg3a }),
    qualifies: (row) => row.fg3m >= MIN_FG3M,
    format: formatPercent,
  },
  {
    key: "ftPct",
    label: "FT%",
    rankTone: "leader",
    valueOf: (row) => percentage({ made: row.ftm, attempted: row.fta }),
    qualifies: (row) => row.ftm >= MIN_FTM,
    format: formatPercent,
  },
];

// The NBA leaderboard line for one player (see buildLeaderLine for the
// ranking rules).
export const buildSeasonAverageLine = (args: {
  rows: SeasonStatTotals[];
  playerId: number;
  applyMinimums?: boolean;
}): SeasonAverageStat[] | null => buildLeaderLine({ defs: STAT_DEFS, ...args });

// Sum a player's per-season totals into one career row. Percentages and
// per-game averages are always ratios of these summed totals, so career values
// derive correctly from the aggregate (never an average of averages).
export const aggregateCareerTotals = (args: {
  rows: readonly SeasonStatTotals[];
  playerId: number;
}): SeasonStatTotals | null => {
  const own = args.rows.filter((row) => row.playerId === args.playerId);
  if (own.length === 0) {
    return null;
  }
  return {
    playerId: args.playerId,
    ...recordFromKeys({
      keys: SEASON_TOTAL_KEYS,
      value: (key) => own.reduce((sum, row) => sum + row[key], 0),
    }),
  };
};

// Career averages are league-wide only in principle; ranking a player against
// every other player's career would need the whole pool aggregated, so career
// stats show values without a leaderboard rank (rank stays null, which the card
// renders as a plain value).
export const buildCareerAverageLine = (args: { totals: SeasonStatTotals }): SeasonAverageStat[] =>
  buildUnrankedLine({ defs: STAT_DEFS, row: args.totals });
