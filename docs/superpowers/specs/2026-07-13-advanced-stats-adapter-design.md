# Advanced Stats Adapter — Design

Date: 2026-07-13
Branch: `advanced-stats`

## Goal

Add Balldontlie **advanced stats** (`GET /v1/stats/advanced`, GOAT tier) to the
`src/lib/balldontlie/` adapter as a fetch-only layer. No persistence, no UI.

This mirrors how the existing endpoints (`teams`, `stats`, `players`, `games`)
were introduced: a Zod row schema, a cursor-paginated fetcher, and co-located
tests.

## Scope

**In:**

- `bdlAdvancedStatSchema` + `BdlAdvancedStat` type in `schemas.ts`
- `fetchAllAdvancedStats` in `endpoints.ts`
- Co-located tests in `schemas.test.ts` and `endpoints.test.ts`

**Out:** Prisma model, migration, `sync.ts`/`transform.ts` changes, UI.

## Endpoint reference

`GET https://api.balldontlie.io/v1/stats/advanced` — cursor-paginated, same
envelope as `/v1/stats`. A single `data` row:

- `id: number`
- 15 metric fields, all `float` and **nullable** (BDL returns `null` for
  players who logged no minutes): `pie`, `pace`, `assist_percentage`,
  `assist_ratio`, `assist_to_turnover`, `defensive_rating`,
  `defensive_rebound_percentage`, `effective_field_goal_percentage`,
  `net_rating`, `offensive_rating`, `offensive_rebound_percentage`,
  `rebound_percentage`, `true_shooting_percentage`, `turnover_ratio`,
  `usage_percentage`
- `player` — matches existing `bdlNestedPlayerSchema` (extra fields stripped)
- `team` — matches existing `bdlNestedTeamSchema` (extra fields stripped)
- `game` — flat `home_team_id`/`visitor_team_id`, matches existing
  `bdlGameSchema` (extra fields stripped)

Query params used: `seasons=[SEASON_YEAR]`, `postseason=false`,
`per_page=PER_PAGE`, `cursor`. Pagination via `meta.next_cursor`.

## Design

### 1. `schemas.ts`

```ts
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
```

Reuses the three existing nested schemas; unknown nested keys are stripped by
Zod's default behavior.

### 2. `endpoints.ts`

`fetchAllAdvancedStats(deps: BdlClientDeps = {})` — a near-copy of
`fetchAllStats`: `bdlPaginatedPage(bdlAdvancedStatSchema)`, params
`{ seasons: [SEASON_YEAR], postseason: "false", per_page: PER_PAGE, ...cursor }`,
`onPage` progress with endpoint label `"stats/advanced"`, throttled recursion on
`meta.next_cursor` until `null`.

### 3. Tests

- `schemas.test.ts`: valid row parses with numeric and `null` metrics; extra
  nested fields are stripped.
- `endpoints.test.ts`: fake two-page `fetch` paginates and stops on
  `next_cursor: null`; asserts the request path/params.

## Testing

`bun run test` (co-located Vitest), `bun run lint`, `bun run build`.
