import { unstable_cache } from "next/cache";

import { type DatedMethodValues, scoreAverageLines } from "@vision/core/valuation/leagueAverage";
import { METHOD_VALUE_KEYS } from "@vision/core/valuation/registry";
import { type TrendSeries } from "@vision/core/valuation/rolling";
import { type MethodValueKey } from "@vision/core/valuation/types";
import { recordFromKeys } from "@vision/core/util/record";
import { buildRollingSeries } from "@vision/sport-basketball/engine";

import { PLAYERS_CACHE_OPTIONS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { SEASON_TYPE } from "@/lib/stats/season";
import { getLeagueAverageLines } from "@/lib/valuation/leagueAverage";
import { type LeagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { latestSeason } from "@/lib/valuation/season";
import { type SeasonValuation } from "@/lib/valuation/seasonValuation";
import { GAME_LOG_SELECT, toWindowLog } from "@/lib/valuation/trendLogs";

// One player's rolling series on every method, scored from the same logs and
// yardstick.
type PlayerTrends = Record<MethodValueKey, TrendSeries>;

type Settings = Pick<LeagueValuationSettings, "config" | "methodWeights">;

// Every series is measured against the page's season yardstick, held fixed
// across every window. The page builds it once (getSeasonValuation) and the
// scorers below only wait on it when a cache entry is missing.
type YardstickSource = { valuation: Promise<SeasonValuation> };

type FetchTrendsProps = YardstickSource & {
  playerId: number;
  fullName: string;
  position: string | null;
};

const noTrends = ({ playerId, fullName }: FetchTrendsProps): PlayerTrends =>
  recordFromKeys({
    keys: METHOD_VALUE_KEYS,
    value: (): TrendSeries => ({ playerId, fullName, points: [] }),
  });

const fetchTrends = async (props: FetchTrendsProps): Promise<PlayerTrends> => {
  const { playerId, fullName, position, valuation } = props;
  const season = await latestSeason();
  if (season === null) return noTrends(props);
  const [{ yardstick }, rows] = await Promise.all([
    valuation,
    prisma.playerGameLog.findMany({
      where: { playerId, season, seasonType: SEASON_TYPE },
      orderBy: { gameDate: "asc" },
      select: GAME_LOG_SELECT,
    }),
  ]);
  const logs = rows.map(({ gameDate, ...row }) => ({ ...toWindowLog({ row }), gameDate }));
  return buildRollingSeries({ playerId, fullName, position, logs, yardstick });
};

// The league's average rolling value per game date on every method, scored
// with the same yardstick as the players' series: the moving dotted line.
const fetchAverages = async ({ valuation }: YardstickSource): Promise<DatedMethodValues[]> => {
  const season = await latestSeason();
  if (season === null) return [];
  const [{ yardstick }, lines] = await Promise.all([valuation, getLeagueAverageLines({ season })]);
  return scoreAverageLines({ yardstick, lines });
};

export type WatchlistTrends = {
  // Every listed player's series per method, in the order given.
  series: Record<MethodValueKey, TrendSeries[]>;
  // The league average per game date on every method.
  averages: DatedMethodValues[];
};

type GetTrendSeriesProps = YardstickSource & {
  players: readonly { playerId: number; fullName: string; position: string | null }[];
  // The user's league settings (leagueValuationSettings): the cache key, since
  // they are what the valuation was built from.
  settings: Settings;
};

export const getTrendSeries = async ({
  players,
  settings,
  valuation,
}: GetTrendSeriesProps): Promise<WatchlistTrends> => {
  // Cached per player and league settings rather than per watchlist: two
  // users in like-configured leagues watching the same star share one entry.
  // The yardstick is not serializable, so it reaches the scorer through this
  // closure and the settings it was built from stand in for it in the key.
  // Same tag and revalidate window as the other players caches, so one sync
  // invalidation busts every surface.
  const cachedTrends = unstable_cache(
    (playerId: number, fullName: string, position: string | null, _settings: Settings) =>
      fetchTrends({ playerId, fullName, position, valuation }),
    ["watchlist:trends:methods"],
    PLAYERS_CACHE_OPTIONS,
  );
  const cachedAverages = unstable_cache(
    (_settings: Settings) => fetchAverages({ valuation }),
    ["watchlist:trends:league-averages"],
    PLAYERS_CACHE_OPTIONS,
  );
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
