import { Prisma } from "@generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  ADVANCED_METRIC_KEYS,
  isAdvancedMetricKey,
  type AdvancedMetricKey,
  type PlayerGameRange,
  type PlayersSearchParams,
} from "@/lib/players/searchParams";

export type PlayerAdvancedStats = Record<AdvancedMetricKey, number | null> & {
  gamesWithData: number;
};

export type AdvancedPlayerRow = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  stats: PlayerAdvancedStats;
};

export type PlayersAdvancedSearchResult = {
  rows: AdvancedPlayerRow[];
  total: number;
  page: number;
};

type AdvancedGameLogRow = Record<AdvancedMetricKey, number | null> & {
  gameDate: Date;
  season: string;
};

type AdvancedPlayerCandidate = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  seasonStats: Array<{ season: string }>;
  advancedGameLogs: AdvancedGameLogRow[];
};

const advancedMetricSelect = {
  pie: true,
  pace: true,
  assistPercentage: true,
  assistRatio: true,
  assistToTurnover: true,
  defensiveRating: true,
  defensiveReboundPercentage: true,
  effectiveFieldGoalPercentage: true,
  netRating: true,
  offensiveRating: true,
  offensiveReboundPercentage: true,
  reboundPercentage: true,
  trueShootingPercentage: true,
  turnoverRatio: true,
  usagePercentage: true,
};

// A full season tops out at 82 regular-season games (postseason is excluded
// from the sync); 100 leaves comfortable margin without an unbounded fetch.
const ADVANCED_GAME_LOG_FETCH_LIMIT = 100;

const advancedRowSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  teamAbbr: true,
  position: true,
  nbaPersonId: true,
  seasonStats: {
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" as const },
    take: 1,
    select: { season: true },
  },
  advancedGameLogs: {
    orderBy: { gameDate: "desc" as const },
    take: ADVANCED_GAME_LOG_FETCH_LIMIT,
    select: {
      gameDate: true,
      season: true,
      ...advancedMetricSelect,
    },
  },
};

const emptyAdvancedStats = (): PlayerAdvancedStats => ({
  pie: null,
  pace: null,
  assistPercentage: null,
  assistRatio: null,
  assistToTurnover: null,
  defensiveRating: null,
  defensiveReboundPercentage: null,
  effectiveFieldGoalPercentage: null,
  netRating: null,
  offensiveRating: null,
  offensiveReboundPercentage: null,
  reboundPercentage: null,
  trueShootingPercentage: null,
  turnoverRatio: null,
  usagePercentage: null,
  gamesWithData: 0,
});

const average = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

const gameCountFor = (range: PlayerGameRange): number | null =>
  range === "all" ? null : Number.parseInt(range.replace("last", ""), 10);

const toAdvancedStats = ({ logs }: { logs: readonly AdvancedGameLogRow[] }): PlayerAdvancedStats =>
  ADVANCED_METRIC_KEYS.reduce<PlayerAdvancedStats>(
    (stats, key) => ({
      ...stats,
      [key]: average(
        logs.map((log) => log[key]).filter((value): value is number => value !== null),
      ),
    }),
    { ...emptyAdvancedStats(), gamesWithData: logs.length },
  );

const toAdvancedPlayerRow = ({
  row,
  range,
}: {
  row: AdvancedPlayerCandidate;
  range: PlayerGameRange;
}): AdvancedPlayerRow => {
  const limit = gameCountFor(range);
  const latestSeason = row.seasonStats[0]?.season ?? null;
  const scoped =
    limit === null
      ? row.advancedGameLogs.filter((log) => log.season === latestSeason)
      : row.advancedGameLogs.slice(0, limit);
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    teamAbbr: row.teamAbbr,
    position: row.position,
    nbaPersonId: row.nbaPersonId,
    stats: toAdvancedStats({ logs: scoped }),
  };
};

export const searchPlayersAdvanced = async (
  args: PlayersSearchParams,
): Promise<PlayersAdvancedSearchResult> => {
  const { q, page, size, sort, dir, range } = args;
  const where: Prisma.PlayerWhereInput = {
    gameLogs: { some: {} },
    ...(q === "" ? {} : { fullName: { contains: q, mode: "insensitive" } }),
  };
  const orderBy: Prisma.PlayerOrderByWithRelationInput[] =
    sort === "lastName"
      ? [{ lastName: dir }, { firstName: dir }, { id: "asc" }]
      : [{ firstName: dir }, { lastName: dir }, { id: "asc" }];

  if (isAdvancedMetricKey(sort)) {
    const candidates = await prisma.player.findMany({ where, select: advancedRowSelect });
    const sortedRows = candidates
      .map((row) => toAdvancedPlayerRow({ row, range }))
      .sort((a, b) => {
        const aValue = a.stats[sort];
        const bValue = b.stats[sort];
        const aIsNull = aValue === null ? 1 : 0;
        const bIsNull = bValue === null ? 1 : 0;
        if (aIsNull !== bIsNull) return aIsNull - bIsNull;
        const difference = (aValue ?? 0) - (bValue ?? 0);
        if (difference !== 0) return dir === "asc" ? difference : -difference;
        return (
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.id - b.id
        );
      });
    const total = sortedRows.length;
    const lastPage = Math.max(1, Math.ceil(total / size));
    const clampedPage = Math.min(page, lastPage);
    return {
      rows: sortedRows.slice((clampedPage - 1) * size, clampedPage * size),
      total,
      page: total === 0 ? 1 : clampedPage,
    };
  }

  const pageQuery = (pageNumber: number) =>
    prisma.player.findMany({
      where,
      select: advancedRowSelect,
      orderBy,
      skip: (pageNumber - 1) * size,
      take: size,
    });

  const [rows, total] = await prisma.$transaction([
    pageQuery(page),
    prisma.player.count({ where }),
  ]);
  if (rows.length > 0 || total === 0) {
    return {
      rows: rows.map((row) => toAdvancedPlayerRow({ row, range })),
      total,
      page: total === 0 ? 1 : page,
    };
  }
  const lastPage = Math.max(1, Math.ceil(total / size));
  const clamped = await pageQuery(lastPage);
  return {
    rows: clamped.map((row) => toAdvancedPlayerRow({ row, range })),
    total,
    page: lastPage,
  };
};
