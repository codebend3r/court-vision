export type SeasonStatTotals = {
  playerId: number;
  gamesPlayed: number;
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

// Leaderboard rank tone: "leader" ranks are achievements worth highlighting;
// "neutral" ones (turnovers, where 1st means most committed) stay uncolored.
export type RankTone = "leader" | "neutral";

export type SeasonAverageStat = {
  key: string;
  label: string;
  value: string;
  rank: number | null;
  rankTone: RankTone;
  eligibleCount: number;
};

// NBA-style statistical minimums so tiny samples cannot top a leaderboard:
// per-game averages need a floor of games played, percentages need attempt
// volume (mirroring the official 300 FGA / 82 3PA / 125 FTA qualifiers).
const MIN_GAMES = 20;
const MIN_FGA = 300;
const MIN_FG3A = 82;
const MIN_FTA = 125;

const perGame = ({ total, gamesPlayed }: { total: number; gamesPlayed: number }): number | null =>
  gamesPlayed > 0 ? total / gamesPlayed : null;

const percentage = ({ made, attempted }: { made: number; attempted: number }): number | null =>
  attempted > 0 ? (made / attempted) * 100 : null;

const formatAverage = (value: number): string => value.toFixed(1);
const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

type StatDef = {
  key: string;
  label: string;
  rankTone: RankTone;
  valueOf: (row: SeasonStatTotals) => number | null;
  qualifies: (row: SeasonStatTotals) => boolean;
  format: (value: number) => string;
};

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
    qualifies: (row) => row.fga >= MIN_FGA,
    format: formatPercent,
  },
  {
    key: "fg3Pct",
    label: "3P%",
    rankTone: "leader",
    valueOf: (row) => percentage({ made: row.fg3m, attempted: row.fg3a }),
    qualifies: (row) => row.fg3a >= MIN_FG3A,
    format: formatPercent,
  },
  {
    key: "ftPct",
    label: "FT%",
    rankTone: "leader",
    valueOf: (row) => percentage({ made: row.ftm, attempted: row.fta }),
    qualifies: (row) => row.fta >= MIN_FTA,
    format: formatPercent,
  },
];

// Standard competition ranking against the qualified pool: rank is 1 plus the
// number of qualified players strictly ahead, so ties share a rank. The viewed
// player is always ranked (even below the qualifying floor) but only counts
// toward eligibleCount when they qualify themselves.
export const buildSeasonAverageLine = (args: {
  rows: SeasonStatTotals[];
  playerId: number;
}): SeasonAverageStat[] | null => {
  const { rows, playerId } = args;
  const playerRow = rows.find((row) => row.playerId === playerId);
  if (!playerRow) {
    return null;
  }

  const isPresent = (stat: SeasonAverageStat | null): stat is SeasonAverageStat => stat !== null;

  return STAT_DEFS.map((def): SeasonAverageStat | null => {
    const value = def.valueOf(playerRow);
    if (value === null) {
      return null;
    }
    const qualifiedOthers = rows.filter((row) => row.playerId !== playerId && def.qualifies(row));
    const ahead = qualifiedOthers.reduce((count, row) => {
      const other = def.valueOf(row);
      return other !== null && other > value ? count + 1 : count;
    }, 0);
    return {
      key: def.key,
      label: def.label,
      value: def.format(value),
      rank: ahead + 1,
      rankTone: def.rankTone,
      eligibleCount: qualifiedOthers.length + (def.qualifies(playerRow) ? 1 : 0),
    };
  }).filter(isPresent);
};
