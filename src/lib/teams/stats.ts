// Team season stats derived from player game logs: one result row per
// distinct (team, game) for the record and scores, plus box-score totals
// aggregated per team. Pure math — the prisma reads live in loader.ts.

export type TeamGameResult = {
  teamAbbr: string;
  gameId: string;
  teamScore: number | null;
  opponentScore: number | null;
  winLoss: string | null;
};

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

// Standard competition ranking (ties share the better rank) per stat across
// the supplied teams; oppPpg and topg rank ascending.
export const rankTeams = ({
  stats,
}: {
  stats: readonly TeamSeasonStats[];
}): Map<string, Record<TeamStatKey, number>> => {
  const keys: readonly TeamStatKey[] = [
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
  const rankFor = (key: TeamStatKey): Map<string, number> => {
    const lowerIsBetter = !!TEAM_STAT_META.find((meta) => meta.key === key)?.lowerIsBetter;
    const sorted = [...stats].sort((a, b) => (lowerIsBetter ? a[key] - b[key] : b[key] - a[key]));
    return sorted.reduce<Map<string, number>>((acc, team, index) => {
      const previous = sorted[index - 1];
      const rank =
        previous !== undefined && previous[key] === team[key]
          ? (acc.get(previous.abbr) ?? index + 1)
          : index + 1;
      return acc.set(team.abbr, rank);
    }, new Map());
  };
  const byKey = new Map(keys.map((key) => [key, rankFor(key)]));
  return new Map(
    stats.map((team) => [
      team.abbr,
      keys.reduce<Record<TeamStatKey, number>>(
        (acc, key) => ({ ...acc, [key]: byKey.get(key)?.get(team.abbr) ?? 0 }),
        {
          games: 0,
          wins: 0,
          losses: 0,
          winPct: 0,
          ppg: 0,
          oppPpg: 0,
          diff: 0,
          rpg: 0,
          apg: 0,
          spg: 0,
          bpg: 0,
          topg: 0,
          tpmPg: 0,
          fgPct: 0,
          ftPct: 0,
        },
      ),
    ]),
  );
};

// 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd".
export const ordinal = (value: number): string => {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  const ones = value % 10;
  if (ones === 1) return `${value}st`;
  if (ones === 2) return `${value}nd`;
  if (ones === 3) return `${value}rd`;
  return `${value}th`;
};
