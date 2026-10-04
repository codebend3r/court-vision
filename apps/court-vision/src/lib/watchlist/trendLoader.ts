import { unstable_cache } from "next/cache";

import { type TrendSeries } from "@vision/core/valuation/rolling";
import { poolSizeFor } from "@vision/core/valuation/valuePlayers";
import { basketball } from "@vision/sport-basketball/descriptor";
import {
  buildRollingGSeries,
  buildRollingZSeries,
  computePoolStats,
  DEFAULT_VALUATION_CONFIG,
} from "@vision/sport-basketball/engine";

import { prisma } from "@/lib/prisma";
import { getFantasyPool } from "@/lib/valuation/loader";
import { latestSeason } from "@/lib/valuation/season";
import { toWindowLog } from "@/lib/valuation/trendLogs";

const logSelect = {
  gameDate: true,
  minutes: true,
  pts: true,
  reb: true,
  ast: true,
  stl: true,
  blk: true,
  fg3m: true,
  tov: true,
  fgm: true,
  fga: true,
  ftm: true,
  fta: true,
};

const buildersByMethod = {
  z: buildRollingZSeries,
  g: buildRollingGSeries,
} as const;

type TrendMethod = keyof typeof buildersByMethod;

const fetchSeries = async ({
  playerId,
  fullName,
  method,
}: {
  playerId: number;
  fullName: string;
  method: TrendMethod;
}): Promise<TrendSeries> => {
  const season = await latestSeason();
  if (season === null) {
    return { playerId, fullName, points: [] };
  }
  // The yardstick is the whole season's pool, held fixed across every window.
  const lines = await getFantasyPool({ range: "all" });
  const poolStats = computePoolStats({
    lines,
    basis: DEFAULT_VALUATION_CONFIG.basis,
    poolSize: poolSizeFor({ pool: basketball.pools[0], config: DEFAULT_VALUATION_CONFIG }),
    windowGames: null,
  });
  const rows = await prisma.playerGameLog.findMany({
    where: { playerId, season, seasonType: "Regular Season" },
    orderBy: { gameDate: "asc" },
    select: logSelect,
  });
  const logs = rows.map(({ gameDate, ...row }) => ({ ...toWindowLog({ row }), gameDate }));
  return buildersByMethod[method]({
    playerId,
    fullName,
    logs,
    poolStats,
    config: DEFAULT_VALUATION_CONFIG,
  });
};

// Cached per player rather than per watchlist: two users watching the same star
// share one entry. Same tag and revalidate window as the other players caches,
// so one sync invalidation busts every surface.
const cachedZSeries = unstable_cache(
  (playerId: number, fullName: string) => fetchSeries({ playerId, fullName, method: "z" }),
  ["watchlist:z-trend"],
  { revalidate: 300, tags: ["players"] },
);

const cachedGSeries = unstable_cache(
  (playerId: number, fullName: string) => fetchSeries({ playerId, fullName, method: "g" }),
  ["watchlist:g-trend"],
  { revalidate: 300, tags: ["players"] },
);

export const getZTrendSeries = ({
  players,
}: {
  players: readonly { playerId: number; fullName: string }[];
}): Promise<TrendSeries[]> =>
  Promise.all(players.map((player) => cachedZSeries(player.playerId, player.fullName)));

export const getGTrendSeries = ({
  players,
}: {
  players: readonly { playerId: number; fullName: string }[];
}): Promise<TrendSeries[]> =>
  Promise.all(players.map((player) => cachedGSeries(player.playerId, player.fullName)));
