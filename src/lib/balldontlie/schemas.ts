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

export const bdlPlayerSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  position: z.string().nullable().optional(),
  jersey_number: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  college: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  draft_year: z.number().int().nullable().optional(),
  draft_round: z.number().int().nullable().optional(),
  draft_number: z.number().int().nullable().optional(),
  team: bdlNestedTeamSchema.nullable().optional(),
});

export type BdlPlayer = z.infer<typeof bdlPlayerSchema>;

export const bdlGameSchema = z.object({
  id: z.number(),
  date: z.string(),
  season: z.number(),
  home_team_id: z.number(),
  visitor_team_id: z.number(),
  home_team_score: z.number(),
  visitor_team_score: z.number(),
  postseason: z.boolean(),
});

export type BdlGame = z.infer<typeof bdlGameSchema>;

// `/v1/games` rows embed team OBJECTS (`home_team`/`visitor_team`), unlike the
// flat `home_team_id`/`visitor_team_id` numbers on the `game` nested inside
// `/v1/stats` rows (still described by `bdlGameSchema` above). This schema
// validates the nested shape and transforms it down to the flat `BdlGame`
// shape so downstream code has one representation to work with.
export const bdlGameRowSchema = z
  .object({
    id: z.number(),
    date: z.string(),
    season: z.number(),
    postseason: z.boolean(),
    home_team_score: z.number(),
    visitor_team_score: z.number(),
    home_team: bdlNestedTeamSchema,
    visitor_team: bdlNestedTeamSchema,
  })
  .transform(
    (row): BdlGame => ({
      id: row.id,
      date: row.date,
      season: row.season,
      home_team_id: row.home_team.id,
      visitor_team_id: row.visitor_team.id,
      home_team_score: row.home_team_score,
      visitor_team_score: row.visitor_team_score,
      postseason: row.postseason,
    }),
  );

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

// `/v1/stats/advanced` rows carry per-game advanced metrics alongside the same
// nested player/team/game objects as `/v1/stats`. The nested game uses the flat
// `home_team_id`/`visitor_team_id` shape (`bdlGameSchema`), and the extra keys
// BDL sends on the nested team/game (conference, status, ist_stage, ...) are
// stripped by Zod. Every metric is nullable: BDL returns `null` for players who
// logged no minutes, so a required number would fail the whole page mid-run.
export const bdlAdvancedStatSchema = z.object({
  id: z.number(),
  pie: z.number().nullable(),
  pace: z.number().nullable(),
  assist_percentage: z.number().nullable(),
  assist_ratio: z.number().nullable(),
  assist_to_turnover: z.number().nullable(),
  defensive_rating: z.number().nullable(),
  defensive_rebound_percentage: z.number().nullable(),
  effective_field_goal_percentage: z.number().nullable(),
  net_rating: z.number().nullable(),
  offensive_rating: z.number().nullable(),
  offensive_rebound_percentage: z.number().nullable(),
  rebound_percentage: z.number().nullable(),
  true_shooting_percentage: z.number().nullable(),
  turnover_ratio: z.number().nullable(),
  usage_percentage: z.number().nullable(),
  player: bdlNestedPlayerSchema,
  team: bdlNestedTeamSchema,
  game: bdlGameSchema,
});

export type BdlAdvancedStat = z.infer<typeof bdlAdvancedStatSchema>;

// `/v1/teams` is a single-page endpoint whose live response omits `meta`
// entirely, so this envelope keeps `meta` optional. Do NOT reuse it for
// cursor-paginated endpoints — see `bdlPaginatedPage` below.
export const bdlPage = <T>(item: z.ZodType<T>) =>
  z.object({
    data: z.array(item),
    meta: z
      .object({
        next_cursor: z.number().nullable().optional(),
        per_page: z.number().optional(),
      })
      .optional(),
  });

// Cursor-paginated endpoints (`/v1/stats`, `/v1/players`, `/v1/games`) MUST
// report `meta` on every page: the fetchers below read `meta.next_cursor` to
// decide whether to keep paginating, and a page silently missing `meta`
// would look identical to "no more pages", stopping early and upserting a
// partial dataset. `meta` is required here; `next_cursor` inside it stays
// nullable/optional to represent "no next page".
export const bdlPaginatedPage = <T>(item: z.ZodType<T>) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      next_cursor: z.number().nullable().optional(),
      per_page: z.number().optional(),
    }),
  });
