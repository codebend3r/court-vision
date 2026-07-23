import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { buildTeamStats, type TeamGameResult, type TeamSeasonStats } from "@/lib/teams/stats";

export type TeamsData = {
  season: string | null;
  stats: TeamSeasonStats[];
};

const latestSeason = async (): Promise<string | null> => {
  const row = await prisma.playerGameLog.findFirst({
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" },
    select: { season: true },
  });
  return row?.season ?? null;
};

const fetchTeams = async (): Promise<TeamsData> => {
  const season = await latestSeason();
  if (season === null) return { season: null, stats: [] };
  const where = { season, seasonType: "Regular Season" };
  // One row per (team, game) carries the final score and result; the groupBy
  // sums every player's box score into team totals.
  const [gameRows, boxRows] = await Promise.all([
    prisma.playerGameLog.findMany({
      where,
      distinct: ["teamId", "gameId"],
      select: {
        teamAbbr: true,
        gameId: true,
        teamScore: true,
        opponentScore: true,
        winLoss: true,
      },
    }),
    prisma.playerGameLog.groupBy({
      by: ["teamAbbr"],
      where,
      _sum: {
        pts: true,
        reb: true,
        ast: true,
        stl: true,
        blk: true,
        tov: true,
        fg3m: true,
        fgm: true,
        fga: true,
        ftm: true,
        fta: true,
      },
    }),
  ]);
  const results: TeamGameResult[] = gameRows;
  const totals = boxRows.map((row) => ({
    teamAbbr: row.teamAbbr,
    pts: row._sum.pts ?? 0,
    reb: row._sum.reb ?? 0,
    ast: row._sum.ast ?? 0,
    stl: row._sum.stl ?? 0,
    blk: row._sum.blk ?? 0,
    tov: row._sum.tov ?? 0,
    fg3m: row._sum.fg3m ?? 0,
    fgm: row._sum.fgm ?? 0,
    fga: row._sum.fga ?? 0,
    ftm: row._sum.ftm ?? 0,
    fta: row._sum.fta ?? 0,
  }));
  return { season, stats: buildTeamStats({ results, totals }) };
};

// Same cache regime as the players loaders: tag-shared invalidation, 300s.
const cachedTeams = unstable_cache(() => fetchTeams(), ["teams:stats"], {
  revalidate: 300,
  tags: ["players"],
});

export const getTeamStats = (): Promise<TeamsData> => cachedTeams();

export type TeamRosterPlayer = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string | null;
  jerseyNumber: string | null;
  nbaPersonId: number | null;
  teamAbbr: string | null;
};

// Current roster: players whose Balldontlie team is this one, active (has
// game logs). Ordered by name for the /team roster section.
const fetchRoster = async (abbr: string): Promise<TeamRosterPlayer[]> =>
  prisma.player.findMany({
    where: { teamAbbr: abbr, gameLogs: { some: {} } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      position: true,
      jerseyNumber: true,
      nbaPersonId: true,
      teamAbbr: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

const cachedRoster = unstable_cache((abbr: string) => fetchRoster(abbr), ["team:roster"], {
  revalidate: 300,
  tags: ["players"],
});

export const getTeamRoster = ({ abbr }: { abbr: string }): Promise<TeamRosterPlayer[]> =>
  cachedRoster(abbr);
