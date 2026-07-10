# Balldontlie player-stats backfill — design

Date: 2026-07-10
Status: Approved (build now, live run deferred)
Supersedes as live source: `docs/superpowers/specs/2026-06-12-nba-player-stats-fetch-design.md`
(the stats.nba.com adapter, which is tarpitted from this machine at the IP/session level)

## 1. Context and goal

The NBA fetch layer (`src/lib/nba/`) is complete and tested, but `stats.nba.com`
tarpits this machine (TCP+TLS complete, then zero bytes until timeout —
reproduced with curl and headless Chrome). We are switching the **live data
source** to the [Balldontlie API](https://www.balldontlie.io/) (`api.balldontlie.io`),
which is not tarpitted.

Goal: land real **2025-26 regular season** player stats into the existing
`Player` / `PlayerSeasonStats` / `PlayerGameLog` tables via a new `sync:bdl`
script, reusing the existing Prisma models and the (now shared) persistence layer.

## 2. Scope

**In scope**

- New Balldontlie adapter under `src/lib/balldontlie/`.
- Extraction of the source-agnostic write path (`persist.ts`, `*Input` shapes,
  and the pure `parseMinutes` / `parseGameDate` helpers) into a neutral
  `src/lib/stats/` module shared by both the NBA and Balldontlie adapters.
- 2025-26 **Regular Season only** (`postseason=false`).
- TDD unit tests (mocked `fetch` + mocked Prisma), same conventions as the NBA layer.
- A new `sync:bdl` script.

**Out of scope (follow-ups)**

- Playoffs / other seasons; advanced or GOAT-tier stats; native `season_averages`.
- Heat-score logic, cron scheduling, UI, API routes.
- Retiring or deleting the NBA adapter (it stays intact and revivable from a
  clean IP).

**Definition of done for this work**

- Code-complete with a green quality gate (prettier + typecheck + lint `--max-warnings 0` + vitest).
- The live backfill run is **deferred** (see §10): the provided API key is
  currently **Free tier**, which returns no `/v1/stats` data. The code is built
  and tested against mocked fetch so it is ready to run the moment the key gains
  ALL-STAR access.

## 3. Data source: Balldontlie

### 3.1 Auth, tiers, limits

- Base URL: `https://api.balldontlie.io/v1`.
- Auth: `Authorization: <API_KEY>` header (no `Bearer` prefix). Key lives in
  `.env` as `BALLDONTLIE_API_KEY` (git-ignored).
- Tiers gate endpoints:
  - **Free** (5 req/min): `/teams`, `/players`, `/games` — **no stats**.
  - **ALL-STAR** ($9.99/mo, 60 req/min): adds `/stats` (per-game box scores),
    `/players/active`, `/player_injuries`.
  - **GOAT** ($39.99/mo, 600 req/min): adds `/season_averages`, advanced stats, etc.
- We target **ALL-STAR**. We do **not** need GOAT: season aggregates are derived
  from the per-game box scores we already store (§6.3).

Tier probe (2026-07-10, provided key) confirmed the key authenticates but is
currently Free tier: `/teams` and `/players` → 200; `/players/active`, `/stats`,
`/season_averages` → 401 `Unauthorized`.

### 3.2 Endpoints used

Only two endpoints are needed.

**`GET /v1/teams`** (Free) — fetched once to build a `teamId → abbreviation`
map used for opponent resolution. Confirmed shape:

```json
{
  "id": 1,
  "conference": "East",
  "division": "Southeast",
  "city": "Atlanta",
  "name": "Hawks",
  "full_name": "Atlanta Hawks",
  "abbreviation": "ATL"
}
```

**`GET /v1/stats`** (ALL-STAR) — the full 2025-26 regular-season per-game box
score stream. Query params:

- `seasons[]=2025` — Balldontlie season = the season's **start year**, so
  2025-26 → `2025`.
- `postseason=false` — regular season only.
- `per_page=100` — max page size.
- `cursor=<next_cursor>` — cursor pagination (see §3.3).

Per-row shape (per Balldontlie docs; **validate against the live payload once the
key is upgraded** — this is best-effort until then):

```json
{
  "id": 15531179, "min": "30",
  "fgm": 7, "fga": 18, "fg_pct": 0.389,
  "fg3m": 5, "fg3a": 9, "fg3_pct": 0.556,
  "ftm": 4, "fta": 4, "ft_pct": 1,
  "oreb": 2, "dreb": 5, "reb": 7, "ast": 1, "stl": 1, "blk": 0,
  "turnover": 1, "pf": 3, "pts": 23, "plus_minus": 23,
  "player": { "id": 115, "first_name": "Stephen", "last_name": "Curry",
              "position": "G", "jersey_number": "30", "team_id": 10, ... },
  "team":   { "id": 10, "abbreviation": "GSW", ... },
  "game":   { "id": 18422, "date": "2025-10-22", "season": 2025,
              "home_team_id": 10, "visitor_team_id": 2,
              "home_team_score": 112, "visitor_team_score": 108,
              "postseason": false, ... }
}
```

Notes: `min` is a **string** (e.g. `"30"` or possibly `"MM:SS"`); `turnover` is
**singular**; percentages and `plus_minus` may be null; `game.date` may be
date-only or ISO.

### 3.3 Pagination

Cursor-based. Each response carries `meta.next_cursor` and `meta.per_page`. Loop:
issue the first request without `cursor`, then pass `cursor=meta.next_cursor` on
each subsequent request until `next_cursor` is absent/null.

Approx volume: ~30k regular-season stat rows → ~320 pages at 100/row. Throttled
to stay ≤60/min, a full backfill is ~5-6 minutes.

## 4. Data model

**No Prisma migration.** The existing tables fit Balldontlie data as-is:

- `Player.id` (`Int @id`) now holds the **Balldontlie player id** instead of the
  NBA person id. Same type; the DB is empty so there is no collision. (Mixing
  sources later would collide semantically — out of scope; we are switching
  wholesale.)
- `PlayerGameLog.gameId` (`String`) holds the stringified Balldontlie game id.
  `@@unique([playerId, gameId])` still holds.
- `PlayerGameLog.teamId` (`Int`) holds the Balldontlie team id; `teamAbbr` comes
  from the teams map.
- `PlayerSeasonStats` is populated by in-memory aggregation of the game logs
  (§6.3); its natural key `@@unique([playerId, season, seasonType])` is unchanged.

`season` / `seasonType` are set from constants (`"2025-26"` / `"Regular Season"`).

## 5. Architecture (Approach A: shared write path)

### 5.1 New shared module `src/lib/stats/`

Source-agnostic, used by both adapters:

- `inputs.ts` — the `PlayerInput`, `SeasonStatsInput`, `GameLogInput` interfaces
  (moved verbatim out of `nba/transform.ts`).
- `persist.ts` — `upsertPlayers`, `upsertSeasonStats`, `upsertGameLogs` (moved
  verbatim out of `nba/persist.ts`; unchanged logic; imports `@/lib/prisma`).
- `parse.ts` — the pure helpers `parseMinutes(value)` and `parseGameDate(value)`
  (moved out of `nba/transform.ts`; both adapters need them).
- Tests move with their files (`persist.test.ts`, and new `parse.test.ts`
  carved from the relevant `transform.test.ts` cases).

`nba/transform.ts` and `nba/sync.ts` are updated to import from `@/lib/stats/*`.
The NBA `client.ts`, `schemas.ts`, `endpoints.ts`, `constants.ts`, `parse.ts`
(the column-oriented response parser — unrelated to the new `stats/parse.ts`)
are untouched.

### 5.2 New adapter `src/lib/balldontlie/`

- `constants.ts` — `BDL_BASE_URL`, `SEASON_YEAR = "2025"`,
  `SEASON_LABEL = "2025-26"`, `SEASON_TYPE = "Regular Season"`,
  `PER_PAGE = "100"`, `THROTTLE_MS = 1100`, and `getApiKey()` (reads
  `process.env.BALLDONTLIE_API_KEY`, throws a clear error if empty).
- `client.ts` — `bdlFetch({ endpoint, params, apiKey?, fetchImpl?, sleep?, maxRetries?, timeoutMs? })`:
  - Builds the query string with array support (`seasons` → `seasons[]=2025`).
  - Sends the `Authorization` header (`apiKey` defaults to `getApiKey()`; tests
    pass a dummy so they never touch env).
  - Retries `429`/`5xx` with exponential backoff (`2**n * 500`), honoring a
    `Retry-After` header when present; retries `AbortError`/`TypeError`.
  - 30s `AbortController` timeout, cleared in `finally`.
  - Returns `unknown`. Mirrors `nbaFetch`'s DI-friendly shape.
- `schemas.ts` — zod schemas: `bdlTeamSchema`, `bdlPlayerSchema`,
  `bdlGameSchema`, `bdlStatSchema` (nested player/team/game), and a generic
  paginated envelope `bdlPage(itemSchema)` → `{ data: item[], meta: { next_cursor?, per_page } }`.
  Nullable/absent fields handled (`min` string, pcts/`plus_minus` nullable).
- `endpoints.ts` — `BdlClientDeps` (`fetchImpl?`, `sleep?`, `apiKey?`);
  `fetchTeams(deps)` → `BdlTeam[]`; `fetchAllStats(deps)` → cursor-paginates
  `/stats` (throttling `THROTTLE_MS` between pages via `sleep`) accumulating
  `BdlStat[]` until `next_cursor` is absent.
- `transform.ts` — see §6.
- `sync.ts` — `syncBalldontlie(deps)` orchestration (§6.4) + `import.meta.main`
  CLI guard, mirroring `nba/sync.ts`. Returns the shared `SyncSummary`
  (`{ players, seasonStats, gameLogs }`).

## 6. Transforms and derivations

### 6.1 Players — `toPlayerInputs(stats, teamAbbrById)`

Dedupe `stat.player` by `id` (last wins; the nested player reflects the current
profile, consistent across rows). Map → `PlayerInput`:
`id = player.id`, `firstName/lastName`, `fullName = "first last"`,
`teamId = player.team_id` (0/nullish → null), `teamAbbr = teamAbbrById[team_id] ?? null`,
`position` (blank → null), `jerseyNumber` (blank → null).

### 6.2 Game logs — `toGameLogInput({ stat, teamAbbrById })`

- `homeAway = stat.team.id === stat.game.home_team_id ? "home" : "away"`.
- `opponentTeamId = homeAway === "home" ? game.visitor_team_id : game.home_team_id`;
  `opponentAbbr = teamAbbrById[opponentTeamId] ?? null`.
- `matchup = "${stat.team.abbreviation} ${homeAway === "away" ? "@" : "vs."} ${opponentAbbr}"`
  (matches the NBA `MATCHUP` convention so downstream parsing is uniform).
- `playerScore = homeAway === "home" ? game.home_team_score : game.visitor_team_score`;
  `oppScore` = the other; `winLoss = playerScore > oppScore ? "W" : playerScore < oppScore ? "L" : null`.
- `gameId = String(game.id)`, `gameDate = parseGameDate(game.date)`,
  `minutes = parseMinutes(stat.min)`, `tov = stat.turnover`,
  `plusMinus = stat.plus_minus ?? null`, remaining counting fields copied 1:1,
  `season`/`seasonType` from constants.

### 6.3 Season aggregates — `aggregateSeasonStats(gameLogs)`

Group logs by `playerId`; per player emit a `SeasonStatsInput` with
`gamesPlayed = count`, `minutes = sum(minutes)`, and each counting component
summed (`fgm..pts`, `tov`). `season`/`seasonType` from constants. This matches
the NBA layer's `PerMode=Totals` semantics and removes any need for GOAT's
`season_averages`.

### 6.4 Orchestration — `syncBalldontlie(deps)`

1. `teams = fetchTeams(deps)` → build `teamAbbrById`.
2. `stats = fetchAllStats(deps)` (paginated, throttled).
3. `players = upsertPlayers(toPlayerInputs(stats, teamAbbrById))`.
4. `gameLogs = stats.map((s) => toGameLogInput({ stat: s, teamAbbrById }))`;
   `upsertGameLogs(gameLogs)`.
5. `seasonStats = upsertSeasonStats(aggregateSeasonStats(gameLogs))`.
6. Return `{ players, seasonStats, gameLogs }`.

## 7. Resilience

- Throttle `THROTTLE_MS` (~1.1s) between paginated `/stats` calls to stay under
  the 60/min ALL-STAR limit.
- Retry `429`/`5xx` with exponential backoff; honor `Retry-After`.
- 30s per-request timeout via `AbortController`.
- All writes are idempotent upserts on natural keys → the backfill is safe to
  re-run and effectively resumable.

## 8. Testing (TDD, mocked fetch + mocked Prisma)

- `stats/persist.test.ts` (moved) — upsert idempotency on natural keys.
- `stats/parse.test.ts` — `parseMinutes` (`"30"`, `"MM:SS"`, empty),
  `parseGameDate` (date-only vs ISO; exact-UTC assertion to guard the timezone bug).
- `balldontlie/client.test.ts` — auth header present; `seasons[]` serialized;
  cursor loop across pages; `429` retry with injected `sleep`; timeout via aborted fetch.
- `balldontlie/schemas.test.ts` — parse representative `/stats` and `/teams`
  payloads; reject malformed rows.
- `balldontlie/transform.test.ts` — home/away, opponent, matchup, win/loss
  derivation; `turnover`→`tov`; player dedupe; season aggregation sums.
- `balldontlie/sync.test.ts` — orchestration wiring with mocked endpoints + persist.
- Gate: `bun run system-check` (prettier:check, typecheck, lint, test) green.

## 9. Config and scripts

- `.env` — `BALLDONTLIE_API_KEY=<key>` (git-ignored; already added).
- `.env.example` — document `BALLDONTLIE_API_KEY` with a placeholder (committed).
- `package.json` — add `"sync:bdl": "bun run src/lib/balldontlie/sync.ts"`.
  No new dependencies (global `fetch` + existing `zod`).

## 10. Deferred live run (verification once key is ALL-STAR)

When `BALLDONTLIE_API_KEY` has ALL-STAR access:

1. Re-probe `/v1/stats` returns 200.
2. **Validate `bdlStatSchema` against the live payload** and fix any field
   drift (this is the one best-effort area — §3.2).
3. `bun run sync:bdl`.
4. Verify: `Player` ~500+ rows, `PlayerGameLog` ~30k rows, `PlayerSeasonStats`
   = distinct players; spot-check one known player's season totals (e.g. Curry)
   against a public reference.

## 11. Open items / caveats

- The `/v1/stats` row schema is **best-effort until validated live** (the key is
  Free tier today). Treat §10.2 as a required step before trusting the backfill.
- `min` format and `game.date` format are handled defensively but should be
  confirmed against the live payload.
- DNP handling: `/v1/stats` is expected to return a row only for games a player
  appeared in, so `gamesPlayed = row count`. Revisit if live data shows min=0 rows.
