# Multi-Season Backfill (2020→2025) — Design

Date: 2026-07-13
Branch: `advanced-stats`

## Goal

Backfill regular box-score stats **and** advanced stats for the 2020-21 through
2025-26 seasons from Balldontlie into Supabase. Balldontlie serves box scores
back to 1946 and v1 advanced stats back to 1996, so 2020 is comfortably in
range; coverage is data-gated, not tier-gated.

## Current constraints

- `constants.ts` hardcodes `SEASON_YEAR = "2025"`; every fetcher requests
  `seasons: [SEASON_YEAR]`.
- `transform.ts` stamps every row with the hardcoded `SEASON_LABEL`, and
  `aggregateSeasonStats` groups by `playerId` only — both single-season
  assumptions.
- The DB is already multi-season ready: `PlayerGameLog` is unique on
  `[playerId, gameId]` and `PlayerSeasonStats` on
  `[playerId, season, seasonType]`.
- Advanced stats have **no persistence** at all (the adapter added earlier
  today is fetch-only).

## Design

### 1. Constants (`lib/balldontlie/constants.ts`)

- `BACKFILL_START_YEAR = 2020`.
- `BACKFILL_SEASON_YEARS`: `["2020", …, SEASON_YEAR]`, derived, not hand-listed.
- `seasonLabelFromYear(year: number): string` → `2020` → `"2020-21"`.
  `SEASON_LABEL` becomes derived from `SEASON_YEAR` via this helper.

### 2. Fetchers (`lib/balldontlie/endpoints.ts`)

`fetchAllStats` and `fetchAllAdvancedStats` change signature to
`(args: { deps?: BdlClientDeps; season?: string } = {})`, defaulting to
`SEASON_YEAR` (matches the `fetchAllPlayers` args-object pattern). One season
per call — the sync loops, keeping memory bounded (~26k rows/season vs ~160k)
and making per-season progress and retry isolation natural.

### 3. Transforms (`lib/balldontlie/transform.ts`)

Derive the season label from the row itself: every stat row embeds
`game.season` (the start year), so `toGameLogInput` and the new advanced
transform stamp `season: seasonLabelFromYear(game.season)` instead of the
hardcoded constant. No season parameter threading.

`aggregateSeasonStats` groups by `` `${playerId}|${season}` `` instead of
`playerId`, taking the season from each log.

New `toAdvancedGameLogInput({ stat })` → `AdvancedGameLogInput`: playerId,
gameId, gameDate, season, seasonType, teamId, teamAbbr, plus the 15 nullable
metrics camel-cased (`pie`, `pace`, `assistPercentage`, …).

### 4. Persistence

- `prisma/schema.prisma`: new `PlayerAdvancedGameLog` model — identity columns
  as above, 15 `Float?` metrics, `@@unique([playerId, gameId])`,
  `@@index([playerId, gameDate])`, relation to `Player`. Additive migration
  `add_advanced_game_logs`.
- `lib/stats/inputs.ts`: `AdvancedGameLogInput` type.
- `lib/stats/persist.ts`: `upsertAdvancedGameLogs` mirroring `upsertGameLogs`
  (season-scope delete + chunked `createMany` in one transaction). `SyncSummary`
  gains `advancedGameLogs: number`.

### 5. Sync (`lib/balldontlie/sync.ts`)

`syncBalldontlie(args: { deps?: BdlClientDeps; seasons?: string[] })`,
defaulting to `[SEASON_YEAR]` so the routine refresh behavior is unchanged.
Seasons run sequentially (reduce chain). Per season: fetch stats → upsert
players + game logs + aggregated season stats → fetch advanced stats → upsert
advanced game logs. Summary counts accumulate across seasons.

CLI: bare season start years as argv (`bun … sync.ts 2020 2021`), or `--all`
for `BACKFILL_SEASON_YEARS`; no args → current season only.

Seasons run oldest→newest so `Player` rows finish reflecting the most recent
team/position.

### 6. Out of scope

UI changes; season averages endpoint; playoffs (`postseason=false` throughout,
matching existing behavior).

## Testing

TDD per unit: constants helper, fetcher season param, transform season
derivation + advanced transform, persist upsert, sync loop. Full gate:
`bun run lint`, `tsc --noEmit`, `bun run test`.

## Runtime estimate

~260 pages/season/endpoint at 1.1 s throttle ≈ 5 min → ~1 h for 6 seasons × 2
endpoints. Run as a background script after implementation.
