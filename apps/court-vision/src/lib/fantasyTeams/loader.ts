import { unstable_cache } from "next/cache";

import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";
import { prisma } from "@/lib/prisma";

// Every player on a current NBA roster, stats or not. The builder's pool is
// otherwise drawn from stat lines, which leaves out rookies and anyone else
// yet to play, so this list fills those gaps.
const fetchActiveRosterPlayers = async (): Promise<FantasyTeamPlayer[]> => {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      teamAbbr: true,
      position: true,
      nbaPersonId: true,
    },
  });
  return players.map(({ id, ...identity }) => ({ playerId: id, ...identity }));
};

// Same cache regime as the other player loaders: tag-shared invalidation, 300s.
const cachedActiveRosterPlayers = unstable_cache(
  () => fetchActiveRosterPlayers(),
  ["fantasyTeams:activeRosterPlayers"],
  { revalidate: 300, tags: ["players"] },
);

export const getActiveRosterPlayers = (): Promise<FantasyTeamPlayer[]> =>
  cachedActiveRosterPlayers();
