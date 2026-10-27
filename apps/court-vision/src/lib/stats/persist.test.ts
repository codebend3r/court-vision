import { beforeEach, describe, expect, it, vi } from "bun:test";

import {
  AdvancedGameLogInput,
  GameLogInput,
  PlayerInput,
  SeasonStatsInput,
} from "@/lib/stats/inputs";
import {
  findSeasonAggregateLogs,
  markActiveRoster,
  replaceAdvancedGameLogs,
  replaceAdvancedGameLogsForGames,
  replaceGameLogs,
  replaceGameLogsForGames,
  upsertPlayers,
  upsertSeasonStats,
  withStatsTransaction,
} from "@/lib/stats/persist";

// Held as a module-scope const rather than built inside the factory: bun:test
// does not hoist `vi.mock`, so the assertions below reach the mock through this
// binding instead of re-importing `@/lib/prisma`.
const client = {
  player: {
    upsert: vi.fn(),
    updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
    count: vi.fn(() => Promise.resolve(0)),
  },
  $executeRaw: vi.fn((_strings: readonly string[], ..._values: unknown[]) => Promise.resolve(0)),
  playerSeasonStats: { upsert: vi.fn() },
  playerGameLog: {
    deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    findMany: vi.fn(() => Promise.resolve([])),
  },
  playerAdvancedGameLog: {
    deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    createMany: vi.fn(() => Promise.resolve({ count: 0 })),
  },
  // Support both transaction forms: the array form (batched upserts) resolves
  // with the results of the operations it was handed, and the interactive
  // callback form runs against this same mock client.
  $transaction: vi.fn((arg: ((tx: unknown) => Promise<unknown>) | unknown[]) =>
    typeof arg === "function" ? arg(client) : Promise.all(arg),
  ),
};

vi.mock("@/lib/prisma", () => ({ prisma: client }));

const player: PlayerInput = {
  id: 1629029,
  firstName: "Luka",
  lastName: "Doncic",
  fullName: "Luka Doncic",
  teamId: 1610612747,
  teamAbbr: "LAL",
  position: "G-F",
  jerseyNumber: "77",
};

const baseGameLog: GameLogInput = {
  playerId: 201939,
  gameId: "base",
  gameDate: new Date("2025-10-22T00:00:00Z"),
  season: "2025-26",
  seasonType: "Regular Season",
  teamId: 1610612744,
  teamAbbr: "GSW",
  matchup: "GSW vs. LAL",
  opponentAbbr: "LAL",
  homeAway: "home",
  winLoss: "W",
  teamScore: 112,
  opponentScore: 108,
  minutes: 34,
  fgm: 10,
  fga: 20,
  fg3m: 5,
  fg3a: 11,
  ftm: 4,
  fta: 4,
  oreb: 1,
  dreb: 4,
  reb: 5,
  ast: 8,
  stl: 2,
  blk: 0,
  tov: 3,
  pts: 29,
  plusMinus: 12,
};

const baseAdvancedLog: AdvancedGameLogInput = {
  playerId: 201939,
  gameId: "base",
  gameDate: new Date("2020-12-22T00:00:00Z"),
  season: "2020-21",
  seasonType: "Regular Season",
  teamId: 1610612744,
  teamAbbr: "GSW",
  pie: 0.152,
  pace: 98.4,
  assistPercentage: 21.3,
  assistRatio: 18.9,
  assistToTurnover: 2.1,
  defensiveRating: 108.2,
  defensiveReboundPercentage: 14.5,
  effectiveFieldGoalPercentage: 0.556,
  netRating: 6.4,
  offensiveRating: 114.6,
  offensiveReboundPercentage: 3.1,
  reboundPercentage: 8.8,
  trueShootingPercentage: 0.612,
  turnoverRatio: 9.2,
  usagePercentage: 28.7,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertPlayers", () => {
  it("upserts each player keyed by id and returns the count", async () => {
    const count = await upsertPlayers({ players: [player] });
    expect(count).toBe(1);
    expect(client.player.upsert).toHaveBeenCalledWith({
      where: { id: 1629029 },
      create: player,
      update: {
        firstName: "Luka",
        lastName: "Doncic",
        fullName: "Luka Doncic",
        teamId: 1610612747,
        teamAbbr: "LAL",
        position: "G-F",
        jerseyNumber: "77",
      },
    });
  });

  it("is idempotent — re-running uses upsert, never create", async () => {
    await upsertPlayers({ players: [player] });
    await upsertPlayers({ players: [player] });
    expect(client.player.upsert).toHaveBeenCalledTimes(2);
  });

  it("commits chunked upserts with a timeout past Prisma's 5s default", async () => {
    const players = Array.from({ length: 501 }, (_, index) => ({ ...player, id: index }));

    const count = await upsertPlayers({ players });

    expect(count).toBe(501);
    expect(client.player.upsert).toHaveBeenCalledTimes(501);
    // 501 rows chunk into transactions of 250, 250, and 1.
    expect(client.$transaction).toHaveBeenCalledTimes(3);
    // Each batch must carry a timeout well above Prisma's 5s default, or a full
    // chunk of row-by-row upserts trips P2028 mid-sync.
    expect(client.$transaction).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });
});

describe("markActiveRoster", () => {
  it("flags the given players active and everyone else not, in one statement", async () => {
    client.$executeRaw.mockClear();
    client.player.count.mockResolvedValueOnce(3);

    const count = await markActiveRoster({ playerIds: [1, 2, 3] });

    expect(count).toBe(3);
    expect(client.$executeRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = client.$executeRaw.mock.calls[0] ?? [[]];
    expect(strings.join("?")).toContain(`SET "isActive" = ("id" = ANY(?))`);
    expect(values).toEqual([
      [1, 2, 3],
      [1, 2, 3],
    ]);
  });

  it("writes only the rows whose flag changes, and opens no transaction", async () => {
    client.$executeRaw.mockClear();
    client.$transaction.mockClear();

    await markActiveRoster({ playerIds: [1, 2, 3] });

    const [strings = []] = client.$executeRaw.mock.calls[0] ?? [];
    expect(strings.join("?")).toContain(`WHERE "isActive" <> ("id" = ANY(?))`);
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("counts the active players after the update", async () => {
    client.player.count.mockClear();
    await markActiveRoster({ playerIds: [1] });
    expect(client.player.count).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  it("refuses an empty active list instead of emptying every roster", async () => {
    client.$executeRaw.mockClear();
    await expect(markActiveRoster({ playerIds: [] })).rejects.toThrow(/empty active roster/);
    expect(client.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("upsertSeasonStats", () => {
  it("upserts on the composite unique key", async () => {
    const stats: SeasonStatsInput = {
      playerId: 201939,
      season: "2025-26",
      seasonType: "Regular Season",
      gamesPlayed: 70,
      minutes: 2400,
      fgm: 600,
      fga: 1200,
      fg3m: 300,
      fg3a: 700,
      ftm: 200,
      fta: 220,
      oreb: 50,
      dreb: 300,
      reb: 350,
      ast: 450,
      stl: 90,
      blk: 20,
      tov: 200,
      pts: 1700,
    };
    const count = await upsertSeasonStats({ rows: [stats] });
    expect(count).toBe(1);
    expect(client.playerSeasonStats.upsert).toHaveBeenCalledWith({
      where: {
        playerId_season_seasonType: {
          playerId: 201939,
          season: "2025-26",
          seasonType: "Regular Season",
        },
      },
      create: stats,
      update: stats,
    });
  });
});

describe("replaceGameLogs", () => {
  it("replaces a season's logs with chunked inserts in one transaction", async () => {
    const logs = Array.from({ length: 1500 }, (_, index) => ({
      ...baseGameLog,
      gameId: `game-${index}`,
      playerId: index,
    }));

    const count = await replaceGameLogs({ rows: logs });

    expect(count).toBe(1500);
    // The whole season-replace runs inside a single interactive transaction.
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    // It clears exactly the (season, seasonType) it is about to re-insert.
    expect(client.playerGameLog.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ season: "2025-26", seasonType: "Regular Season" }] },
    });
    // 1500 rows insert as multi-row batches of 1000 and 500.
    expect(client.playerGameLog.createMany).toHaveBeenCalledTimes(2);
  });

  it("clears each season the rows cover once, in first-seen order", async () => {
    await replaceGameLogs({
      rows: [
        { ...baseGameLog, gameId: "a", season: "2020-21" },
        { ...baseGameLog, gameId: "b", season: "2025-26" },
        { ...baseGameLog, gameId: "c", season: "2020-21" },
      ],
    });

    expect(client.playerGameLog.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { season: "2020-21", seasonType: "Regular Season" },
          { season: "2025-26", seasonType: "Regular Season" },
        ],
      },
    });
  });

  it("does no work when there are no rows", async () => {
    const count = await replaceGameLogs({ rows: [] });
    expect(count).toBe(0);
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.playerGameLog.deleteMany).not.toHaveBeenCalled();
  });
});

describe("replaceAdvancedGameLogs", () => {
  it("replaces a season's advanced logs with chunked inserts in one transaction", async () => {
    const logs = Array.from({ length: 1500 }, (_, index) => ({
      ...baseAdvancedLog,
      gameId: `game-${index}`,
      playerId: index,
    }));

    const count = await replaceAdvancedGameLogs({ rows: logs });

    expect(count).toBe(1500);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.playerAdvancedGameLog.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ season: "2020-21", seasonType: "Regular Season" }] },
    });
    expect(client.playerAdvancedGameLog.createMany).toHaveBeenCalledTimes(2);
  });

  it("does no work when there are no rows", async () => {
    const count = await replaceAdvancedGameLogs({ rows: [] });
    expect(count).toBe(0);
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});

describe("replaceGameLogsForGames", () => {
  it("replaces only the fetched games' logs in one transaction", async () => {
    const logs = [
      { ...baseGameLog, gameId: "g1", playerId: 1 },
      { ...baseGameLog, gameId: "g1", playerId: 2 },
      { ...baseGameLog, gameId: "g2", playerId: 3 },
    ];

    const count = await replaceGameLogsForGames({ rows: logs });

    expect(count).toBe(3);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.playerGameLog.deleteMany).toHaveBeenCalledWith({
      where: { gameId: { in: ["g1", "g2"] } },
    });
    expect(client.playerGameLog.createMany).toHaveBeenCalledWith({ data: logs });
  });

  it("does no work when there are no rows", async () => {
    const count = await replaceGameLogsForGames({ rows: [] });
    expect(count).toBe(0);
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});

describe("replaceAdvancedGameLogsForGames", () => {
  it("replaces only the fetched games' advanced logs in one transaction", async () => {
    const logs = [
      { ...baseAdvancedLog, gameId: "g1", playerId: 1 },
      { ...baseAdvancedLog, gameId: "g2", playerId: 2 },
    ];

    const count = await replaceAdvancedGameLogsForGames({ rows: logs });

    expect(count).toBe(2);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.playerAdvancedGameLog.deleteMany).toHaveBeenCalledWith({
      where: { gameId: { in: ["g1", "g2"] } },
    });
    expect(client.playerAdvancedGameLog.createMany).toHaveBeenCalledWith({ data: logs });
  });

  it("does no work when there are no rows", async () => {
    const count = await replaceAdvancedGameLogsForGames({ rows: [] });
    expect(count).toBe(0);
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});

describe("findSeasonAggregateLogs", () => {
  it("reads the listed players' logs for the listed seasons", async () => {
    await findSeasonAggregateLogs({
      playerIds: [1, 2],
      seasons: ["2026-27"],
      seasonType: "Regular Season",
    });

    expect(client.playerGameLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          playerId: { in: [1, 2] },
          season: { in: ["2026-27"] },
          seasonType: "Regular Season",
        },
      }),
    );
  });

  it("skips the query when there are no players to read", async () => {
    const logs = await findSeasonAggregateLogs({
      playerIds: [],
      seasons: ["2026-27"],
      seasonType: "Regular Season",
    });

    expect(logs).toEqual([]);
    expect(client.playerGameLog.findMany).not.toHaveBeenCalled();
  });
});

describe("atomic stats writes", () => {
  it("uses one transaction client for players, logs, reads, totals, and advanced logs", async () => {
    await withStatsTransaction(async (tx) => {
      await upsertPlayers({ players: [player], tx });
      await replaceGameLogsForGames({ rows: [baseGameLog], tx });
      await findSeasonAggregateLogs({
        playerIds: [201939],
        seasons: ["2025-26"],
        seasonType: "Regular Season",
        tx,
      });
      await upsertSeasonStats({ rows: [{ ...baseGameLog, gamesPlayed: 1 }], tx });
      await replaceAdvancedGameLogsForGames({ rows: [baseAdvancedLog], tx });
    });
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.player.upsert).toHaveBeenCalledTimes(1);
    expect(client.playerGameLog.createMany).toHaveBeenCalledTimes(1);
    expect(client.playerGameLog.findMany).toHaveBeenCalledTimes(1);
    expect(client.playerSeasonStats.upsert).toHaveBeenCalledTimes(1);
    expect(client.playerAdvancedGameLog.createMany).toHaveBeenCalledTimes(1);
  });

  it("lets a late failure abort the outer transaction without retrying an inner statement", async () => {
    client.playerAdvancedGameLog.createMany.mockRejectedValueOnce(
      new Error("invalid advanced row"),
    );
    await expect(
      withStatsTransaction(async (tx) => {
        await replaceGameLogsForGames({ rows: [baseGameLog], tx });
        await replaceAdvancedGameLogsForGames({ rows: [baseAdvancedLog], tx });
      }),
    ).rejects.toThrow("invalid advanced row");
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });

  it("retries the whole transaction after a late connection drop", async () => {
    client.playerAdvancedGameLog.createMany.mockRejectedValueOnce(
      new Error("connection terminated"),
    );
    await withStatsTransaction(async (tx) => {
      await replaceGameLogsForGames({ rows: [baseGameLog], tx });
      await replaceAdvancedGameLogsForGames({ rows: [baseAdvancedLog], tx });
    });
    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(client.playerGameLog.deleteMany).toHaveBeenCalledTimes(2);
    expect(client.playerAdvancedGameLog.createMany).toHaveBeenCalledTimes(2);
  });
});

describe("resilient writes", () => {
  // Runs against the real clock: the first retry backs off 500ms, and bun:test
  // has no async timer runner to drain a backoff that is awaited between
  // microtasks. The backoff duration is not what this test is asserting.
  it("retries after a transient connection drop, then succeeds", async () => {
    client.$transaction.mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));

    await expect(replaceGameLogs({ rows: [baseGameLog] })).resolves.toBe(1);
    // One failed attempt plus one successful retry.
    expect(client.$transaction).toHaveBeenCalledTimes(2);
  });

  it("does not retry an error that is not a connection drop", async () => {
    client.$transaction.mockRejectedValueOnce(
      new Error("Unique constraint failed on the fields: (playerId, gameId)"),
    );

    await expect(replaceGameLogs({ rows: [baseGameLog] })).rejects.toThrow(
      "Unique constraint failed",
    );
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });
});
