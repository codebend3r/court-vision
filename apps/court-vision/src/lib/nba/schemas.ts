import { z } from "zod";

export const playerIndexRowSchema = z.object({
  PERSON_ID: z.number(),
  PLAYER_FIRST_NAME: z.string(),
  PLAYER_LAST_NAME: z.string(),
  TEAM_ID: z.number(),
  TEAM_ABBREVIATION: z.string().nullable(),
  POSITION: z.string().nullable(),
  JERSEY_NUMBER: z.string().nullable(),
});

export const seasonStatsRowSchema = z.object({
  PLAYER_ID: z.number(),
  GP: z.number(),
  MIN: z.number(),
  FGM: z.number(),
  FGA: z.number(),
  FG3M: z.number(),
  FG3A: z.number(),
  FTM: z.number(),
  FTA: z.number(),
  OREB: z.number(),
  DREB: z.number(),
  REB: z.number(),
  AST: z.number(),
  STL: z.number(),
  BLK: z.number(),
  TOV: z.number(),
  PTS: z.number(),
});

export const gameLogRowSchema = z.object({
  PLAYER_ID: z.number(),
  GAME_ID: z.string(),
  GAME_DATE: z.string(),
  TEAM_ID: z.number(),
  TEAM_ABBREVIATION: z.string(),
  MATCHUP: z.string(),
  WL: z.string().nullable(),
  MIN: z.union([z.number(), z.string()]),
  FGM: z.number(),
  FGA: z.number(),
  FG3M: z.number(),
  FG3A: z.number(),
  FTM: z.number(),
  FTA: z.number(),
  OREB: z.number(),
  DREB: z.number(),
  REB: z.number(),
  AST: z.number(),
  STL: z.number(),
  BLK: z.number(),
  TOV: z.number(),
  PTS: z.number(),
  PLUS_MINUS: z.number().nullable(),
});

export type PlayerIndexRow = z.infer<typeof playerIndexRowSchema>;
export type SeasonStatsRow = z.infer<typeof seasonStatsRowSchema>;
export type GameLogRow = z.infer<typeof gameLogRowSchema>;
