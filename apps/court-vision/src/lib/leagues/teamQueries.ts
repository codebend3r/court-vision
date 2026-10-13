import { getActiveLeagueRecord } from "@/lib/leagues/queries";
import { rowsToSlots } from "@/lib/leagues/teams";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";
import { prisma } from "@/lib/prisma";

export const TEAM_INCLUDE = {
  slots: {
    orderBy: { position: "asc" },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          teamAbbr: true,
          position: true,
          nbaPersonId: true,
        },
      },
    },
  },
} as const;

type TeamWithSlots = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  slots: Array<{
    slotType: string;
    player: {
      id: number;
      firstName: string;
      lastName: string;
      fullName: string;
      teamAbbr: string | null;
      position: string | null;
      nbaPersonId: number | null;
    } | null;
  }>;
};

// DB row → RSC-boundary-safe FantasyTeam. Player.id (the NBA player id) maps
// onto FantasyTeamPlayer.playerId here.
export const toFantasyTeam = ({ team }: { team: TeamWithSlots }): FantasyTeam => ({
  id: team.id,
  name: team.name,
  slug: team.slug,
  createdAt: team.createdAt.toISOString(),
  slots: rowsToSlots({
    rows: team.slots.map((slot) => ({
      slotType: slot.slotType,
      player:
        slot.player === null
          ? null
          : {
              playerId: slot.player.id,
              firstName: slot.player.firstName,
              lastName: slot.player.lastName,
              fullName: slot.player.fullName,
              teamAbbr: slot.player.teamAbbr,
              position: slot.player.position,
              nbaPersonId: slot.player.nbaPersonId,
            },
    })),
  }),
});

export const getLeagueTeams = async ({
  leagueId,
}: {
  leagueId: string;
}): Promise<FantasyTeam[]> => {
  const teams = await prisma.leagueTeam.findMany({
    where: { leagueId },
    orderBy: { createdAt: "asc" },
    include: TEAM_INCLUDE,
  });
  return teams.map((team) => toFantasyTeam({ team }));
};

export const getLeagueTeamBySlug = async ({
  leagueId,
  slug,
}: {
  leagueId: string;
  slug: string;
}): Promise<FantasyTeam | null> => {
  const team = await prisma.leagueTeam.findFirst({
    where: { leagueId, slug },
    include: TEAM_INCLUDE,
  });
  return team === null ? null : toFantasyTeam({ team });
};

// Every player on one of your teams in the active league, which the player
// tables tint as "on your team". Signed out or without a league, nobody is.
// Uncached for the same reason as the watchlist read: per-user, a few dozen
// rows, and it must reflect a saved team immediately.
export const getRosteredPlayerIds = async (): Promise<number[]> => {
  const league = await getActiveLeagueRecord();
  if (league === null) return [];
  const slots = await prisma.leagueTeamSlot.findMany({
    where: { team: { leagueId: league.id }, playerId: { not: null } },
    distinct: ["playerId"],
    select: { playerId: true },
  });
  return slots.flatMap((slot) => (slot.playerId === null ? [] : [slot.playerId]));
};
