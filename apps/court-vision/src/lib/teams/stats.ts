// Team season stats derived from player game logs: one result row per
// distinct (team, game) for the record and scores, plus box-score totals
// aggregated per team. Pure math — the prisma reads live in loader.ts.

import { rankByKeys } from "@vision/core/series/ranking";
import { type TeamGameResult } from "@vision/core/series/teamTrend";

export type TeamBoxTotals = {
  teamAbbr: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg3m: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
};

export type TeamSeasonStats = {
  abbr: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  ppg: number;
  oppPpg: number;
  diff: number; // ppg − oppPpg
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  tpmPg: number;
  fgPct: number;
  ftPct: number;
};

export type TeamStatKey = Exclude<keyof TeamSeasonStats, "abbr">;

export type TeamStatMeta = {
  key: TeamStatKey;
  label: string;
  description: string;
  lowerIsBetter?: boolean;
  format: (value: number) => string;
};

const perGameFormat = (value: number): string => value.toFixed(1);
const pctFormat = (value: number): string => `${(value * 100).toFixed(1)}%`;
const signedFormat = (value: number): string =>
  value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);

// Ranked stats shown on the /team page, in display order. Wins/losses/games
// render in the header instead, so they are not listed here.
export const TEAM_STAT_META: readonly TeamStatMeta[] = [
  {
    key: "winPct",
    label: "Win %",
    description: "Share of games won.",
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  { key: "ppg", label: "PPG", description: "Points scored per game.", format: perGameFormat },
  {
    key: "oppPpg",
    label: "OPP PPG",
    description: "Points allowed per game. Lower is better.",
    lowerIsBetter: true,
    format: perGameFormat,
  },
  {
    key: "diff",
    label: "DIFF",
    description: "Average scoring margin per game.",
    format: signedFormat,
  },
  { key: "rpg", label: "RPG", description: "Rebounds per game.", format: perGameFormat },
  { key: "apg", label: "APG", description: "Assists per game.", format: perGameFormat },
  { key: "spg", label: "SPG", description: "Steals per game.", format: perGameFormat },
  { key: "bpg", label: "BPG", description: "Blocks per game.", format: perGameFormat },
  {
    key: "topg",
    label: "TOPG",
    description: "Turnovers per game. Lower is better.",
    lowerIsBetter: true,
    format: perGameFormat,
  },
  { key: "tpmPg", label: "3PM", description: "Threes made per game.", format: perGameFormat },
  { key: "fgPct", label: "FG%", description: "Field-goal percentage.", format: pctFormat },
  { key: "ftPct", label: "FT%", description: "Free-throw percentage.", format: pctFormat },
];

export const buildTeamStats = ({
  results,
  totals,
}: {
  results: readonly TeamGameResult[];
  totals: readonly TeamBoxTotals[];
}): TeamSeasonStats[] =>
  totals.map((box) => {
    const teamResults = results.filter((result) => result.teamAbbr === box.teamAbbr);
    const games = teamResults.length;
    const wins = teamResults.filter((result) => result.winLoss === "W").length;
    const losses = teamResults.filter((result) => result.winLoss === "L").length;
    const scored = teamResults.reduce((sum, result) => sum + (result.teamScore ?? 0), 0);
    const allowed = teamResults.reduce((sum, result) => sum + (result.opponentScore ?? 0), 0);
    const per = (value: number): number => (games > 0 ? value / games : 0);
    // Official final scores when present; the box-score sum is the fallback.
    const ppg = scored > 0 ? per(scored) : per(box.pts);
    const oppPpg = per(allowed);
    return {
      abbr: box.teamAbbr,
      games,
      wins,
      losses,
      winPct: wins + losses > 0 ? wins / (wins + losses) : 0,
      ppg,
      oppPpg,
      diff: ppg - oppPpg,
      rpg: per(box.reb),
      apg: per(box.ast),
      spg: per(box.stl),
      bpg: per(box.blk),
      topg: per(box.tov),
      tpmPg: per(box.fg3m),
      fgPct: box.fga > 0 ? box.fgm / box.fga : 0,
      ftPct: box.fta > 0 ? box.ftm / box.fta : 0,
    };
  });

const TEAM_RANK_KEYS: readonly TeamStatKey[] = [
  "games",
  "wins",
  "losses",
  "winPct",
  "ppg",
  "oppPpg",
  "diff",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "topg",
  "tpmPg",
  "fgPct",
  "ftPct",
];

// Standard competition ranking (ties share the better rank) per stat across
// the supplied teams; oppPpg and topg rank ascending.
export const rankTeams = ({
  stats,
}: {
  stats: readonly TeamSeasonStats[];
}): Map<string, Record<TeamStatKey, number>> =>
  rankByKeys({
    items: stats,
    keys: TEAM_RANK_KEYS,
    idOf: (team) => team.abbr,
    valueOf: ({ item, key }) => item[key],
    lowerIsBetter: (key) => !!TEAM_STAT_META.find((meta) => meta.key === key)?.lowerIsBetter,
  });
