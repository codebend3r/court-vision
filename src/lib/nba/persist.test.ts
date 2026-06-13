import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

import { upsertGameLogs, upsertPlayers, upsertSeasonStats } from "./persist";
import { GameLogInput, PlayerInput, SeasonStatsInput } from "./transform";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: { upsert: vi.fn() },
    playerSeasonStats: { upsert: vi.fn() },
    playerGameLog: { upsert: vi.fn() },
  },
}));

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertPlayers", () => {
  it("upserts each player keyed by id and returns the count", async () => {
    const count = await upsertPlayers([player]);
    expect(count).toBe(1);
    expect(prisma.player.upsert).toHaveBeenCalledWith({
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
    expect(prisma.player.upsert).toHaveBeenCalledTimes(2);
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
    expect(prisma.playerSeasonStats.upsert).toHaveBeenCalledWith({
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
  it("upserts on the playerId+gameId unique key", async () => {
    const log: GameLogInput = {
      playerId: 201939,
      gameId: "0022500001",
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
    const count = await upsertGameLogs([log]);
    expect(count).toBe(1);
    expect(prisma.playerGameLog.upsert).toHaveBeenCalledWith({
      where: { playerId_gameId: { playerId: 201939, gameId: "0022500001" } },
      create: log,
      update: log,
    });
  });
});
