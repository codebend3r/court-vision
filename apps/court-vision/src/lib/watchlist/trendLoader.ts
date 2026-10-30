import { unstable_cache } from "next/cache";
import { cache } from "react";

import { scoreAverageLines } from "@vision/core/valuation/leagueAverage";
import { METHOD_VALUE_KEYS } from "@vision/core/valuation/registry";
import { type TrendPoint, type TrendSeries } from "@vision/core/valuation/rolling";
import { type MethodValueKey } from "@vision/core/valuation/types";
import { recordFromKeys } from "@vision/core/util/record";
import { buildRollingSeries, buildYardstick, poolStatsFor } from "@vision/sport-basketball/engine";
import { type MethodWeights, type ValuationConfig } from "@vision/sport-basketball/types";

import { PLAYERS_CACHE_OPTIONS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { SEASON_TYPE } from "@/lib/stats/season";
import { getLeagueAverageLines } from "@/lib/valuation/leagueAverage";
import { type LeagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { getFantasyPool } from "@/lib/valuation/loader";
import { latestSeason } from "@/lib/valuation/season";
import { GAME_LOG_SELECT, toWindowLog } from "@/lib/valuation/trendLogs";

// One player's rolling series on every method, scored from the same logs and
// yardstick.
type PlayerTrends = Record<MethodValueKey, TrendSeries>;

// The yardstick is the whole season's pool on the user's league settings,
// held fixed across every window. Building it values the whole pool (SGP and
// Sim Value each simulate a league), so it is built at most once per request
// however many players are charted: the page hands every call the same
// settings objects, which is what `cache` keys on.
const seasonYardstick = cache(async (config: ValuationConfig, methodWeights: MethodWeights) => {
  const lines = await getFantasyPool({ range: "all" });
  const poolStats = poolStatsFor({ lines, config, windowGames: null });
  return buildYardstick({ lines, poolStats, config, methodWeights });
});

type Settings = Pick<LeagueValuationSettings, "config" | "methodWeights">;

type FetchTrendsProps = {
  playerId: number;
  fullName: string;
  position: string | null;
  settings: Settings;
};

const noTrends = ({ playerId, fullName }: FetchTrendsProps): PlayerTrends =>
  recordFromKeys({
    keys: METHOD_VALUE_KEYS,
    value: (): TrendSeries => ({ playerId, fullName, points: [] }),
  });

const fetchTrends = async (props: FetchTrendsProps): Promise<PlayerTrends> => {
  const { playerId, fullName, position, settings } = props;
  const season = await latestSeason();
  if (season === null) return noTrends(props);
  const [yardstick, rows] = await Promise.all([
    seasonYardstick(settings.config, settings.methodWeights),
    prisma.playerGameLog.findMany({
      where: { playerId, season, seasonType: SEASON_TYPE },
      orderBy: { gameDate: "asc" },
      select: GAME_LOG_SELECT,
    }),
  ]);
  const logs = rows.map(({ gameDate, ...row }) => ({ ...toWindowLog({ row }), gameDate }));
  return buildRollingSeries({ playerId, fullName, position, logs, yardstick });
};

// Cached per player and league settings rather than per watchlist: two users
// in like-configured leagues watching the same star share one entry. Same tag
// and revalidate window as the other players caches, so one sync
// invalidation busts every surface.
const cachedTrends = unstable_cache(
  (playerId: number, fullName: string, position: string | null, settings: Settings) =>
    fetchTrends({ playerId, fullName, position, settings }),
  ["watchlist:trends:methods"],
  PLAYERS_CACHE_OPTIONS,
);

// The league's average rolling value per game date on every method, scored
// with the same yardstick as the players' series: the moving dotted line.
type MethodTrendPoints = Record<MethodValueKey, TrendPoint[]>;

type FetchAveragesProps = { settings: Settings };

const fetchAverages = async ({ settings }: FetchAveragesProps): Promise<MethodTrendPoints> => {
  const season = await latestSeason();
  const [yardstick, lines] =
    season === null
      ? [null, []]
      : await Promise.all([
          seasonYardstick(settings.config, settings.methodWeights),
          getLeagueAverageLines({ season }),
        ]);
  const scored = yardstick === null ? [] : scoreAverageLines({ yardstick, lines });
  return recordFromKeys({
    keys: METHOD_VALUE_KEYS,
    value: (key) => scored.map(({ date, values }) => ({ date, value: values[key] })),
  });
};

const cachedAverages = unstable_cache(
  (settings: Settings) => fetchAverages({ settings }),
  ["watchlist:trends:league-averages"],
  PLAYERS_CACHE_OPTIONS,
);

export type WatchlistTrends = {
  // Every listed player's series per method, in the order given.
  series: Record<MethodValueKey, TrendSeries[]>;
  // The league average per game date on every method.
  averages: MethodTrendPoints;
};

type GetTrendSeriesProps = {
  players: readonly { playerId: number; fullName: string; position: string | null }[];
  // The user's league settings (leagueValuationSettings), so the charts value
  // players exactly as the rest of the dashboard does.
  settings: Settings;
};

export const getTrendSeries = async ({
  players,
  settings,
}: GetTrendSeriesProps): Promise<WatchlistTrends> => {
  const [trends, averages] = await Promise.all([
    Promise.all(
      players.map((player) =>
        cachedTrends(player.playerId, player.fullName, player.position, settings),
      ),
    ),
    cachedAverages(settings),
  ]);
  return {
    series: recordFromKeys({
      keys: METHOD_VALUE_KEYS,
      value: (key) => trends.map((trend) => trend[key]),
    }),
    averages,
  };
};
