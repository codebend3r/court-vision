import { unstable_cache } from "next/cache";

import { PLAYERS_CACHE_OPTIONS } from "@/lib/cache";
import { PLAYER_IDENTITY_SELECT } from "@/lib/players/identity";
import { prisma } from "@/lib/prisma";
import { SEASON_TYPE } from "@/lib/stats/season";
import { type TeamGameResult } from "@vision/core/series/teamTrend";
import { recordFromKeys } from "@vision/core/util/record";

import { buildTeamStats, TEAM_BOX_KEYS, type TeamSeasonStats } from "@/lib/teams/stats";

export type TeamsData = {
  season: string | null;
  stats: TeamSeasonStats[];
  results: TeamGameResult[];
};

// The newest season with game logs. Unlike valuation's latestSeason, which
// reads season aggregates, this reads the logs the team tables are built from.
const latestGameLogSeason = async (): Promise<string | null> => {
  const row = await prisma.playerGameLog.findFirst({
    where: { seasonType: SEASON_TYPE },
    orderBy: { season: "desc" },
    select: { season: true },
  });
  return row?.season ?? null;
};

const fetchTeams = async (): Promise<TeamsData> => {
  const season = await latestGameLogSeason();
  if (season === null) return { season: null, stats: [], results: [] };
  const where = { season, seasonType: SEASON_TYPE };
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
        gameDate: true,
      },
    }),
    prisma.playerGameLog.groupBy({
      by: ["teamAbbr"],
      where,
      _sum: recordFromKeys({ keys: TEAM_BOX_KEYS, value: () => true as const }),
    }),
  ]);
  const results: TeamGameResult[] = [...gameRows].sort(
    (a, b) => a.gameDate.getTime() - b.gameDate.getTime(),
  );
  const totals = boxRows.map((row) => ({
    teamAbbr: row.teamAbbr,
    ...recordFromKeys({ keys: TEAM_BOX_KEYS, value: (key) => row._sum[key] ?? 0 }),
  }));
  return { season, stats: buildTeamStats({ results, totals }), results };
};

// Same cache regime as the players loaders: tag-shared invalidation, 300s.
export const getTeamStats = unstable_cache(
  (): Promise<TeamsData> => fetchTeams(),
  ["teams:stats"],
  PLAYERS_CACHE_OPTIONS,
);

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

// Current roster: players on Balldontlie's active list whose team is this one.
// `isActive` is written by `sync:players`, so rookies and new signings appear
// before their first game. It replaced "logged a game in the newest season",
// which hid every rookie until opening night. A game-log test also has to be
// season-scoped, because retired players keep pointing at their final club:
// the unscoped version admitted 386 of them when the backfill reached 2016-17.
// Ordered by name for the /team roster section.
const fetchRoster = (abbr: string): Promise<TeamRosterPlayer[]> =>
  prisma.player.findMany({
    where: { teamAbbr: abbr, isActive: true },
    select: { ...PLAYER_IDENTITY_SELECT, jerseyNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

const cachedRoster = unstable_cache(
  (abbr: string) => fetchRoster(abbr),
  ["team:roster"],
  PLAYERS_CACHE_OPTIONS,
);

type GetTeamRosterProps = { abbr: string };

export const getTeamRoster = ({ abbr }: GetTeamRosterProps): Promise<TeamRosterPlayer[]> =>
  cachedRoster(abbr);
