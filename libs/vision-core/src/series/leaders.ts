// Leaderboard rank tone: "leader" ranks are achievements worth highlighting;
// "neutral" ones (turnovers, where 1st means most committed) stay uncolored.
export type RankTone = "leader" | "neutral";

export type LeaderStat = {
  key: string;
  label: string;
  value: string;
  rank: number | null;
  rankTone: RankTone;
  eligibleCount: number;
};

// One leaderboard stat over a season-totals row: how to read its value, who
// qualifies for the board (a games or volume floor, so tiny samples cannot top
// it), and how to print it.
export type LeaderDef<Row> = {
  key: string;
  label: string;
  rankTone: RankTone;
  valueOf: (row: Row) => number | null;
  qualifies: (row: Row) => boolean;
  format: (value: number) => string;
};

type PerGameProps = {
  total: number;
  gamesPlayed: number;
};

export const perGame = ({ total, gamesPlayed }: PerGameProps): number | null =>
  gamesPlayed > 0 ? total / gamesPlayed : null;

type PercentageProps = {
  made: number;
  attempted: number;
};

export const percentage = ({ made, attempted }: PercentageProps): number | null =>
  attempted > 0 ? (made / attempted) * 100 : null;

const isPresent = (stat: LeaderStat | null): stat is LeaderStat => stat !== null;

// Standard competition ranking against the qualified pool: rank is 1 plus the
// number of qualified players strictly ahead, so ties share a rank. The viewed
// player is always ranked (even below the qualifying floor) but only counts
// toward eligibleCount when they qualify themselves. With applyMinimums off,
// every player with a computable value is in the pool. A stat nobody qualifies
// for has no leaderboard to stand on, so its rank is null (a plain value): "1st
// of 0" is not a rank. Null when the player has no row.
type BuildLeaderLineProps<Row extends { playerId: number }> = {
  defs: readonly LeaderDef<Row>[];
  rows: readonly Row[];
  playerId: number;
  applyMinimums?: boolean;
};

export const buildLeaderLine = <Row extends { playerId: number }>({
  defs,
  rows,
  playerId,
  applyMinimums = true,
}: BuildLeaderLineProps<Row>): LeaderStat[] | null => {
  const playerRow = rows.find((row) => row.playerId === playerId);
  if (!playerRow) {
    return null;
  }
  return defs
    .map((def): LeaderStat | null => {
      const value = def.valueOf(playerRow);
      if (value === null) {
        return null;
      }
      const qualifies = (row: Row): boolean =>
        applyMinimums ? def.qualifies(row) : def.valueOf(row) !== null;
      const qualifiedOthers = rows.filter((row) => row.playerId !== playerId && qualifies(row));
      const ahead = qualifiedOthers.reduce((count, row) => {
        const other = def.valueOf(row);
        return other !== null && other > value ? count + 1 : count;
      }, 0);
      const eligibleCount = qualifiedOthers.length + (qualifies(playerRow) ? 1 : 0);
      return {
        key: def.key,
        label: def.label,
        value: def.format(value),
        rank: eligibleCount === 0 ? null : ahead + 1,
        rankTone: def.rankTone,
        eligibleCount,
      };
    })
    .filter(isPresent);
};

// The same stats for one row with no leaderboard (a career line, which would
// need every other career aggregated to rank): values only, rank null.
type BuildUnrankedLineProps<Row> = {
  defs: readonly LeaderDef<Row>[];
  row: Row;
};

export const buildUnrankedLine = <Row>({ defs, row }: BuildUnrankedLineProps<Row>): LeaderStat[] =>
  defs
    .map((def): LeaderStat | null => {
      const value = def.valueOf(row);
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
    })
    .filter(isPresent);
