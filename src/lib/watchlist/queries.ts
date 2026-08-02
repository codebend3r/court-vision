import { getProfile } from "@/lib/auth/session";
import { resolveActiveLeague } from "@/lib/leagues/queries";
import { prisma } from "@/lib/prisma";
import { type WatchlistPlayerSummary } from "@/lib/watchlist/types";

// Deliberately uncached: these reads are per-user and tiny (at most 50 rows),
// and they must reflect a write immediately. An unstable_cache tier here would
// need a per-user key and buy nothing.

export const getWatchlistPlayerIds = async (): Promise<number[]> => {
  const profile = await getProfile();
  if (profile === null) return [];
  const league = await resolveActiveLeague({ profile });
  if (league === null) return [];
  const rows = await prisma.leagueWatchlistPlayer.findMany({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
    select: { playerId: true },
  });
  return rows.map((row) => row.playerId);
};

export const getWatchlistPlayers = async ({
  limit,
}: {
  limit: number;
}): Promise<WatchlistPlayerSummary[]> => {
  const profile = await getProfile();
  if (profile === null) return [];
  const league = await resolveActiveLeague({ profile });
  if (league === null) return [];
  const rows = await prisma.leagueWatchlistPlayer.findMany({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      createdAt: true,
      player: {
        select: {
          id: true,
          fullName: true,
          teamAbbr: true,
          position: true,
          nbaPersonId: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    playerId: row.player.id,
    fullName: row.player.fullName,
    teamAbbr: row.player.teamAbbr,
    position: row.player.position,
    nbaPersonId: row.player.nbaPersonId,
    starredAt: row.createdAt.toISOString(),
  }));
};

export const getWatchlistCount = async (): Promise<number> => {
  const profile = await getProfile();
  if (profile === null) return 0;
  const league = await resolveActiveLeague({ profile });
  if (league === null) return 0;
  return prisma.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
};
