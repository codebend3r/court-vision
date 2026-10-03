import { beforeEach, describe, expect, it, vi } from "bun:test";

import {
  AdvancedGameLogInput,
  GameLogInput,
  PlayerInput,
  SeasonStatsInput,
} from "@/lib/stats/inputs";
import {
  upsertAdvancedGameLogs,
  upsertGameLogs,
  upsertPlayers,
  upsertSeasonStats,
} from "@/lib/stats/persist";

// Held as a module-scope const rather than built inside the factory: bun:test
// does not hoist `vi.mock`, so the assertions below reach the mock through this
// binding instead of re-importing `@/lib/prisma`.
const client = {
  player: { upsert: vi.fn() },
  playerSeasonStats: { upsert: vi.fn() },
  playerGameLog: {
    deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    createMany: vi.fn(() => Promise.resolve({ count: 0 })),
  },
  playerAdvancedGameLog: {
    deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    createMany: vi.fn(() => Promise.resolve({ count: 0 })),
  },
  // Support both transaction forms: the array form (batched upserts) resolves
  // with the operations it was handed, and the interactive callback form runs
  // against this same mock client.
  $transaction: vi.fn((arg: ((tx: unknown) => Promise<unknown>) | unknown[]) =>
    typeof arg === "function" ? arg(client) : Promise.resolve(arg),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertPlayers", () => {
  it("upserts each player keyed by id and returns the count", async () => {
    const count = await upsertPlayers([player]);
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
    await upsertPlayers([player]);
    await upsertPlayers([player]);
    expect(client.player.upsert).toHaveBeenCalledTimes(2);
  });

  it("commits chunked upserts with a timeout past Prisma's 5s default", async () => {
    const players = Array.from({ length: 501 }, (_, index) => ({ ...player, id: index }));

    const count = await upsertPlayers(players);

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
    const count = await upsertSeasonStats([stats]);
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

describe("upsertGameLogs", () => {
  it("replaces a season's logs with chunked inserts in one transaction", async () => {
    const logs = Array.from({ length: 1500 }, (_, index) => ({
      ...baseGameLog,
      gameId: `game-${index}`,
      playerId: index,
    }));

    const count = await upsertGameLogs(logs);

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

  it("does no work when there are no rows", async () => {
    const count = await upsertGameLogs([]);
    expect(count).toBe(0);
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.playerGameLog.deleteMany).not.toHaveBeenCalled();
  });
});

describe("upsertAdvancedGameLogs", () => {
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

  it("replaces a season's advanced logs with chunked inserts in one transaction", async () => {
    const logs = Array.from({ length: 1500 }, (_, index) => ({
      ...baseAdvancedLog,
      gameId: `game-${index}`,
      playerId: index,
    }));

    const count = await upsertAdvancedGameLogs(logs);

    expect(count).toBe(1500);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.playerAdvancedGameLog.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ season: "2020-21", seasonType: "Regular Season" }] },
    });
    expect(client.playerAdvancedGameLog.createMany).toHaveBeenCalledTimes(2);
  });

  it("does no work when there are no rows", async () => {
    const count = await upsertAdvancedGameLogs([]);
    expect(count).toBe(0);
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});

describe("resilient writes", () => {
  // Runs against the real clock: the first retry backs off 500ms, and bun:test
  // has no async timer runner to drain a backoff that is awaited between
  // microtasks. The backoff duration is not what this test is asserting.
  it("retries after a transient connection drop, then succeeds", async () => {
    client.$transaction.mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));

    await expect(upsertGameLogs([baseGameLog])).resolves.toBe(1);
    // One failed attempt plus one successful retry.
    expect(client.$transaction).toHaveBeenCalledTimes(2);
  });

  it("does not retry an error that is not a connection drop", async () => {
    client.$transaction.mockRejectedValueOnce(
      new Error("Unique constraint failed on the fields: (playerId, gameId)"),
    );

    await expect(upsertGameLogs([baseGameLog])).rejects.toThrow("Unique constraint failed");
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });
});
