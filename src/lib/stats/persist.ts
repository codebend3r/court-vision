import { prisma } from "@/lib/prisma";

import { GameLogInput, PlayerInput, SeasonStatsInput } from "./inputs";

export interface SyncSummary {
  players: number;
  seasonStats: number;
  gameLogs: number;
}

export async function upsertPlayers(players: PlayerInput[]): Promise<number> {
  await players.reduce(async (previous, player) => {
    await previous;
    const { id, ...rest } = player;
    await prisma.player.upsert({ where: { id }, create: player, update: rest });
  }, Promise.resolve());
  return players.length;
}

export async function upsertSeasonStats(rows: SeasonStatsInput[]): Promise<number> {
  await rows.reduce(async (previous, row) => {
    await previous;
    await prisma.playerSeasonStats.upsert({
      where: {
        playerId_season_seasonType: {
          playerId: row.playerId,
          season: row.season,
          seasonType: row.seasonType,
        },
      },
      create: row,
      update: row,
    });
  }, Promise.resolve());
  return rows.length;
}

export async function upsertGameLogs(rows: GameLogInput[]): Promise<number> {
  await rows.reduce(async (previous, row) => {
    await previous;
    await prisma.playerGameLog.upsert({
      where: { playerId_gameId: { playerId: row.playerId, gameId: row.gameId } },
      create: row,
      update: row,
    });
  }, Promise.resolve());
  return rows.length;
}
