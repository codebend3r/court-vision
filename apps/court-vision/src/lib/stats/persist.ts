import { Prisma } from "@generated/prisma/client";
import { sequentially } from "@vision/core/util/sequentially";

import { prisma } from "@/lib/prisma";

import {
  AdvancedGameLogInput,
  GameLogInput,
  PlayerInput,
  SeasonAggregateLog,
  SeasonStatsInput,
} from "@/lib/stats/inputs";

export type SyncSummary = {
  players: number;
  seasonStats: number;
  gameLogs: number;
  advancedGameLogs: number;
};

// A sync writes tens of thousands of rows. A per-row upsert is one round-trip
// to the pooler (~100ms), so upserting a full season of game logs one row at a
// time would take well over an hour and keep dropping the pooled connection.
// The bottleneck tables (game logs) are replaced with multi-row inserts instead,
// one round-trip per chunk; the small tables keep chunked upserts. Every write
// is retried on a transient connection drop.
const CHUNK_SIZE = 250;
// createMany sends a chunk as a single INSERT, so chunks can be far larger; keep
// the parameter count (rows * columns) comfortably under Postgres's 65535 cap.
const CREATE_CHUNK_SIZE = 1000;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 500;
// A batch still runs many statements over the pooler, so give it headroom past
// Prisma's 5s default interactive-transaction timeout (which otherwise trips
// P2028), plus time to acquire a pooled connection.
const TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 30_000 };

const isRetryableDbError = (error: unknown): boolean =>
  error instanceof Error &&
  /connection terminated|connection closed|closed the connection|econnreset|server has gone away|terminating connection/i.test(
    error.message,
  );

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(run: () => Promise<T>): Promise<T> => {
  const attempt = async (used: number): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (used >= MAX_RETRIES || !isRetryableDbError(error)) {
        throw error;
      }
      // Back off linearly so a briefly overloaded pooler has room to recover.
      await delay(RETRY_BASE_MS * (used + 1));
      return attempt(used + 1);
    }
  };
  return attempt(0);
};

const chunk = <T>({ rows, size }: { rows: readonly T[]; size: number }): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );

const upsertInChunks = async <T>({
  rows,
  toOperation,
}: {
  rows: readonly T[];
  toOperation: (row: T) => Prisma.PrismaPromise<unknown>;
}): Promise<number> => {
  await sequentially({
    items: chunk({ rows, size: CHUNK_SIZE }),
    run: ({ item: batch }) =>
      withRetry(() => prisma.$transaction(batch.map(toOperation), TRANSACTION_OPTIONS)),
  });
  return rows.length;
};

export async function upsertPlayers({ players }: { players: PlayerInput[] }): Promise<number> {
  return upsertInChunks({
    rows: players,
    toOperation: (player) => {
      const { id, ...rest } = player;
      return prisma.player.upsert({ where: { id }, create: player, update: rest });
    },
  });
}

// The active roster is a full replacement: the given players are on an NBA
// roster today and everyone else is not. An empty list is refused rather than
// applied, so a bad API response can never empty every team's roster at once.
// One statement, not a transaction of two updates: it writes only the rows
// whose flag changes (a handful a day, not every rostered player), so there is
// little to lock, nothing to time out over a remote pooler, and no second
// statement to deadlock against a concurrent writer. Returns how many players
// are now active.
export async function markActiveRoster({ playerIds }: { playerIds: number[] }): Promise<number> {
  if (playerIds.length === 0) {
    throw new Error("Refusing to apply an empty active roster.");
  }
  await withRetry(
    () => prisma.$executeRaw`
      UPDATE "Player"
      SET "isActive" = ("id" = ANY(${playerIds}))
      WHERE "isActive" <> ("id" = ANY(${playerIds}))
    `,
  );
  return prisma.player.count({ where: { isActive: true } });
}

export async function upsertSeasonStats({ rows }: { rows: SeasonStatsInput[] }): Promise<number> {
  return upsertInChunks({
    rows,
    toOperation: (row) =>
      prisma.playerSeasonStats.upsert({
        where: {
          playerId_season_seasonType: {
            playerId: row.playerId,
            season: row.season,
            seasonType: row.seasonType,
          },
        },
        create: row,
        update: row,
      }),
  });
}

// Replaces a slice of a log table wholesale. Log tables have no inbound foreign
// keys, so the slice the incoming rows cover can be deleted and re-inserted:
// multi-row createMany is one round-trip per chunk instead of one per row,
// cutting a season's write from ~90 minutes to seconds. The delete and inserts
// share a transaction so readers never see a partially-written slice.
const replaceRows = async <T>({
  rows,
  remove,
  insert,
}: {
  rows: readonly T[];
  remove: (tx: Prisma.TransactionClient) => Promise<unknown>;
  insert: (args: { tx: Prisma.TransactionClient; batch: T[] }) => Promise<unknown>;
}): Promise<number> => {
  if (rows.length === 0) {
    return 0;
  }
  await withRetry(() =>
    prisma.$transaction(async (tx) => {
      await remove(tx);
      await sequentially({
        items: chunk({ rows, size: CREATE_CHUNK_SIZE }),
        run: ({ item: batch }) => insert({ tx, batch }),
      });
    }, TRANSACTION_OPTIONS),
  );
  return rows.length;
};

type SeasonScope = { season: string; seasonType: string };

// The distinct (season, seasonType) pairs the incoming rows cover, in first-seen
// order, so the delete only clears what is about to be re-inserted.
const seasonScopes = (rows: readonly SeasonScope[]): SeasonScope[] => [
  ...new Map(
    rows.map(({ season, seasonType }) => [`${season}|${seasonType}`, { season, seasonType }]),
  ).values(),
];

// The distinct game ids the incoming rows cover.
const gameIdsOf = (rows: readonly { gameId: string }[]): string[] => [
  ...new Set(rows.map((row) => row.gameId)),
];

// The season sync (`sync:bdl`) and the demo seed own whole seasons: every log
// in the seasons the rows cover is replaced.
export async function replaceGameLogs({ rows }: { rows: GameLogInput[] }): Promise<number> {
  return replaceRows({
    rows,
    remove: (tx) => tx.playerGameLog.deleteMany({ where: { OR: seasonScopes(rows) } }),
    insert: ({ tx, batch }) => tx.playerGameLog.createMany({ data: batch }),
  });
}

export async function replaceAdvancedGameLogs({
  rows,
}: {
  rows: AdvancedGameLogInput[];
}): Promise<number> {
  return replaceRows({
    rows,
    remove: (tx) => tx.playerAdvancedGameLog.deleteMany({ where: { OR: seasonScopes(rows) } }),
    insert: ({ tx, batch }) => tx.playerAdvancedGameLog.createMany({ data: batch }),
  });
}

// The nightly sync owns whole games rather than whole seasons: it deletes every
// log for the games it fetched and re-inserts them, so a re-run (or a stat
// correction) replaces the night cleanly and leaves the rest of the season alone.
export async function replaceGameLogsForGames({ rows }: { rows: GameLogInput[] }): Promise<number> {
  return replaceRows({
    rows,
    remove: (tx) => tx.playerGameLog.deleteMany({ where: { gameId: { in: gameIdsOf(rows) } } }),
    insert: ({ tx, batch }) => tx.playerGameLog.createMany({ data: batch }),
  });
}

export async function replaceAdvancedGameLogsForGames({
  rows,
}: {
  rows: AdvancedGameLogInput[];
}): Promise<number> {
  return replaceRows({
    rows,
    remove: (tx) =>
      tx.playerAdvancedGameLog.deleteMany({ where: { gameId: { in: gameIdsOf(rows) } } }),
    insert: ({ tx, batch }) => tx.playerAdvancedGameLog.createMany({ data: batch }),
  });
}

// Every stored log for these players in these seasons, trimmed to the fields a
// season line sums, so the nightly sync can rebuild just their season rows.
export async function findSeasonAggregateLogs(args: {
  playerIds: number[];
  seasons: string[];
  seasonType: string;
}): Promise<SeasonAggregateLog[]> {
  const { playerIds, seasons, seasonType } = args;
  if (playerIds.length === 0 || seasons.length === 0) {
    return [];
  }
  return withRetry(() =>
    prisma.playerGameLog.findMany({
      where: { playerId: { in: playerIds }, season: { in: seasons }, seasonType },
      select: {
        playerId: true,
        season: true,
        seasonType: true,
        minutes: true,
        fgm: true,
        fga: true,
        fg3m: true,
        fg3a: true,
        ftm: true,
        fta: true,
        oreb: true,
        dreb: true,
        reb: true,
        ast: true,
        stl: true,
        blk: true,
        tov: true,
        pts: true,
      },
    }),
  );
}
