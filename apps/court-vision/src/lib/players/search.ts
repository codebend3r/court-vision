import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { recordFromKeys } from "@vision/core/util/record";

import { playerRowSchema, splitPlayerRow, type PlayerIdentity } from "@/lib/players/identity";
import { MIN_FG3M, MIN_FGM, MIN_FTM } from "@/lib/players/minimums";
import { isNameSort, rankRows, type NameSortKey, type Page } from "@/lib/players/rank";
import {
  gamesForRange,
  type PlayerGameRange,
  type PlayerSortKey,
  type RegularSearchParams,
} from "@/lib/players/searchParams";
import { HAS_GAME_LOGS, LATEST_SEASON_JOIN, PLAYER_IDENTITY_COLUMNS } from "@/lib/players/sql";

const PLAYER_STAT_KEYS = [
  "gamesPlayed",
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

export type PlayerStats = Record<(typeof PLAYER_STAT_KEYS)[number], number>;

// The counting stats a sort can read as a per-game average or a total.
const COUNTING_SORT_KEYS = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "tov",
] as const;
export type CountingSortKey = (typeof COUNTING_SORT_KEYS)[number];

// Every candidate player for a range, already aggregated. The pool depends on
// the range alone, so it is what gets cached; search, sort, minimums and
// paging all run in memory over it (see rankPlayers).
export type PlayerPoolRow = PlayerIdentity & { stats: PlayerStats };

export type PlayersSearchResult = Page<PlayerPoolRow>;

// The shape both pool queries return. Sums arrive as int4 (the SQL casts the
// bigint `sum`/`count` results), so every stat is a plain number.
const poolRowSchema = playerRowSchema.extend(
  recordFromKeys({ keys: PLAYER_STAT_KEYS, value: () => z.number() }),
);

// The season range reads each player's latest Regular Season aggregate; a
// player with logs but no aggregate row still lists, with zeroed stats.
const fetchSeasonPool = (): Promise<unknown> =>
  prisma.$queryRaw`
    SELECT ${PLAYER_IDENTITY_COLUMNS},
           COALESCE(s."gamesPlayed", 0) AS "gamesPlayed",
           COALESCE(s.fgm, 0) AS fgm, COALESCE(s.fga, 0) AS fga,
           COALESCE(s.fg3m, 0) AS fg3m, COALESCE(s.fg3a, 0) AS fg3a,
           COALESCE(s.ftm, 0) AS ftm, COALESCE(s.fta, 0) AS fta,
           COALESCE(s.reb, 0) AS reb, COALESCE(s.ast, 0) AS ast,
           COALESCE(s.stl, 0) AS stl, COALESCE(s.blk, 0) AS blk,
           COALESCE(s.tov, 0) AS tov, COALESCE(s.pts, 0) AS pts
    FROM "Player" p
    ${LATEST_SEASON_JOIN}
    WHERE ${HAS_GAME_LOGS}
  `;

// A lastN range sums each player's N most recent logs. The LIMIT sits inside a
// per-player lateral so Postgres reads N rows off the (playerId, gameDate)
// index per player; Prisma's nested `take` cannot express this and fetched
// every log in the table to trim in memory. Games played counts appearances
// only: a DNP (0 minutes) is in the window but is not a game played.
const fetchWindowPool = ({ gameLimit }: { gameLimit: number }): Promise<unknown> =>
  prisma.$queryRaw`
    SELECT ${PLAYER_IDENTITY_COLUMNS},
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
  return z.array(poolRowSchema).parse(rows).map(splitPlayerRow);
};

// Official NBA per-game leader qualifier: appearances in 70% of the schedule,
// 58 of 82 games. A lastN range applies the same share to its own window,
// e.g. 7 of the last 10.
const QUALIFYING_GAMES_SHARE = 0.7;
const SCHEDULE_GAMES = 82;

const isCountingSortKey = (key: PlayerSortKey): key is CountingSortKey =>
  COUNTING_SORT_KEYS.some((statKey) => statKey === key);

const minQualifyingGames = ({ range }: { range: PlayerGameRange }): number =>
  Math.ceil((gamesForRange({ range }) ?? SCHEDULE_GAMES) * QUALIFYING_GAMES_SHARE);

type StatSortKey = Exclude<PlayerSortKey, NameSortKey>;

type RankArgs = RegularSearchParams & { playerIds?: readonly number[] };

const meetsMinimum = ({
  stats,
  sort,
  args,
}: {
  stats: PlayerStats;
  sort: StatSortKey;
  args: RankArgs;
}): boolean => {
  if (!args.minimums) return true;
  if (sort === "fgPct") return stats.fgm >= MIN_FGM;
  if (sort === "fg3Pct") return stats.fg3m >= MIN_FG3M;
  if (sort === "ftPct") return stats.ftm >= MIN_FTM;
  // Per-game averages follow the games-played rule; totals are self-limiting.
  if (args.mode === "average" && isCountingSortKey(sort)) {
    return stats.gamesPlayed >= minQualifyingGames({ range: args.range });
  }
  return true;
};

// A shooting percentage, with no attempts ranking below every real one.
const shootingRate = ({ made, attempted }: { made: number; attempted: number }): number =>
  attempted > 0 ? made / attempted : -1;

const statSortValue = ({
  row,
  sort,
  args,
}: {
  row: PlayerPoolRow;
  sort: StatSortKey;
  args: RankArgs;
}): number => {
  const { stats } = row;
  // Star order lives in the watchlist's id list, newest first, so the first id
  // scores highest and the default descending sort leads with the latest
  // star. Off the watchlist there is no star time, and every row ties.
  if (sort === "starredAt") {
    return args.playerIds === undefined
      ? 0
      : args.playerIds.length - args.playerIds.indexOf(row.id);
  }
  // Games played is a count, never an average, so mode does not apply.
  if (sort === "gamesPlayed") return stats.gamesPlayed;
  if (sort === "fgPct") return shootingRate({ made: stats.fgm, attempted: stats.fga });
  if (sort === "fg3Pct") return shootingRate({ made: stats.fg3m, attempted: stats.fg3a });
  if (sort === "ftPct") return shootingRate({ made: stats.ftm, attempted: stats.fta });
  const total = stats[sort];
  return args.mode === "average" && stats.gamesPlayed > 0 ? total / stats.gamesPlayed : total;
};

// Filters, orders and pages a pool, optionally restricted to a watchlist's
// ids. A star-order sort ranks by the ids' order before the page is cut, so
// every page of a long watchlist follows it.
export const rankPlayers = ({
  pool,
  args,
}: {
  pool: readonly PlayerPoolRow[];
  args: RankArgs;
}): PlayersSearchResult => {
  const { q, page, size, dir, sort, playerIds } = args;
  return rankRows({
    rows: playerIds === undefined ? pool : pool.filter((row) => playerIds.includes(row.id)),
    nameOf: (row) => row,
    q,
    page,
    size,
    dir,
    order: isNameSort(sort)
      ? { by: "name", sort }
      : {
          by: "value",
          valueOf: (row) => ({
            sink: !meetsMinimum({ stats: row.stats, sort, args }),
            value: statSortValue({ row, sort, args }),
          }),
        },
  });
};
