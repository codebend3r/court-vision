"use server";

import { unstable_cache } from "next/cache";

import { isActionArray, isActionInt } from "@/lib/actions/argGuards";
import { prisma } from "@/lib/prisma";
import { latestSeason } from "@/lib/valuation/season";
import {
  MAX_TREND_PLAYERS,
  type FantasyTrendLog,
  type FantasyTrendLogsResult,
} from "@/lib/valuation/trendLogs";

const logSelect = {
  playerId: true,
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

const isPlayerId = (value: unknown): value is number => isActionInt(value) && value > 0;

type PlayerTrendLog = FantasyTrendLog & { playerId: number };

const fetchLogs = async ({
  season,
  playerIds,
}: {
  season: string;
  playerIds: readonly number[];
}): Promise<PlayerTrendLog[]> => {
  const rows = await prisma.playerGameLog.findMany({
    where: { playerId: { in: [...playerIds] }, season, seasonType: "Regular Season" },
    orderBy: { gameDate: "asc" },
    select: logSelect,
  });
  return rows.map(({ gameDate, ...rest }) => ({ ...rest, gameDate: gameDate.toISOString() }));
};

// Keyed by the season and the page's ids (sorted, so the key is the same
// however the page is ordered). The first page under the default sort is
// what most visitors open, and that one entry answers all of them. Same tag
// and revalidate window as the other players caches, so one sync
// invalidation busts every surface.
const cachedLogs = unstable_cache(
  (season: string, idsKey: string) =>
    fetchLogs({ season, playerIds: idsKey.split(",").map(Number) }),
  ["fantasy:trend-logs"],
  { revalidate: 300, tags: ["players"] },
);

const idsKeyOf = ({ playerIds }: { playerIds: readonly number[] }): string =>
  [...playerIds].sort((a, b) => a - b).join(",");

// Intentionally public: the Players Fantasy tab works signed out. This action
// only reads NBA box scores, never account data or writes. Its security-scan
// exception must be re-reviewed if this module gains other exports or queries.
// The season's game logs for one page of the Fantasy tab, so the client can
// draw each player's rolling value against the pool it already holds. Only
// the box-score fields travel: the rolling scorers need nothing else, and a
// page of a hundred players is thousands of rows.
export const loadFantasyTrendLogs = async ({
  playerIds,
}: {
  playerIds: readonly number[];
}): Promise<FantasyTrendLogsResult> => {
  if (
    !isActionArray(playerIds) ||
    playerIds.length > MAX_TREND_PLAYERS ||
    !playerIds.every(isPlayerId)
  ) {
    return { status: "error" };
  }
  try {
    const season = await latestSeason();
    const rows =
      season === null || playerIds.length === 0
        ? []
        : await cachedLogs(season, idsKeyOf({ playerIds }));
    const players = playerIds.map((playerId) => ({
      playerId,
      logs: rows
        .filter((row) => row.playerId === playerId)
        .map(({ playerId: _playerId, ...log }): FantasyTrendLog => log),
    }));
    return { status: "ok", players };
  } catch {
    return { status: "error" };
  }
};
