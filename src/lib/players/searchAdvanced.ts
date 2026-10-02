import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { compareByName, compareByNameAscending, matchesQuery, pageOf } from "@/lib/players/search";
import {
  ADVANCED_METRIC_KEYS,
  gamesForRange,
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

// A full season tops out at 82 regular-season games (postseason is excluded
// from the sync); 100 leaves comfortable margin without an unbounded fetch.
const ADVANCED_GAME_LOG_FETCH_LIMIT = 100;

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

// One window of a player's advanced rows collapsed to per-metric means. Each
// metric averages only the games that recorded it (Balldontlie leaves a metric
// null when the player logged no minutes), and gamesWithData is the widest
// such set. Shared by the player page's advanced card; the Advanced tab runs
// the same reduction in SQL (fetchAdvancedPool).
export const averageAdvancedLogs = ({
  logs,
}: {
  logs: readonly Record<AdvancedMetricKey, number | null>[];
}): PlayerAdvancedStats => {
  const gamesWithData =
    logs.length === 0
      ? 0
      : Math.max(
          ...ADVANCED_METRIC_KEYS.map((key) => logs.filter((log) => log[key] !== null).length),
        );
  return ADVANCED_METRIC_KEYS.reduce<PlayerAdvancedStats>(
    (stats, key) => ({
      ...stats,
      [key]: average(
        logs.map((log) => log[key]).filter((value): value is number => value !== null),
      ),
    }),
    { ...emptyAdvancedStats(), gamesWithData },
  );
};

const advancedPoolRowSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  teamAbbr: z.string().nullable(),
  position: z.string().nullable(),
  nbaPersonId: z.number().nullable(),
  gamesWithData: z.number(),
  pie: z.number().nullable(),
  pace: z.number().nullable(),
  assistPercentage: z.number().nullable(),
  assistRatio: z.number().nullable(),
  assistToTurnover: z.number().nullable(),
  defensiveRating: z.number().nullable(),
  defensiveReboundPercentage: z.number().nullable(),
  effectiveFieldGoalPercentage: z.number().nullable(),
  netRating: z.number().nullable(),
  offensiveRating: z.number().nullable(),
  offensiveReboundPercentage: z.number().nullable(),
  reboundPercentage: z.number().nullable(),
  trueShootingPercentage: z.number().nullable(),
  turnoverRatio: z.number().nullable(),
  usagePercentage: z.number().nullable(),
});

const toAdvancedPlayerRow = ({
  id,
  firstName,
  lastName,
  fullName,
  teamAbbr,
  position,
  nbaPersonId,
  ...stats
}: z.infer<typeof advancedPoolRowSchema>): AdvancedPlayerRow => ({
  id,
  firstName,
  lastName,
  fullName,
  teamAbbr,
  position,
  nbaPersonId,
  stats,
});

// Per-player advanced averages for a range, aggregated in SQL. A lastN range
// averages the N most recent advanced logs; the season range averages the most
// recent 100 that fall in the player's latest Regular Season (null when they
// have none, which matches no rows). AVG skips nulls, so each metric averages
// only the games that recorded it, and gamesWithData is the widest such count,
// exactly as averageAdvancedLogs does in memory. The per-player LIMIT reads the
// (playerId, gameDate) index instead of the whole 300k-row table.
export const fetchAdvancedPool = async ({
  range,
}: {
  range: PlayerGameRange;
}): Promise<AdvancedPlayerRow[]> => {
  const gameLimit = gamesForRange({ range }) ?? ADVANCED_GAME_LOG_FETCH_LIMIT;
  const scopeToLatestSeason = range === "all";
  const rows: unknown = await prisma.$queryRaw`
    SELECT p.id, p."firstName", p."lastName", p."fullName", p."teamAbbr", p.position,
           p."nbaPersonId", a.*
    FROM "Player" p
    LEFT JOIN LATERAL (
      SELECT ss.season FROM "PlayerSeasonStats" ss
      WHERE ss."playerId" = p.id AND ss."seasonType" = 'Regular Season'
      ORDER BY ss.season DESC
      LIMIT 1
    ) s ON true
    CROSS JOIN LATERAL (
      SELECT GREATEST(
               count(l.pie), count(l.pace), count(l."assistPercentage"), count(l."assistRatio"),
               count(l."assistToTurnover"), count(l."defensiveRating"),
               count(l."defensiveReboundPercentage"), count(l."effectiveFieldGoalPercentage"),
               count(l."netRating"), count(l."offensiveRating"),
               count(l."offensiveReboundPercentage"), count(l."reboundPercentage"),
               count(l."trueShootingPercentage"), count(l."turnoverRatio"),
               count(l."usagePercentage")
             )::int AS "gamesWithData",
             avg(l.pie) AS pie, avg(l.pace) AS pace,
             avg(l."assistPercentage") AS "assistPercentage",
             avg(l."assistRatio") AS "assistRatio",
             avg(l."assistToTurnover") AS "assistToTurnover",
             avg(l."defensiveRating") AS "defensiveRating",
             avg(l."defensiveReboundPercentage") AS "defensiveReboundPercentage",
             avg(l."effectiveFieldGoalPercentage") AS "effectiveFieldGoalPercentage",
             avg(l."netRating") AS "netRating",
             avg(l."offensiveRating") AS "offensiveRating",
             avg(l."offensiveReboundPercentage") AS "offensiveReboundPercentage",
             avg(l."reboundPercentage") AS "reboundPercentage",
             avg(l."trueShootingPercentage") AS "trueShootingPercentage",
             avg(l."turnoverRatio") AS "turnoverRatio",
             avg(l."usagePercentage") AS "usagePercentage"
      FROM (
        SELECT al.* FROM "PlayerAdvancedGameLog" al
        WHERE al."playerId" = p.id
        ORDER BY al."gameDate" DESC
        LIMIT ${gameLimit}
      ) l
      WHERE NOT ${scopeToLatestSeason} OR l.season = s.season
    ) a
    WHERE EXISTS (SELECT 1 FROM "PlayerGameLog" g WHERE g."playerId" = p.id)
  `;
  return z.array(advancedPoolRowSchema).parse(rows).map(toAdvancedPlayerRow);
};

// Filters, orders and pages an advanced pool in memory. Metric sorts sink
// players with no value for that metric to the bottom in either direction.
export const rankAdvancedPlayers = ({
  pool,
  args,
}: {
  pool: readonly AdvancedPlayerRow[];
  args: PlayersSearchParams;
}): PlayersAdvancedSearchResult => {
  const { q, page, size, sort, dir } = args;
  const candidates = pool.filter((row) => matchesQuery({ fullName: row.fullName, q }));
  if (!isAdvancedMetricKey(sort)) {
    const nameSort = sort === "lastName" ? "lastName" : "firstName";
    const ordered = candidates.toSorted((a, b) => compareByName({ a, b, sort: nameSort, dir }));
    return pageOf({ rows: ordered, page, size });
  }
  const ordered = candidates.toSorted((a, b) => {
    const aValue = a.stats[sort];
    const bValue = b.stats[sort];
    const aIsNull = aValue === null ? 1 : 0;
    const bIsNull = bValue === null ? 1 : 0;
    if (aIsNull !== bIsNull) return aIsNull - bIsNull;
    const difference = (aValue ?? 0) - (bValue ?? 0);
    if (difference !== 0) return dir === "asc" ? difference : -difference;
    return compareByNameAscending({ a, b });
  });
  return pageOf({ rows: ordered, page, size });
};

export const searchPlayersAdvanced = async (
  args: PlayersSearchParams,
): Promise<PlayersAdvancedSearchResult> =>
  rankAdvancedPlayers({ pool: await fetchAdvancedPool({ range: args.range }), args });
