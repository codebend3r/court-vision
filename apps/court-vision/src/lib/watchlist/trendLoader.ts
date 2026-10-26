import { unstable_cache } from "next/cache";

import { type RollingMethod, type TrendSeries } from "@vision/core/valuation/rolling";
import {
  buildRollingSeries,
  DEFAULT_VALUATION_CONFIG,
  poolStatsFor,
} from "@vision/sport-basketball/engine";

import { PLAYERS_CACHE_OPTIONS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { SEASON_TYPE } from "@/lib/stats/season";
import { getFantasyPool } from "@/lib/valuation/loader";
import { latestSeason } from "@/lib/valuation/season";
import { GAME_LOG_SELECT, toWindowLog } from "@/lib/valuation/trendLogs";

// One player's rolling Z and G series, scored from the same logs and pool.
type PlayerTrends = Record<RollingMethod, TrendSeries>;

// The homepage charts both trends for the same players, so one read feeds both
// methods: the season, the pool, its stats and the player's logs are fetched
// once rather than once per chart.
type FetchTrendsProps = {
  playerId: number;
  fullName: string;
};

const fetchTrends = async ({ playerId, fullName }: FetchTrendsProps): Promise<PlayerTrends> => {
  const season = await latestSeason();
  if (season === null) {
    return { z: { playerId, fullName, points: [] }, g: { playerId, fullName, points: [] } };
  }
  // The yardstick is the whole season's pool, held fixed across every window.
  const lines = await getFantasyPool({ range: "all" });
  const poolStats = poolStatsFor({ lines, config: DEFAULT_VALUATION_CONFIG, windowGames: null });
  const rows = await prisma.playerGameLog.findMany({
    where: { playerId, season, seasonType: SEASON_TYPE },
    orderBy: { gameDate: "asc" },
    select: GAME_LOG_SELECT,
  });
  const logs = rows.map(({ gameDate, ...row }) => ({ ...toWindowLog({ row }), gameDate }));
  type SeriesForProps = { method: RollingMethod };

  const seriesFor = ({ method }: SeriesForProps): TrendSeries =>
    buildRollingSeries({
      method,
      playerId,
      fullName,
      logs,
      poolStats,
      config: DEFAULT_VALUATION_CONFIG,
    });
  return { z: seriesFor({ method: "z" }), g: seriesFor({ method: "g" }) };
};

// Cached per player rather than per watchlist: two users watching the same star
// share one entry. Same tag and revalidate window as the other players caches,
// so one sync invalidation busts every surface.
const cachedTrends = unstable_cache(
  (playerId: number, fullName: string) => fetchTrends({ playerId, fullName }),
  ["watchlist:trends"],
  PLAYERS_CACHE_OPTIONS,
);

// Every listed player's Z and G series, in the order given.
type GetTrendSeriesProps = {
  players: readonly { playerId: number; fullName: string }[];
};

export const getTrendSeries = async ({
  players,
}: GetTrendSeriesProps): Promise<{ z: TrendSeries[]; g: TrendSeries[] }> => {
  const trends = await Promise.all(
    players.map((player) => cachedTrends(player.playerId, player.fullName)),
  );
  return { z: trends.map((trend) => trend.z), g: trends.map((trend) => trend.g) };
};
