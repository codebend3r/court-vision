import { unstable_cache } from "next/cache";
import type { PlayerGameRange } from "@/lib/players/searchParams";
import { prisma } from "@/lib/prisma";
import { aggregateWindowLogs } from "@/lib/valuation/aggregate";
import type { FantasyStatLine } from "@/lib/valuation/types";

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

// A valuation pool must come from a single season; mixing each player's
// personal latest season would compare 2023 lines against 2025 lines.
const latestSeason = async (): Promise<string | null> => {
  const row = await prisma.playerSeasonStats.findFirst({
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" },
    select: { season: true },
  });
  return row?.season ?? null;
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

const fetchPool = async (range: PlayerGameRange): Promise<FantasyStatLine[]> => {
  const season = await latestSeason();
  if (season === null) return [];
  return fetchWindowLines({
    season,
    gameLimit: range === "all" ? null : Number.parseInt(range.replace("last", ""), 10),
  });
};

// Cache key is the range alone — user config (weights, league size) must
// never enter the key, or cardinality is unbounded (PRD §9.1). Same tag and
// revalidate window as the other players caches so one sync invalidation
// busts all three tabs.
const cachedPool = unstable_cache((range: PlayerGameRange) => fetchPool(range), ["fantasy:pool"], {
  revalidate: 300,
  tags: ["players"],
});

export const getFantasyPool = ({ range }: { range: PlayerGameRange }): Promise<FantasyStatLine[]> =>
  cachedPool(range);
