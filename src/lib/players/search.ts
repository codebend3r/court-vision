import { Prisma } from "@generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { PlayersSearchParams } from "@/lib/players/searchParams";

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

type CountingStatKey =
  | "fgm"
  | "fga"
  | "fg3m"
  | "fg3a"
  | "ftm"
  | "fta"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "pts";
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

const statSelect = {
  fgm: true,
  fga: true,
  fg3m: true,
  fg3a: true,
  ftm: true,
  fta: true,
  reb: true,
  ast: true,
  stl: true,
  blk: true,
  tov: true,
  pts: true,
};

// Recent-range game logs also need minutes so a DNP (0 minutes) can be
// excluded from games played, even though it is never summed as a stat.
const gameLogSelect = {
  ...statSelect,
  minutes: true,
};

const rowSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  teamAbbr: true,
  position: true,
  nbaPersonId: true,
  seasonStats: {
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" as const },
    take: 1,
    select: {
      gamesPlayed: true,
      ...statSelect,
    },
  },
};

const emptyStats = (): PlayerStats => ({
  gamesPlayed: 0,
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
});

const statKeys: readonly CountingStatKey[] = [
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
];

const isSortableCountingStatKey = (
  key: PlayersSearchParams["sort"],
): key is SortableCountingStatKey =>
  ["pts", "reb", "ast", "stl", "blk", "fgm", "fga", "fg3m", "fg3a", "tov"].some(
    (statKey) => statKey === key,
  );

const withDisplayStats = ({
  row,
  range,
}: {
  row: PlayerRow;
  range: PlayersSearchParams["range"];
}): PlayerRow => {
  if (range === "all") {
    return { ...row, stats: row.seasonStats?.[0] ?? emptyStats() };
  }
  const logs = row.gameLogs ?? [];
  // Games played counts appearances only; a DNP (0 minutes) does not count.
  const appearances = logs.filter((game) => game.minutes > 0).length;
  const stats = logs.reduce<PlayerStats>(
    (totals, game) =>
      statKeys.reduce<PlayerStats>(
        (updated, key) => ({ ...updated, [key]: updated[key] + game[key] }),
        totals,
      ),
    { ...emptyStats(), gamesPlayed: appearances },
  );
  return { ...row, stats };
};

// Official NBA percentage-leader qualifiers, by made volume (300 FGM for FG%,
// 82 3PM for 3P%, 125 FTM for FT%). Toggled by the minimums search param.
const MIN_FGM = 300;
const MIN_FG3M = 82;
const MIN_FTM = 125;

const meetsMinimum = ({ row, args }: { row: PlayerRow; args: PlayersSearchParams }): boolean => {
  if (!args.minimums) return true;
  const stats = row.stats ?? emptyStats();
  if (args.sort === "fgPct") return stats.fgm >= MIN_FGM;
  if (args.sort === "fg3Pct") return stats.fg3m >= MIN_FG3M;
  if (args.sort === "ftPct") return stats.ftm >= MIN_FTM;
  return true;
};

const statSortValue = ({ row, args }: { row: PlayerRow; args: PlayersSearchParams }): number => {
  const stats = row.stats ?? emptyStats();
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

export const searchPlayers = async (args: PlayersSearchParams): Promise<PlayersSearchResult> => {
  const { q, page, size, sort, dir, range } = args;
  // Retired players (no game logs) are never shown.
  const where: Prisma.PlayerWhereInput = {
    gameLogs: { some: {} },
    ...(q === "" ? {} : { fullName: { contains: q, mode: "insensitive" } }),
  };
  const orderBy: Prisma.PlayerOrderByWithRelationInput[] =
    sort === "lastName"
      ? [{ lastName: dir }, { firstName: dir }, { id: "asc" }]
      : [{ firstName: dir }, { lastName: dir }, { id: "asc" }];

  const gameLimit = range === "all" ? null : Number.parseInt(range.replace("last", ""), 10);
  const gameLogOrder: Prisma.PlayerGameLogOrderByWithRelationInput = { gameDate: "desc" };
  const select =
    gameLimit !== null
      ? {
          ...rowSelect,
          gameLogs: { orderBy: gameLogOrder, take: gameLimit, select: gameLogSelect },
        }
      : rowSelect;
  const isStatSort = sort !== "firstName" && sort !== "lastName";

  if (isStatSort) {
    const candidates = await prisma.player.findMany({ where, select });
    const sorted = candidates
      .map((row) => withDisplayStats({ row, range }))
      .sort((a, b) => {
        // Players below the qualifying minimum always sink to the bottom,
        // whatever the direction, so leaders are real leaders.
        const aBelowMinimum = meetsMinimum({ row: a, args }) ? 0 : 1;
        const bBelowMinimum = meetsMinimum({ row: b, args }) ? 0 : 1;
        if (aBelowMinimum !== bBelowMinimum) return aBelowMinimum - bBelowMinimum;
        const difference = statSortValue({ row: a, args }) - statSortValue({ row: b, args });
        if (difference !== 0) return dir === "asc" ? difference : -difference;
        return (
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.id - b.id
        );
      });
    const total = sorted.length;
    const lastPage = Math.max(1, Math.ceil(total / size));
    const clampedPage = Math.min(page, lastPage);
    return {
      rows: sorted.slice((clampedPage - 1) * size, clampedPage * size),
      total,
      page: total === 0 ? 1 : clampedPage,
    };
  }

  const pageQuery = (pageNumber: number) =>
    prisma.player.findMany({
      where,
      select,
      orderBy,
      skip: (pageNumber - 1) * size,
      take: size,
    });

  const [rows, total] = await prisma.$transaction([
    pageQuery(page),
    prisma.player.count({ where }),
  ]);
  if (rows.length > 0 || total === 0) {
    return {
      rows: rows.map((row) => withDisplayStats({ row, range })),
      total,
      page: total === 0 ? 1 : page,
    };
  }
  const lastPage = Math.max(1, Math.ceil(total / size));
  const clamped = await pageQuery(lastPage);
  return {
    rows: clamped.map((row) => withDisplayStats({ row, range })),
    total,
    page: lastPage,
  };
};
