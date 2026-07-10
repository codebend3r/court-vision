import { z } from "zod";

export const bdlTeamSchema = z.object({
  id: z.number(),
  abbreviation: z.string(),
  full_name: z.string(),
});

export type BdlTeam = z.infer<typeof bdlTeamSchema>;

const bdlNestedPlayerSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  position: z.string().nullable().optional(),
  jersey_number: z.string().nullable().optional(),
  team_id: z.number().nullable().optional(),
});

const bdlNestedTeamSchema = z.object({
  id: z.number(),
  abbreviation: z.string(),
});

const bdlGameSchema = z.object({
  id: z.number(),
  date: z.string(),
  season: z.number(),
  home_team_id: z.number(),
  visitor_team_id: z.number(),
  home_team_score: z.number(),
  visitor_team_score: z.number(),
  postseason: z.boolean(),
});

export const bdlStatSchema = z.object({
  id: z.number(),
  min: z.union([z.string(), z.number()]).nullable(),
  fgm: z.number(),
  fga: z.number(),
  fg3m: z.number(),
  fg3a: z.number(),
  ftm: z.number(),
  fta: z.number(),
  oreb: z.number(),
  dreb: z.number(),
  reb: z.number(),
  ast: z.number(),
  stl: z.number(),
  blk: z.number(),
  turnover: z.number(),
  pts: z.number(),
  plus_minus: z.number().nullable().optional(),
  player: bdlNestedPlayerSchema,
  team: bdlNestedTeamSchema,
  game: bdlGameSchema,
});

export type BdlStat = z.infer<typeof bdlStatSchema>;

export const bdlPage = <T>(item: z.ZodType<T>) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      next_cursor: z.number().nullable().optional(),
      per_page: z.number().optional(),
    }),
  });
