import { z } from "zod";

// Yahoo's `json_f` format mixes numbers and strings for ids and flags, wraps
// every collection element in a single-key object (`teams: [{ team }]`) and
// sends `null` for absent values. These schemas absorb all of that: collections
// come out as plain arrays, ids as strings, counts as numbers and flags as
// booleans. Unknown keys are stripped.

/** `0|1|"0"|"1"|true|false|null|undefined` -> boolean. Anything else is rejected. */
export const yahooFlagSchema = z
  .union([z.literal(0), z.literal(1), z.literal("0"), z.literal("1"), z.boolean()])
  .nullish()
  .transform((value) => value === 1 || value === "1" || value === true);

// Absent or `null` becomes `undefined`, so consumers test one thing.
const absent = <Schema extends z.ZodType>(schema: Schema) =>
  schema.nullish().transform((value) => value ?? undefined);

// `z.coerce` would read null and "" as "null" / 0, so ids and numbers are matched
// explicitly: a finite number, or a string that is one.
const idSchema = z.union([z.string().min(1), z.number()]).transform(String);

const numberSchema = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)]).transform(Number);

// Links and images Yahoo serves: https only, on Yahoo's own hosts. The league
// page link is stored and rendered as a link; logos are rendered as images.
const YAHOO_ASSET_HOSTS: readonly string[] = [
  "s.yimg.com",
  "yahoofantasysports-res.cloudinary.com",
];

const isYahooHostedUrl = ({ value }: { value: string }): boolean => {
  const url = URL.parse(value);
  if (url === null || url.protocol !== "https:") return false;
  return url.hostname.endsWith(".yahoo.com") || YAHOO_ASSET_HOSTS.includes(url.hostname);
};

const yahooUrlSchema = z.string().refine((value) => isYahooHostedUrl({ value }), {
  message: "Expected an https URL on a Yahoo host",
});

// A logo anywhere else is treated as absent rather than failing the snapshot.
const toYahooLogoUrl = (value: string | undefined): string | undefined =>
  value !== undefined && isYahooHostedUrl({ value }) ? value : undefined;

// `[{ team }, { team }]` -> `[team, team]`: validates each wrapper, keeps what `pick` returns.
const unwrapped = <Wrapper extends z.ZodType, Inner>({
  wrapper,
  pick,
}: {
  wrapper: Wrapper;
  pick: (item: z.output<Wrapper>) => Inner;
}) => z.array(wrapper).transform((items) => items.map(pick));

const playerSchema = z.object({
  player_id: idSchema,
  name: z.object({ full: z.string() }),
  editorial_team_abbr: absent(z.string()),
  // What Yahoo prints under a player's name: "SG,SF,PF".
  display_position: absent(z.string()),
  eligible_positions: unwrapped({
    wrapper: z.object({ position: z.string() }),
    pick: ({ position }) => position,
  }).default([]),
  status: absent(z.string()),
  selected_position: absent(z.object({ position: z.string() })),
});

const playerWrapperSchema = z.object({ player: playerSchema });

const teamSchema = z.object({
  team_key: z.string(),
  team_id: idSchema,
  name: z.string(),
  team_logos: unwrapped({
    wrapper: z.object({
      team_logo: z.object({
        size: z.string().optional(),
        url: z.string().transform(toYahooLogoUrl),
      }),
    }),
    pick: ({ team_logo }) => team_logo,
  }).default([]),
  managers: unwrapped({
    wrapper: z.object({ manager: z.object({ nickname: absent(z.string()) }) }),
    pick: ({ manager }) => manager,
  }).default([]),
  is_owned_by_current_login: yahooFlagSchema,
  roster: z
    .object({
      players: unwrapped({ wrapper: playerWrapperSchema, pick: ({ player }) => player }).default(
        [],
      ),
    })
    .default({ players: [] }),
});

const statCategorySchema = z.object({
  stat_id: numberSchema,
  name: z.string().optional(),
  display_name: z.string(),
  position_type: absent(z.string()),
  // "1" when a bigger number wins the category, "0" when a smaller one does (turnovers).
  sort_order: absent(z.union([z.string(), z.number()]).transform(String)),
  is_only_display_stat: yahooFlagSchema,
});

const rosterPositionSchema = z.object({
  position: z.string(),
  count: numberSchema,
  is_starting_position: yahooFlagSchema,
});

// Unverified: no points league has been recorded yet (Task 6 tests a hand-made
// one). Accepts `{ stats: [{ stat: { stat_id, value } }] }`, emits `{ stat_id, value }[]`.
const statModifiersSchema = absent(
  z.object({
    stats: unwrapped({
      wrapper: z.object({
        stat: z.object({ stat_id: numberSchema, value: numberSchema }),
      }),
      pick: ({ stat }) => stat,
    }),
  }),
).transform((modifiers) => modifiers?.stats);

const leagueSchema = z.object({
  league_key: z.string(),
  league_id: idSchema,
  name: z.string(),
  url: yahooUrlSchema,
  logo_url: absent(z.string()).transform(toYahooLogoUrl),
  num_teams: numberSchema,
  season: numberSchema,
  current_week: absent(numberSchema),
  scoring_type: z.string(),
  is_highscore: yahooFlagSchema,
  settings: z.object({
    // Yahoo has been seen to carry the High Score flag here as well as on the league.
    is_highscore: yahooFlagSchema,
    roster_positions: unwrapped({
      wrapper: z.object({ roster_position: rosterPositionSchema }),
      pick: ({ roster_position }) => roster_position,
    }),
    stat_categories: z.object({
      stats: unwrapped({
        wrapper: z.object({ stat: statCategorySchema }),
        pick: ({ stat }) => stat,
      }),
    }),
    stat_modifiers: statModifiersSchema,
  }),
  teams: unwrapped({ wrapper: z.object({ team: teamSchema }), pick: ({ team }) => team }),
});

// One team's line in a scoreboard matchup: its week totals by stat id. Values
// stay strings ("0.481", "12", "42/87"); the stat categories say how to read them.
const matchupTeamSchema = z.object({
  team_key: z.string(),
  team_stats: z
    .object({
      stats: unwrapped({
        wrapper: z.object({
          stat: z.object({
            stat_id: numberSchema,
            value: z.union([z.string(), z.number()]).transform(String),
          }),
        }),
        pick: ({ stat }) => stat,
      }).default([]),
    })
    .default({ stats: [] }),
});

const matchupSchema = z.object({
  week: numberSchema,
  week_start: absent(z.string()),
  week_end: absent(z.string()),
  status: absent(z.string()),
  teams: unwrapped({
    wrapper: z.object({ team: matchupTeamSchema }),
    pick: ({ team }) => team,
  }),
});

const gameSchema = z.object({
  game_key: idSchema,
  season: numberSchema,
});

/** Body of `game/nba`. */
export const yahooGameSchema = z.object({ fantasy_content: z.object({ game: gameSchema }) });

/** Body of `league/{key};out=settings/teams/roster`. */
export const yahooLeagueSnapshotSchema = z.object({
  fantasy_content: z.object({ league: leagueSchema }),
});

/** Body of `league/{key}/players;…`. A page with no `players` key is an empty page. */
export const yahooPlayersPageSchema = z.object({
  fantasy_content: z.object({
    league: z.object({
      players: unwrapped({ wrapper: playerWrapperSchema, pick: ({ player }) => player }).default(
        [],
      ),
    }),
  }),
});

/** Body of `league/{key}/scoreboard`: the current week's matchups. No `matchups` key is an empty week. */
export const yahooScoreboardSchema = z.object({
  fantasy_content: z.object({
    league: z.object({
      scoreboard: z.object({
        matchups: unwrapped({
          wrapper: z.object({ matchup: matchupSchema }),
          pick: ({ matchup }) => matchup,
        }).default([]),
      }),
    }),
  }),
});

// `YahooGame` is the inner `game` object, not the `{ fantasy_content }` body.
export type YahooGame = z.infer<typeof gameSchema>;
// `YahooLeagueSnapshot` is the whole parsed body; read `.fantasy_content.league`.
export type YahooLeagueSnapshot = z.infer<typeof yahooLeagueSnapshotSchema>;
// `YahooLeague` is the inner `league` object (settings plus teams), already unwrapped.
export type YahooLeague = z.infer<typeof leagueSchema>;
// `YahooTeam` is one entry of `league.teams`, not the `{ team }` wrapper.
export type YahooTeam = z.infer<typeof teamSchema>;
// `YahooPlayer` is the inner `player` object, not the `{ player }` wrapper.
export type YahooPlayer = z.infer<typeof playerSchema>;
// `YahooPlayersPage` is the whole parsed body; read `.fantasy_content.league.players`.
export type YahooPlayersPage = z.infer<typeof yahooPlayersPageSchema>;
// `YahooScoreboard` is the whole parsed body; read `.fantasy_content.league.scoreboard.matchups`.
export type YahooScoreboard = z.infer<typeof yahooScoreboardSchema>;
// `YahooMatchup` is one matchup, not the `{ matchup }` wrapper.
export type YahooMatchup =
  YahooScoreboard["fantasy_content"]["league"]["scoreboard"]["matchups"][number];
