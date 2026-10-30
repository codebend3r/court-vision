import { unstable_cache } from "next/cache";

import { buildLeagueAverageLines } from "@vision/sport-basketball/engine";
import { type DatedLog } from "@vision/sport-basketball/types";

import { PLAYERS_CACHE_OPTIONS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { SEASON_TYPE } from "@/lib/stats/season";
import { GAME_LOG_SELECT, type LeagueAverageLines, toWindowLog } from "@/lib/valuation/trendLogs";

type FetchLeagueAverageLinesProps = { season: string };

// Every game log of the season, grouped by player in date order, then folded
// into one league-average rolling line per game date.
const fetchLeagueAverageLines = async ({
  season,
}: FetchLeagueAverageLinesProps): Promise<LeagueAverageLines> => {
  const rows = await prisma.playerGameLog.findMany({
    where: { season, seasonType: SEASON_TYPE },
    orderBy: [{ playerId: "asc" }, { gameDate: "asc" }],
    select: { playerId: true, ...GAME_LOG_SELECT },
  });
  const logsByPlayer = rows.reduce((byPlayer, { playerId, gameDate, ...row }) => {
    const log: DatedLog = { ...toWindowLog({ row }), gameDate };
    return byPlayer.set(playerId, [...(byPlayer.get(playerId) ?? []), log]);
  }, new Map<number, DatedLog[]>());
  return buildLeagueAverageLines({
    players: [...logsByPlayer].map(([playerId, logs]) => ({ playerId, logs })),
  });
};

// One entry per season, shared by every user and every chart. Same tag and
// revalidate window as the other players caches, so a sync busts it with the
// rest.
const cachedLeagueAverageLines = unstable_cache(
  (season: string) => fetchLeagueAverageLines({ season }),
  ["valuation:league-average-lines"],
  PLAYERS_CACHE_OPTIONS,
);

type GetLeagueAverageLinesProps = { season: string };

export const getLeagueAverageLines = ({
  season,
}: GetLeagueAverageLinesProps): Promise<LeagueAverageLines> => cachedLeagueAverageLines(season);
