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

// The floors above are for a whole season. Early in one, nobody has played 20
// games or made 300 field goals, so a fixed floor leaves every board empty and
// the first player ranked would top all of them. They scale with the games the
// busiest player has played instead: games need 70% of that (capped at
// MIN_GAMES), and made volume is the full-season figure times the share of a
// season played. A full season gives the full floors.
const SEASON_GAMES = 82;
const QUALIFYING_GAMES_SHARE = 0.7;

export type QualifyingFloors = { games: number; fgm: number; fg3m: number; ftm: number };

export const qualifyingFloors = ({
  rows,
}: {
  rows: readonly SeasonStatTotals[];
}): QualifyingFloors => {
  const mostGames = rows.reduce((most, row) => Math.max(most, row.gamesPlayed), 0);
  const progress = Math.min(1, mostGames / SEASON_GAMES);
  const scaled = (full: number): number => Math.max(1, Math.ceil(full * progress));
  return {
    games: Math.max(1, Math.min(MIN_GAMES, Math.ceil(mostGames * QUALIFYING_GAMES_SHARE))),
    fgm: scaled(MIN_FGM),
    fg3m: scaled(MIN_FG3M),
    ftm: scaled(MIN_FTM),
  };
};

const formatAverage = (value: number): string => value.toFixed(1);
// Minutes read whole, never as a fraction of one.
const formatWholeNumber = (value: number): string => value.toFixed(0);
const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

type StatDef = LeaderDef<SeasonStatTotals>;

const perGameDef = ({
  key,
  label,
  rankTone = "leader",
  total,
  minGames,
}: {
  key: string;
  label: string;
  rankTone?: RankTone;
  total: (row: SeasonStatTotals) => number;
  minGames: number;
}): StatDef => ({
  key,
  label,
  rankTone,
  valueOf: (row) => perGame({ total: total(row), gamesPlayed: row.gamesPlayed }),
  qualifies: (row) => row.gamesPlayed >= minGames,
  format: formatAverage,
});

const statDefs = ({ floors }: { floors: QualifyingFloors }): readonly StatDef[] => [
  perGameDef({ key: "pts", label: "PTS", total: (row) => row.pts, minGames: floors.games }),
  perGameDef({ key: "reb", label: "REB", total: (row) => row.reb, minGames: floors.games }),
  perGameDef({ key: "ast", label: "AST", total: (row) => row.ast, minGames: floors.games }),
  perGameDef({ key: "stl", label: "STL", total: (row) => row.stl, minGames: floors.games }),
  perGameDef({ key: "blk", label: "BLK", total: (row) => row.blk, minGames: floors.games }),
  {
    ...perGameDef({
      key: "min",
      label: "MIN",
      total: (row) => row.minutes,
      minGames: floors.games,
    }),
    format: formatWholeNumber,
  },
  perGameDef({
    key: "tov",
    label: "TOV",
    rankTone: "neutral",
    total: (row) => row.tov,
    minGames: floors.games,
  }),
  {
    key: "fgPct",
    label: "FG%",
    rankTone: "leader",
    valueOf: (row) => percentage({ made: row.fgm, attempted: row.fga }),
    qualifies: (row) => row.fgm >= floors.fgm,
    format: formatPercent,
  },
  {
    key: "fg3Pct",
    label: "3P%",
    rankTone: "leader",
    valueOf: (row) => percentage({ made: row.fg3m, attempted: row.fg3a }),
    qualifies: (row) => row.fg3m >= floors.fg3m,
    format: formatPercent,
  },
  {
    key: "ftPct",
    label: "FT%",
    rankTone: "leader",
    valueOf: (row) => percentage({ made: row.ftm, attempted: row.fta }),
    qualifies: (row) => row.ftm >= floors.ftm,
    format: formatPercent,
  },
];

// The NBA leaderboard line for one player (see buildLeaderLine for the
// ranking rules).
export const buildSeasonAverageLine = (args: {
  rows: SeasonStatTotals[];
  playerId: number;
  applyMinimums?: boolean;
}): SeasonAverageStat[] | null =>
  buildLeaderLine({ defs: statDefs({ floors: qualifyingFloors({ rows: args.rows }) }), ...args });

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
  // Unranked, so no floor is read; the lowest one stands in.
  buildUnrankedLine({
    defs: statDefs({ floors: qualifyingFloors({ rows: [] }) }),
    row: args.totals,
  });
