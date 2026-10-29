import { type AdvisorLeagueData, type AdvisorTeam } from "@/lib/advisor/types";
import { isRosterSlotType } from "@/lib/leagues/teams";
import { prisma } from "@/lib/prisma";
import { getWaiverLeagueData } from "@/lib/waiverWire/loader";

type StoredTeam = {
  id: string;
  name: string;
  managerName: string | null;
  slots: { playerId: number | null; slotType: string; injuryStatus: string | null }[];
};

/** Every team with its matched players; an empty or unmatched slot is no player. */
type ToAdvisorTeamsProps = { teams: readonly StoredTeam[]; myTeamId: string };

export const toAdvisorTeams = ({ teams, myTeamId }: ToAdvisorTeamsProps): AdvisorTeam[] =>
  teams.map((team) => ({
    teamId: team.id,
    name: team.name,
    managerName: team.managerName,
    isMine: team.id === myTeamId,
    players: team.slots.flatMap(({ playerId, slotType, injuryStatus }) =>
      playerId !== null && isRosterSlotType(slotType) ? [{ playerId, slotType, injuryStatus }] : [],
    ),
  }));

// What the Roster Advisor needs from the imported league: the Waiver Wire's
// data, plus every team's roster. Uncached for the Waiver Wire's reason: per
// user, small, and it must reflect a sync at once.
type GetAdvisorLeagueDataProps = { leagueId: string; myTeamId: string };

export const getAdvisorLeagueData = async ({
  leagueId,
  myTeamId,
}: GetAdvisorLeagueDataProps): Promise<AdvisorLeagueData> => {
  const [waiver, teams] = await Promise.all([
    getWaiverLeagueData({ leagueId, myTeamId }),
    prisma.leagueTeam.findMany({
      where: { leagueId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        managerName: true,
        slots: {
          orderBy: { position: "asc" },
          select: { playerId: true, slotType: true, injuryStatus: true },
        },
      },
    }),
  ]);
  return { ...waiver, teams: toAdvisorTeams({ teams, myTeamId }) };
};
