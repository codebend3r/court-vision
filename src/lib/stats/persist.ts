import { Prisma } from "@generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { GameLogInput, PlayerInput, SeasonStatsInput } from "@/lib/stats/inputs";

export type SyncSummary = {
  players: number;
  seasonStats: number;
  gameLogs: number;
};

// A full-season sync writes tens of thousands of rows. Sending one upsert per
// row keeps a pooled Supabase connection busy for minutes, and the pooler
// eventually drops it ("Connection terminated unexpectedly"), failing the whole
// run with a partial write. Batching each chunk into a single transaction turns
// tens of thousands of round-trips into a few hundred, and retrying a dropped
// chunk (upserts are idempotent) makes the run resilient to transient drops.
const CHUNK_SIZE = 250;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 500;
// A chunk upserts row by row over the pooler (~25ms each), so a full batch runs
// well past Prisma's 5s default interactive-transaction timeout and trips P2028.
// Give each batch real headroom, and time to acquire a pooled connection.
const TRANSACTION_TIMEOUT_MS = 120_000;
const TRANSACTION_MAX_WAIT_MS = 30_000;

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

const chunk = <T>(rows: T[], size: number): T[][] =>
  rows.reduce<T[][]>((chunks, row, index) => {
    if (index % size === 0) {
      chunks.push([]);
    }
    chunks[chunks.length - 1].push(row);
    return chunks;
  }, []);

const upsertInChunks = async <T>({
  rows,
  toOperation,
}: {
  rows: T[];
  toOperation: (row: T) => Prisma.PrismaPromise<unknown>;
}): Promise<number> => {
  await chunk(rows, CHUNK_SIZE).reduce(async (previous, batch) => {
    await previous;
    await withRetry(() =>
      prisma.$transaction(batch.map(toOperation), {
        timeout: TRANSACTION_TIMEOUT_MS,
        maxWait: TRANSACTION_MAX_WAIT_MS,
      }),
    );
  }, Promise.resolve());
  return rows.length;
};

export async function upsertPlayers(players: PlayerInput[]): Promise<number> {
  return upsertInChunks({
    rows: players,
    toOperation: (player) => {
      const { id, ...rest } = player;
      return prisma.player.upsert({ where: { id }, create: player, update: rest });
    },
  });
}

export async function upsertSeasonStats(rows: SeasonStatsInput[]): Promise<number> {
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

export async function upsertGameLogs(rows: GameLogInput[]): Promise<number> {
  return upsertInChunks({
    rows,
    toOperation: (row) =>
      prisma.playerGameLog.upsert({
        where: { playerId_gameId: { playerId: row.playerId, gameId: row.gameId } },
        create: row,
        update: row,
      }),
  });
}
