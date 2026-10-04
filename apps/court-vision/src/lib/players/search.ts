import { z } from "zod";

import { prisma } from "@/lib/prisma";

import {
  gamesForRange,
  type PlayerGameRange,
  type PlayersSearchParams,
} from "@/lib/players/searchParams";

export type PlayerRow = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  seasonStats?: Array<{
    gamesPlayed: number;
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
  }>;
  stats?: PlayerStats;
  gameLogs?: Array<PlayerGameStats & { minutes: number }>;
};

export type PlayerStats = {
  gamesPlayed: number;
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

type SortableCountingStatKey =
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "fgm"
  | "fga"
  | "fg3m"
  | "fg3a"
  | "tov";
type PlayerGameStats = Omit<PlayerStats, "gamesPlayed">;

export type PlayersSearchResult = {
  rows: PlayerRow[];
  total: number;
  page: number;
};

// Every candidate player for a range, already aggregated, with `stats` always
// set. The pool depends on the range alone, so it is what gets cached; search,
// sort, minimums and paging all run in memory over it (see rankPlayers).
export type PlayerPoolRow = Omit<PlayerRow, "stats" | "seasonStats" | "gameLogs"> & {
  stats: PlayerStats;
};

// The shape both pool queries return. Sums arrive as int4 (the SQL casts the
// bigint `sum`/`count` results), so every stat is a plain number.
const poolRowSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  teamAbbr: z.string().nullable(),
  position: z.string().nullable(),
  nbaPersonId: z.number().nullable(),
  gamesPlayed: z.number(),
  fgm: z.number(),
  fga: z.number(),
  fg3m: z.number(),
  fg3a: z.number(),
  ftm: z.number(),
  fta: z.number(),
  reb: z.number(),
  ast: z.number(),
  stl: z.number(),
  blk: z.number(),
  tov: z.number(),
  pts: z.number(),
});

const toPoolRow = ({
  gamesPlayed,
  fgm,
  fga,
  fg3m,
  fg3a,
  ftm,
  fta,
  reb,
  ast,
  stl,
  blk,
  tov,
  pts,
  ...player
}: z.infer<typeof poolRowSchema>): PlayerPoolRow => ({
  ...player,
  stats: { gamesPlayed, fgm, fga, fg3m, fg3a, ftm, fta, reb, ast, stl, blk, tov, pts },
});

// The season range reads each player's latest Regular Season aggregate; a
// player with logs but no aggregate row still lists, with zeroed stats.
// Retired players (no game logs) are never shown.
const fetchSeasonPool = (): Promise<unknown> =>
  prisma.$queryRaw`
    SELECT p.id, p."firstName", p."lastName", p."fullName", p."teamAbbr", p.position,
           p."nbaPersonId",
           COALESCE(s."gamesPlayed", 0) AS "gamesPlayed",
           COALESCE(s.fgm, 0) AS fgm, COALESCE(s.fga, 0) AS fga,
           COALESCE(s.fg3m, 0) AS fg3m, COALESCE(s.fg3a, 0) AS fg3a,
           COALESCE(s.ftm, 0) AS ftm, COALESCE(s.fta, 0) AS fta,
           COALESCE(s.reb, 0) AS reb, COALESCE(s.ast, 0) AS ast,
           COALESCE(s.stl, 0) AS stl, COALESCE(s.blk, 0) AS blk,
           COALESCE(s.tov, 0) AS tov, COALESCE(s.pts, 0) AS pts
    FROM "Player" p
    LEFT JOIN LATERAL (
      SELECT ss.* FROM "PlayerSeasonStats" ss
      WHERE ss."playerId" = p.id AND ss."seasonType" = 'Regular Season'
      ORDER BY ss.season DESC
      LIMIT 1
    ) s ON true
    WHERE EXISTS (SELECT 1 FROM "PlayerGameLog" g WHERE g."playerId" = p.id)
  `;

// A lastN range sums each player's N most recent logs. The LIMIT sits inside a
// per-player lateral so Postgres reads N rows off the (playerId, gameDate)
// index per player; Prisma's nested `take` cannot express this and fetched
// every log in the table to trim in memory. Games played counts appearances
// only: a DNP (0 minutes) is in the window but is not a game played.
const fetchWindowPool = ({ gameLimit }: { gameLimit: number }): Promise<unknown> =>
  prisma.$queryRaw`
    SELECT p.id, p."firstName", p."lastName", p."fullName", p."teamAbbr", p.position,
           p."nbaPersonId",
           w."gamesPlayed", w.fgm, w.fga, w.fg3m, w.fg3a, w.ftm, w.fta,
           w.reb, w.ast, w.stl, w.blk, w.tov, w.pts
    FROM "Player" p
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS games,
             (count(*) FILTER (WHERE g.minutes > 0))::int AS "gamesPlayed",
             COALESCE(sum(g.fgm), 0)::int AS fgm, COALESCE(sum(g.fga), 0)::int AS fga,
             COALESCE(sum(g.fg3m), 0)::int AS fg3m, COALESCE(sum(g.fg3a), 0)::int AS fg3a,
             COALESCE(sum(g.ftm), 0)::int AS ftm, COALESCE(sum(g.fta), 0)::int AS fta,
             COALESCE(sum(g.reb), 0)::int AS reb, COALESCE(sum(g.ast), 0)::int AS ast,
             COALESCE(sum(g.stl), 0)::int AS stl, COALESCE(sum(g.blk), 0)::int AS blk,
             COALESCE(sum(g.tov), 0)::int AS tov, COALESCE(sum(g.pts), 0)::int AS pts
      FROM (
        SELECT gl.minutes, gl.fgm, gl.fga, gl.fg3m, gl.fg3a, gl.ftm, gl.fta,
               gl.reb, gl.ast, gl.stl, gl.blk, gl.tov, gl.pts
        FROM "PlayerGameLog" gl
        WHERE gl."playerId" = p.id
        ORDER BY gl."gameDate" DESC
        LIMIT ${gameLimit}
      ) g
    ) w
    WHERE w.games > 0
  `;

export const fetchRegularPool = async ({
  range,
}: {
  range: PlayerGameRange;
}): Promise<PlayerPoolRow[]> => {
  const gameLimit = gamesForRange({ range });
  const rows = gameLimit === null ? await fetchSeasonPool() : await fetchWindowPool({ gameLimit });
  return z.array(poolRowSchema).parse(rows).map(toPoolRow);
};

// Official NBA percentage-leader qualifiers, by made volume (300 FGM for FG%,
// 82 3PM for 3P%, 125 FTM for FT%). Toggled by the minimums search param.
const MIN_FGM = 300;
const MIN_FG3M = 82;
const MIN_FTM = 125;
// Official NBA per-game leader qualifier: appearances in 70% of the schedule,
// 58 of 82 games. A lastN range applies the same share to its own window,
// e.g. 7 of the last 10.
const QUALIFYING_GAMES_SHARE = 0.7;
const SCHEDULE_GAMES = 82;

const isSortableCountingStatKey = (
  key: PlayersSearchParams["sort"],
): key is SortableCountingStatKey =>
  ["pts", "reb", "ast", "stl", "blk", "fgm", "fga", "fg3m", "fg3a", "tov"].some(
    (statKey) => statKey === key,
  );

const minQualifyingGames = ({ range }: { range: PlayersSearchParams["range"] }): number =>
  Math.ceil((gamesForRange({ range }) ?? SCHEDULE_GAMES) * QUALIFYING_GAMES_SHARE);

const meetsMinimum = ({
  stats,
  args,
}: {
  stats: PlayerStats;
  args: PlayersSearchParams;
}): boolean => {
  if (!args.minimums) return true;
  if (args.sort === "fgPct") return stats.fgm >= MIN_FGM;
  if (args.sort === "fg3Pct") return stats.fg3m >= MIN_FG3M;
  if (args.sort === "ftPct") return stats.ftm >= MIN_FTM;
  // Per-game averages follow the games-played rule; totals are self-limiting.
  if (args.mode === "average" && isSortableCountingStatKey(args.sort)) {
    return stats.gamesPlayed >= minQualifyingGames({ range: args.range });
  }
  return true;
};

const statSortValue = ({
  stats,
  args,
}: {
  stats: PlayerStats;
  args: PlayersSearchParams;
}): number => {
  // Games played is a count, never an average, so mode does not apply.
  if (args.sort === "gamesPlayed") return stats.gamesPlayed;
  if (args.sort === "fgPct") return stats.fga > 0 ? stats.fgm / stats.fga : -1;
  if (args.sort === "fg3Pct") return stats.fg3a > 0 ? stats.fg3m / stats.fg3a : -1;
  if (args.sort === "ftPct") return stats.fta > 0 ? stats.ftm / stats.fta : -1;
  if (isSortableCountingStatKey(args.sort)) {
    const total = stats[args.sort];
    return args.mode === "average" && stats.gamesPlayed > 0 ? total / stats.gamesPlayed : total;
  }
  return 0;
};

// One collator for every name comparison: String#localeCompare builds its
// collation state per call, which dominates a 1,500-row sort.
const collator = new Intl.Collator();

type NamedRow = { id: number; firstName: string; lastName: string };

// Name sorts order by the chosen name, then the other name, in the requested
// direction; id breaks exact ties ascending so paging is stable.
export const compareByName = ({
  a,
  b,
  sort,
  dir,
}: {
  a: NamedRow;
  b: NamedRow;
  sort: "firstName" | "lastName";
  dir: PlayersSearchParams["dir"];
}): number => {
  const primary = (row: NamedRow): string => (sort === "lastName" ? row.lastName : row.firstName);
  const secondary = (row: NamedRow): string => (sort === "lastName" ? row.firstName : row.lastName);
  const difference =
    collator.compare(primary(a), primary(b)) || collator.compare(secondary(a), secondary(b));
  return (dir === "asc" ? difference : -difference) || a.id - b.id;
};

// Stat-sort ties fall back to last name, first name, id, always ascending.
export const compareByNameAscending = ({ a, b }: { a: NamedRow; b: NamedRow }): number =>
  collator.compare(a.lastName, b.lastName) ||
  collator.compare(a.firstName, b.firstName) ||
  a.id - b.id;

// Case-insensitive substring match on the full name, the in-memory twin of
// Prisma's `contains` + `mode: "insensitive"`.
export const matchesQuery = ({ fullName, q }: { fullName: string; q: string }): boolean =>
  q === "" || fullName.toLowerCase().includes(q.toLowerCase());

// The requested page of an ordered list, clamped to the last page so a stale
// page number (after a narrowing search) still lands on real rows.
export const pageOf = <Row>({
  rows,
  page,
  size,
}: {
  rows: readonly Row[];
  page: number;
  size: number;
}): { rows: Row[]; total: number; page: number } => {
  const total = rows.length;
  const lastPage = Math.max(1, Math.ceil(total / size));
  const clampedPage = Math.min(page, lastPage);
  return {
    rows: rows.slice((clampedPage - 1) * size, clampedPage * size),
    total,
    page: total === 0 ? 1 : clampedPage,
  };
};

const isNameSort = (sort: PlayersSearchParams["sort"]): sort is "firstName" | "lastName" =>
  sort === "firstName" || sort === "lastName";

// Filters, orders and pages a pool. Pure, so every search, sort, minimums and
// page change over a cached pool costs a millisecond-scale sort, not a query.
export const rankPlayers = ({
  pool,
  args,
}: {
  pool: readonly PlayerPoolRow[];
  args: PlayersSearchParams & { playerIds?: readonly number[] };
}): PlayersSearchResult => {
  const { q, page, size, sort, dir, playerIds } = args;
  const candidates = pool.filter(
    (row) =>
      matchesQuery({ fullName: row.fullName, q }) &&
      (playerIds === undefined || playerIds.includes(row.id)),
  );
  if (isNameSort(sort)) {
    const ordered = candidates.toSorted((a, b) => compareByName({ a, b, sort, dir }));
    return pageOf({ rows: ordered, page, size });
  }
  // Sort keys are computed once per row rather than once per comparison.
  const ordered = candidates
    .map((row) => ({
      row,
      belowMinimum: meetsMinimum({ stats: row.stats, args }) ? 0 : 1,
      value: statSortValue({ stats: row.stats, args }),
    }))
    .toSorted((a, b) => {
      // Players below the qualifying minimum always sink to the bottom,
      // whatever the direction, so leaders are real leaders.
      if (a.belowMinimum !== b.belowMinimum) return a.belowMinimum - b.belowMinimum;
      const difference = a.value - b.value;
      if (difference !== 0) return dir === "asc" ? difference : -difference;
      return compareByNameAscending({ a: a.row, b: b.row });
    })
    .map(({ row }) => row);
  return pageOf({ rows: ordered, page, size });
};

export const searchPlayers = async (
  args: PlayersSearchParams & { playerIds?: readonly number[] },
): Promise<PlayersSearchResult> => {
  // An empty watchlist has nothing to rank; skip the pool read entirely.
  if (args.playerIds !== undefined && args.playerIds.length === 0) {
    return { rows: [], total: 0, page: 1 };
  }
  return rankPlayers({ pool: await fetchRegularPool({ range: args.range }), args });
};
