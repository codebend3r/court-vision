import { unstable_cache } from "next/cache";

import { PLAYERS_CACHE_OPTIONS } from "@/lib/cache";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";
import { PLAYER_IDENTITY_SELECT } from "@/lib/players/identity";
import { prisma } from "@/lib/prisma";

// Every player on a current NBA roster, stats or not. The builder's pool is
// otherwise drawn from stat lines, which leaves out rookies and anyone else
// yet to play, so this list fills those gaps.
const fetchActiveRosterPlayers = async (): Promise<FantasyTeamPlayer[]> => {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    select: PLAYER_IDENTITY_SELECT,
  });
  return players.map(({ id, ...identity }) => ({ playerId: id, ...identity }));
};

// Same cache regime as the other player loaders: tag-shared invalidation, 300s.
const cachedActiveRosterPlayers = unstable_cache(
  () => fetchActiveRosterPlayers(),
  ["fantasyTeams:activeRosterPlayers"],
  PLAYERS_CACHE_OPTIONS,
);

export const getActiveRosterPlayers = (): Promise<FantasyTeamPlayer[]> =>
  cachedActiveRosterPlayers();
