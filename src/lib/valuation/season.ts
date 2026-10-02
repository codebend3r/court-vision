import { prisma } from "@/lib/prisma";

// A valuation pool, and every trend measured against it, must come from one
// season: mixing each player's personal latest season would compare 2023
// lines against 2025 lines. The latest season with regular-season rows wins.
export const latestSeason = async (): Promise<string | null> => {
  const row = await prisma.playerSeasonStats.findFirst({
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" },
    select: { season: true },
  });
  return row?.season ?? null;
};
