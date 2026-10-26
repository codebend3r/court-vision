import { getActiveLeagueRecord } from "@/lib/leagues/queries";
import { rowsToTeamSlots } from "@/lib/leagues/teams";
import { type LeagueOwner, type LeaguePosition } from "@/lib/leagues/rosteredStore";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";
import { prisma } from "@/lib/prisma";

// `include` returns every scalar column of the team and its slots, so the
// imported-league columns (logoUrl, managerName, externalPlayerName) come
// along without being listed.
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
  logoUrl: string | null;
  managerName: string | null;
  createdAt: Date;
  slots: Array<{
    slotType: string;
    externalPlayerName: string | null;
    displayPosition: string | null;
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

// The two league columns that decide whose team this is and whether it can
// be edited.
type TeamLeague = { provider: string; myTeamId: string | null };

// Tests the raw column so a provider this build doesn't know fails closed,
// matching the `provider: "manual"` filters on the team write paths.
type IsImportedLeagueProps = { league: TeamLeague };

const isImportedLeague = ({ league }: IsImportedLeagueProps): boolean =>
  league.provider !== "manual";

// DB row → RSC-boundary-safe FantasyTeam. Player.id (the NBA player id) maps
// onto FantasyTeamPlayer.playerId here.
type ToFantasyTeamProps = {
  team: TeamWithSlots;
  isMine: boolean;
  isImported: boolean;
};

export const toFantasyTeam = ({ team, isMine, isImported }: ToFantasyTeamProps): FantasyTeam => {
  const { slots, unmatchedBySlotId } = rowsToTeamSlots({
    rows: team.slots.map((slot) => ({
      slotType: slot.slotType,
      externalPlayerName: slot.externalPlayerName,
      player:
        slot.player === null
          ? null
          : {
              playerId: slot.player.id,
              firstName: slot.player.firstName,
              lastName: slot.player.lastName,
              fullName: slot.player.fullName,
              teamAbbr: slot.player.teamAbbr,
              position: slot.displayPosition ?? slot.player.position,
              nbaPersonId: slot.player.nbaPersonId,
            },
    })),
  });
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    createdAt: team.createdAt.toISOString(),
    slots,
    logoUrl: team.logoUrl,
    managerName: team.managerName,
    isMine,
    isImported,
    unmatchedBySlotId,
  };
};

// The user's own team first, then the rest in creation order. Only an
// imported league has a "my team"; a hand-built league's order is unchanged.
type GetLeagueTeamsProps = {
  leagueId: string;
};

export const getLeagueTeams = async ({ leagueId }: GetLeagueTeamsProps): Promise<FantasyTeam[]> => {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      provider: true,
      myTeamId: true,
      teams: { orderBy: { createdAt: "asc" }, include: TEAM_INCLUDE },
    },
  });
  if (league === null) return [];
  const isImported = isImportedLeague({ league });
  const teams = league.teams.map((team) =>
    toFantasyTeam({ team, isMine: team.id === league.myTeamId, isImported }),
  );
  return [...teams.filter((team) => team.isMine), ...teams.filter((team) => !team.isMine)];
};

type GetLeagueTeamBySlugProps = {
  leagueId: string;
  slug: string;
};

export const getLeagueTeamBySlug = async ({
  leagueId,
  slug,
}: GetLeagueTeamBySlugProps): Promise<FantasyTeam | null> => {
  const team = await prisma.leagueTeam.findFirst({
    where: { leagueId, slug },
    include: { ...TEAM_INCLUDE, league: { select: { provider: true, myTeamId: true } } },
  });
  if (team === null) return null;
  return toFantasyTeam({
    team,
    isMine: team.id === team.league.myTeamId,
    isImported: isImportedLeague({ league: team.league }),
  });
};

// Which slots count as "yours": every team in a hand-built league, only the
// team you manage in an imported one (the rest belong to your league-mates),
// and none in an imported league with no team of yours. The league filter
// stays on the imported scope too, so a stale `myTeamId` can't reach a team
// in another league.
type RosterScope = { team: { leagueId: string } } | { teamId: string; team: { leagueId: string } };

type RosterScopeProps = { league: TeamLeague & { id: string } };

const rosterScope = ({ league }: RosterScopeProps): RosterScope | null => {
  if (!isImportedLeague({ league })) return { team: { leagueId: league.id } };
  return league.myTeamId === null
    ? null
    : { teamId: league.myTeamId, team: { leagueId: league.id } };
};

// Every player on one of your teams in the active league, which the player
// tables tint as "on your team". Signed out or without a league, nobody is.
// Uncached for the same reason as the watchlist read: per-user, a few dozen
// rows, and it must reflect a saved team immediately.
export const getRosteredPlayerIds = async (): Promise<number[]> => {
  const league = await getActiveLeagueRecord();
  if (league === null) return [];
  const scope = rosterScope({ league });
  if (scope === null) return [];
  const slots = await prisma.leagueTeamSlot.findMany({
    where: { ...scope, playerId: { not: null } },
    distinct: ["playerId"],
    select: { playerId: true },
  });
  return slots.flatMap((slot) => (slot.playerId === null ? [] : [slot.playerId]));
};

// Who holds every rostered player in the active league, so the player tables
// can tell a free agent from a player on a league-mate's team. Only an
// imported league carries every manager's roster; a hand-built one holds just
// your own teams, so it answers null rather than call everyone else a free
// agent.
export const getLeagueOwners = async (): Promise<LeagueOwner[] | null> => {
  const league = await getActiveLeagueRecord();
  if (league === null || !isImportedLeague({ league })) return null;
  const slots = await prisma.leagueTeamSlot.findMany({
    where: { team: { leagueId: league.id }, playerId: { not: null } },
    select: { playerId: true, team: { select: { id: true, name: true } } },
  });
  return slots.flatMap(({ playerId, team }) =>
    playerId === null
      ? []
      : [{ playerId, teamName: team.name, isMine: team.id === league.myTeamId }],
  );
};

// The host's own position label for every player the active league's last sync
// saw, on a roster or in the free pool, so a player reads the same here as on
// Yahoo. Empty for a hand-built league, which has no host.
export const getLeaguePositions = async (): Promise<LeaguePosition[]> => {
  const league = await getActiveLeagueRecord();
  if (league === null || !isImportedLeague({ league })) return [];
  const where = { displayPosition: { not: null }, playerId: { not: null } } as const;
  const [slots, waivers] = await Promise.all([
    prisma.leagueTeamSlot.findMany({
      where: { ...where, team: { leagueId: league.id } },
      select: { playerId: true, displayPosition: true },
    }),
    prisma.leagueWaiverPlayer.findMany({
      where: { leagueId: league.id, displayPosition: { not: null } },
      select: { playerId: true, displayPosition: true },
    }),
  ]);
  return [...waivers, ...slots].flatMap(({ playerId, displayPosition }) =>
    playerId === null || displayPosition === null ? [] : [{ playerId, position: displayPosition }],
  );
};
