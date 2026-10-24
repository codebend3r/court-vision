import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { recordFromKeys } from "@vision/core/util/record";

import { playerRowSchema, splitPlayerRow, type PlayerIdentity } from "@/lib/players/identity";
import { rankRows, type Page } from "@/lib/players/rank";
import {
  ADVANCED_METRIC_KEYS,
  gamesForRange,
  isAdvancedMetricKey,
  type AdvancedMetricKey,
  type AdvancedSearchParams,
  type PlayerGameRange,
} from "@/lib/players/searchParams";
import { HAS_GAME_LOGS, CURRENT_SEASON_JOIN, PLAYER_IDENTITY_COLUMNS } from "@/lib/players/sql";

export type PlayerAdvancedStats = Record<AdvancedMetricKey, number | null> & {
  gamesWithData: number;
};

export type AdvancedPlayerRow = PlayerIdentity & { stats: PlayerAdvancedStats };

export type PlayersAdvancedSearchResult = Page<AdvancedPlayerRow>;

// A full season tops out at 82 regular-season games (postseason is excluded
// from the sync); 100 leaves comfortable margin without an unbounded fetch.
const ADVANCED_GAME_LOG_FETCH_LIMIT = 100;

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
  const recorded = (key: AdvancedMetricKey): number[] =>
    logs.map((log) => log[key]).filter((value): value is number => value !== null);
  return {
    ...recordFromKeys({ keys: ADVANCED_METRIC_KEYS, value: (key) => average(recorded(key)) }),
    gamesWithData:
      logs.length === 0 ? 0 : Math.max(...ADVANCED_METRIC_KEYS.map((key) => recorded(key).length)),
  };
};

const advancedPoolRowSchema = playerRowSchema.extend({
  gamesWithData: z.number(),
  ...recordFromKeys({ keys: ADVANCED_METRIC_KEYS, value: () => z.number().nullable() }),
});

// Per-player advanced averages for a range, aggregated in SQL. A lastN range
// averages the N most recent advanced logs; the season range averages the most
// recent 100 that fall in the player's current Regular Season (null when they
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
    SELECT ${PLAYER_IDENTITY_COLUMNS}, a.*
    FROM "Player" p
    ${CURRENT_SEASON_JOIN}
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
    WHERE ${HAS_GAME_LOGS}
  `;
  return z.array(advancedPoolRowSchema).parse(rows).map(splitPlayerRow);
};

// Filters, orders and pages an advanced pool in memory. Metric sorts sink
// players with no value for that metric to the bottom in either direction.
export const rankAdvancedPlayers = ({
  pool,
  args,
}: {
  pool: readonly AdvancedPlayerRow[];
  args: AdvancedSearchParams;
}): PlayersAdvancedSearchResult => {
  const { q, page, size, dir, sort } = args;
  return rankRows({
    rows: pool,
    nameOf: (row) => row,
    q,
    page,
    size,
    dir,
    order: isAdvancedMetricKey(sort)
      ? {
          by: "value",
          valueOf: ({ stats }) => ({ sink: stats[sort] === null, value: stats[sort] ?? 0 }),
        }
      : { by: "name", sort },
  });
};
