import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { gamesForRange, type PlayerGameRange } from "@/lib/players/searchParams";
import { aggregateWindowLogs } from "@/lib/valuation/aggregate";
import { latestSeason } from "@/lib/valuation/season";
import { type FantasyStatLine } from "@/lib/valuation/types";

const identitySelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  teamAbbr: true,
  position: true,
  nbaPersonId: true,
};

const statSelect = {
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

// All ranges go through game logs (season aggregates lack the second moments
// G-Score's variance term needs). gameLimit null = the whole season.
const fetchWindowLines = async ({
  season,
  gameLimit,
}: {
  season: string;
  gameLimit: number | null;
}): Promise<FantasyStatLine[]> => {
  const rows = await prisma.player.findMany({
    where: { gameLogs: { some: { season, seasonType: "Regular Season" } } },
    select: {
      ...identitySelect,
      gameLogs: {
        where: { season, seasonType: "Regular Season" },
        orderBy: { gameDate: "desc" },
        ...(gameLimit === null ? {} : { take: gameLimit }),
        select: statSelect,
      },
    },
  });
  return rows
    .map(({ gameLogs, ...player }) => ({
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      fullName: player.fullName,
      teamAbbr: player.teamAbbr,
      position: player.position,
      nbaPersonId: player.nbaPersonId,
      ...aggregateWindowLogs({ logs: gameLogs }),
    }))
    .filter((line) => line.gamesPlayed > 0);
};

const fetchPool = async ({
  range,
  season: requestedSeason,
}: {
  range: PlayerGameRange;
  season: string | null;
}): Promise<FantasyStatLine[]> => {
  const season = requestedSeason ?? (await latestSeason());
  if (season === null) return [];
  return fetchWindowLines({ season, gameLimit: gamesForRange({ range }) });
};

// Cache key is the range and the season alone — user config (weights, league
// size) must never enter the key, or cardinality is unbounded (PRD §9.1); the
// season is bounded by the backfill window. Same tag and revalidate window as
// the other players caches so one sync invalidation busts every surface.
const cachedPool = unstable_cache(
  (range: PlayerGameRange, season: string | null) => fetchPool({ range, season }),
  ["fantasy:pool"],
  { revalidate: 300, tags: ["players"] },
);

// The Fantasy tab and the home/team surfaces value the latest season; the
// player page passes the season its dropdown selected so a past season is
// measured against its own pool.
export const getFantasyPool = ({
  range,
  season = null,
}: {
  range: PlayerGameRange;
  season?: string | null;
}): Promise<FantasyStatLine[]> => cachedPool(range, season);
