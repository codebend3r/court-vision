import { Prisma } from "@generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { PlayersSearchParams } from "@/lib/players/searchParams";

export interface PlayerRow {
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
  gameLogs?: PlayerGameStats[];
}

export interface PlayerStats {
  gamesPlayed: number;
  fgm: number;
  fga: number;
  fg3m: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
}

type CountingStatKey =
  | "fgm"
  | "fga"
  | "fg3m"
  | "ftm"
  | "fta"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "pts";
type SortableCountingStatKey = "pts" | "reb" | "ast" | "stl" | "blk" | "fg3m" | "tov";
type PlayerGameStats = Omit<PlayerStats, "gamesPlayed">;

export interface PlayersSearchResult {
  rows: PlayerRow[];
  total: number;
  page: number;
}

const statSelect = {
  fgm: true,
  fga: true,
  fg3m: true,
  ftm: true,
  fta: true,
  reb: true,
  ast: true,
  stl: true,
  blk: true,
  tov: true,
  pts: true,
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
  ["pts", "reb", "ast", "stl", "blk", "fg3m", "tov"].some((statKey) => statKey === key);

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
  const stats = (row.gameLogs ?? []).reduce<PlayerStats>(
    (totals, game) =>
      statKeys.reduce<PlayerStats>(
        (updated, key) => ({ ...updated, [key]: updated[key] + game[key] }),
        totals,
      ),
    { ...emptyStats(), gamesPlayed: row.gameLogs?.length ?? 0 },
  );
  return { ...row, stats };
};

const statSortValue = ({ row, args }: { row: PlayerRow; args: PlayersSearchParams }): number => {
  const stats = row.stats ?? emptyStats();
  if (args.sort === "fgPct") return stats.fga > 0 ? stats.fgm / stats.fga : -1;
  if (args.sort === "ftPct") return stats.fta > 0 ? stats.ftm / stats.fta : -1;
  if (isSortableCountingStatKey(args.sort)) {
    const total = stats[args.sort];
    return args.mode === "average" && stats.gamesPlayed > 0 ? total / stats.gamesPlayed : total;
  }
  return 0;
};

export const searchPlayers = async (args: PlayersSearchParams): Promise<PlayersSearchResult> => {
  const { q, page, size, includeRetired, sort, dir, range } = args;
  const where: Prisma.PlayerWhereInput = {
    ...(includeRetired ? {} : { gameLogs: { some: {} } }),
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
          gameLogs: { orderBy: gameLogOrder, take: gameLimit, select: statSelect },
        }
      : rowSelect;
  const isStatSort = sort !== "firstName" && sort !== "lastName";

  if (isStatSort) {
    const candidates = await prisma.player.findMany({ where, select });
    const sorted = candidates
      .map((row) => withDisplayStats({ row, range }))
      .sort((a, b) => {
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
