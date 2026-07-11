import { Prisma } from "@generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { PlayersSearchParams } from "./searchParams";

export interface PlayerRow {
  id: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
}

export interface PlayersSearchResult {
  rows: PlayerRow[];
  total: number;
  page: number;
}

const rowSelect = { id: true, fullName: true, teamAbbr: true, position: true };

export const searchPlayers = async (args: PlayersSearchParams): Promise<PlayersSearchResult> => {
  const { q, page, size, includeRetired } = args;
  const where: Prisma.PlayerWhereInput = {
    ...(includeRetired ? {} : { gameLogs: { some: {} } }),
    ...(q === "" ? {} : { fullName: { contains: q, mode: "insensitive" } }),
  };

  const pageQuery = (pageNumber: number) =>
    prisma.player.findMany({
      where,
      select: rowSelect,
      orderBy: { fullName: "asc" },
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
