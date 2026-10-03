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
// per-game averages need a floor of games played, percentages need made
// volume (the official 300 FGM / 82 3PM / 125 FTM qualifiers).
const MIN_GAMES = 20;
const MIN_FGM = 300;
const MIN_FG3M = 82;
const MIN_FTM = 125;

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

// Standard competition ranking against the qualified pool: rank is 1 plus the
// number of qualified players strictly ahead, so ties share a rank. The viewed
// player is always ranked (even below the qualifying floor) but only counts
// toward eligibleCount when they qualify themselves. With applyMinimums off,
// every player with a computable value is in the pool.
export const buildSeasonAverageLine = (args: {
  rows: SeasonStatTotals[];
  playerId: number;
  applyMinimums?: boolean;
}): SeasonAverageStat[] | null => {
  const { rows, playerId, applyMinimums = true } = args;
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
    const qualifies = (row: SeasonStatTotals): boolean =>
      applyMinimums ? def.qualifies(row) : def.valueOf(row) !== null;
    const qualifiedOthers = rows.filter((row) => row.playerId !== playerId && qualifies(row));
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
      eligibleCount: qualifiedOthers.length + (qualifies(playerRow) ? 1 : 0),
    };
  }).filter(isPresent);
};

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
  return own.reduce<SeasonStatTotals>(
    (totals, row) => ({
      playerId: args.playerId,
      gamesPlayed: totals.gamesPlayed + row.gamesPlayed,
      minutes: totals.minutes + row.minutes,
      fgm: totals.fgm + row.fgm,
      fga: totals.fga + row.fga,
      fg3m: totals.fg3m + row.fg3m,
      fg3a: totals.fg3a + row.fg3a,
      ftm: totals.ftm + row.ftm,
      fta: totals.fta + row.fta,
      reb: totals.reb + row.reb,
      ast: totals.ast + row.ast,
      stl: totals.stl + row.stl,
      blk: totals.blk + row.blk,
      tov: totals.tov + row.tov,
      pts: totals.pts + row.pts,
    }),
    {
      playerId: args.playerId,
      gamesPlayed: 0,
      minutes: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pts: 0,
    },
  );
};

// Career averages are league-wide only in principle; ranking a player against
// every other player's career would need the whole pool aggregated, so career
// stats show values without a leaderboard rank (rank stays null, which the card
// renders as a plain value).
export const buildCareerAverageLine = (args: { totals: SeasonStatTotals }): SeasonAverageStat[] => {
  const isPresent = (stat: SeasonAverageStat | null): stat is SeasonAverageStat => stat !== null;
  return STAT_DEFS.map((def): SeasonAverageStat | null => {
    const value = def.valueOf(args.totals);
    if (value === null) {
      return null;
    }
    return {
      key: def.key,
      label: def.label,
      value: def.format(value),
      rank: null,
      rankTone: def.rankTone,
      eligibleCount: 0,
    };
  }).filter(isPresent);
};
