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
}

export interface PlayersSearchResult {
  rows: PlayerRow[];
  total: number;
  page: number;
}

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
    },
  },
};

export const searchPlayers = async (args: PlayersSearchParams): Promise<PlayersSearchResult> => {
  const { q, page, size, includeRetired, sort, dir } = args;
  const where: Prisma.PlayerWhereInput = {
    ...(includeRetired ? {} : { gameLogs: { some: {} } }),
    ...(q === "" ? {} : { fullName: { contains: q, mode: "insensitive" } }),
  };
  const orderBy: Prisma.PlayerOrderByWithRelationInput[] =
    sort === "lastName"
      ? [{ lastName: dir }, { firstName: dir }, { id: "asc" }]
      : [{ firstName: dir }, { lastName: dir }, { id: "asc" }];

  const pageQuery = (pageNumber: number) =>
    prisma.player.findMany({
      where,
      select: rowSelect,
      orderBy,
      skip: (pageNumber - 1) * size,
      take: size,
    });

  const [rows, total] = await prisma.$transaction([
    pageQuery(page),
    prisma.player.count({ where }),
  ]);
  if (rows.length > 0 || total === 0) {
    return { rows, total, page: total === 0 ? 1 : page };
  }
  const lastPage = Math.max(1, Math.ceil(total / size));
  const clamped = await pageQuery(lastPage);
  return { rows: clamped, total, page: lastPage };
};
