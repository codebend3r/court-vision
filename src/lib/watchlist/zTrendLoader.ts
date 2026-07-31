import { unstable_cache } from "next/cache";

import { TEAM_BUILDER_VALUATION_CONFIG } from "@/lib/fantasyTeams/insights";
import { prisma } from "@/lib/prisma";
import { getFantasyPool } from "@/lib/valuation/loader";
import { computePoolStats } from "@/lib/valuation/pool";
import { buildRollingZSeries, type ZTrendSeries } from "@/lib/watchlist/zTrend";

// Mirrors POOL_FLOOR in lib/valuation/index.ts and lib/fantasyTeams/insights.ts:
// small leagues still standardize against a broad pool so values stay stable
// (PRD §5.1).
const POOL_FLOOR = 150;

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

const latestSeason = async (): Promise<string | null> => {
  const row = await prisma.playerSeasonStats.findFirst({
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" },
    select: { season: true },
  });
  return row?.season ?? null;
};

const fetchSeries = async ({
  playerId,
  fullName,
}: {
  playerId: number;
  fullName: string;
}): Promise<ZTrendSeries> => {
  const season = await latestSeason();
  if (season === null) {
    return { playerId, fullName, points: [] };
  }
  // The yardstick is the whole season's pool, held fixed across every window.
  const lines = await getFantasyPool({ range: "all" });
  const poolStats = computePoolStats({
    lines,
    basis: TEAM_BUILDER_VALUATION_CONFIG.basis,
    poolSize: Math.max(
      POOL_FLOOR,
      TEAM_BUILDER_VALUATION_CONFIG.teams * TEAM_BUILDER_VALUATION_CONFIG.rosterSlots,
    ),
    range: "all",
  });
  const logs = await prisma.playerGameLog.findMany({
    where: { playerId, season, seasonType: "Regular Season" },
    orderBy: { gameDate: "asc" },
    select: logSelect,
  });
  return buildRollingZSeries({
    playerId,
    fullName,
    logs,
    poolStats,
    config: TEAM_BUILDER_VALUATION_CONFIG,
  });
};

// Cached per player rather than per watchlist: two users watching the same star
// share one entry. Same tag and revalidate window as the other players caches,
// so one sync invalidation busts every surface.
const cachedSeries = unstable_cache(
  (playerId: number, fullName: string) => fetchSeries({ playerId, fullName }),
  ["watchlist:z-trend"],
  { revalidate: 300, tags: ["players"] },
);

export const getZTrendSeries = ({
  players,
}: {
  players: readonly { playerId: number; fullName: string }[];
}): Promise<ZTrendSeries[]> =>
  Promise.all(players.map((player) => cachedSeries(player.playerId, player.fullName)));
