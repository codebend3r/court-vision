import { type League } from "@generated/prisma/client";

import { parseStatValue } from "@/lib/matchups/standings";
import {
  type LeagueWeek,
  statCategoriesSchema,
  statTotalsSchema,
  type WeekTeam,
} from "@/lib/matchups/types";
import { prisma } from "@/lib/prisma";

type StoredTeam = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  managerName: string | null;
};

type StoredMatchup = {
  week: number;
  weekStart: string | null;
  weekEnd: string | null;
  status: string | null;
  teamAId: string;
  teamBId: string | null;
  syncedAt: Date | null;
  statsA: unknown;
  statsB: unknown;
};

/** Reads a stored side's totals; anything that isn't `{ statId: string }` is no totals. */
type TotalsOfProps = { stats: unknown };

const totalsOf = ({ stats }: TotalsOfProps): Record<string, string> => {
  const parsed = statTotalsSchema.safeParse(stats);
  return parsed.success ? parsed.data : {};
};

type ToWeekTeamProps = {
  team: StoredTeam;
  display: Record<string, string>;
  myTeamId: string | null;
};

const toWeekTeam = ({ team, display, myTeamId }: ToWeekTeamProps): WeekTeam => ({
  teamId: team.id,
  name: team.name,
  slug: team.slug,
  logoUrl: team.logoUrl,
  managerName: team.managerName,
  isMine: team.id === myTeamId,
  display,
  values: Object.fromEntries(
    Object.entries(display).map(([statId, raw]) => [statId, parseStatValue({ raw })]),
  ),
});

/**
 * Builds the week from stored rows. Null when the league has no categories or
 * no matchup yet (never synced since matchups arrived, or Yahoo sent none).
 * A matchup naming a team that is gone is skipped.
 */
type ToLeagueWeekProps = {
  statCategories: unknown;
  matchups: readonly StoredMatchup[];
  teams: readonly StoredTeam[];
  myTeamId: string | null;
};

export const toLeagueWeek = ({
  statCategories,
  matchups,
  teams,
  myTeamId,
}: ToLeagueWeekProps): LeagueWeek | null => {
  const categories = statCategoriesSchema.safeParse(statCategories);
  const [first] = matchups;
  if (!categories.success || !categories.data.length || first === undefined) return null;

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const weekTeams = matchups.flatMap(({ teamAId, teamBId, statsA, statsB }) =>
    [
      { teamId: teamAId, stats: statsA },
      { teamId: teamBId, stats: statsB },
    ].flatMap(({ teamId, stats }) => {
      const team = teamId === null ? undefined : teamById.get(teamId);
      return team === undefined
        ? []
        : [toWeekTeam({ team, display: totalsOf({ stats }), myTeamId })];
    }),
  );
  if (!weekTeams.length) return null;

  return {
    syncedAt: first.syncedAt?.toISOString() ?? null,
    week: first.week,
    weekStart: first.weekStart,
    weekEnd: first.weekEnd,
    status: first.status,
    categories: categories.data.map(({ statId, displayName, higherIsBetter }) => ({
      statId,
      label: displayName,
      higherIsBetter,
    })),
    teams: weekTeams,
    pairings: matchups.flatMap(({ teamAId, teamBId }) =>
      teamBId === null || !teamById.has(teamAId) || !teamById.has(teamBId)
        ? []
        : [{ teamAId, teamBId }],
    ),
  };
};

/** The active league's current week, read from its last sync. */
type GetLeagueWeekProps = {
  league: Pick<League, "id" | "myTeamId" | "statCategories">;
};

export const getLeagueWeek = async ({ league }: GetLeagueWeekProps): Promise<LeagueWeek | null> => {
  const [matchups, teams] = await Promise.all([
    prisma.leagueMatchup.findMany({
      where: { leagueId: league.id },
      orderBy: { id: "asc" },
    }),
    prisma.leagueTeam.findMany({
      where: { leagueId: league.id },
      select: { id: true, name: true, slug: true, logoUrl: true, managerName: true },
    }),
  ]);
  return toLeagueWeek({
    statCategories: league.statCategories,
    matchups,
    teams,
    myTeamId: league.myTeamId,
  });
};
