# Court Vision — NBA Player Stats Fetch Layer

**Author:** CJ (with Claude)
**Date:** 2026-06-12
**Status:** Approved (brainstorming) — pending implementation
**Branch:** `nba-player-stats-fetch`

---

## 1. Overview

Stand up the first real data layer for Court Vision: fetch **player stats** from the
**NBA Stats API** (`stats.nba.com`) for the **2025–26 Regular Season only**, transform the
quirky response shape into typed records, and persist them via Prisma. This is the foundation
the leaderboard, trend charts, and heat score (PRD §6–§8) all build on.

This step is **code-only**: the Prisma models and the first migration are authored, but **no
live database is stood up and no real backfill is run**. Correctness is proven with unit tests
against mocked NBA responses. Standing up Postgres, running the migration, the real backfill,
and cron scheduling are explicit follow-ups.

## 2. Decisions (locked during brainstorming)

| Topic              | Decision                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Data source        | **NBA Stats API** (`stats.nba.com`) used directly. No Balldontlie fallback, no source-adapter abstraction yet. |
| Window             | `Season = 2025-26`, `SeasonType = Regular Season`. **No playoffs**, no other seasons. Constants, not config.   |
| Grain              | **Player identity + season aggregates + per-game logs** (full foundation).                                     |
| Database           | **Code-only.** Models + first migration authored but **not run**; no real backfill. Verified via mocked tests. |
| Sync entry         | **Standalone Bun-run script** (`sync:nba`). Real work lives in testable `src/lib/nba/` modules.                |
| Runtime validation | **`zod`** (exact-pinned) validates the untrusted NBA payload at the boundary and infers types — no casts.      |

## 3. Non-Goals

Live DB / migration run / real backfill, cron job or `app/api` route handler, heat-score and
time-window aggregation logic, any UI or page code, playoffs / seasons other than 2025–26,
Balldontlie integration, team-level or league-level stats (player stats only).

## 4. Data source: NBA Stats API

### 4.1 Request contract

Base URL: `https://stats.nba.com/stats/{endpoint}`. The API blocks requests that don't look
like a browser, so every call sends a fixed header set:

```
User-Agent:          <a desktop browser UA string>
Referer:             https://www.nba.com/
Origin:              https://www.nba.com
Accept:              application/json, text/plain, */*
Accept-Language:     en-US,en;q=0.9
x-nba-stats-origin:  stats
x-nba-stats-token:   true
Connection:          keep-alive
```

### 4.2 Response shape

Responses are column-oriented, not row-objects:

```jsonc
{
  "resource": "...",
  "parameters": { ... },
  "resultSets": [
    { "name": "PlayerIndex", "headers": ["PERSON_ID", "PLAYER_LAST_NAME", ...], "rowSet": [[1629029, "Doncic", ...], ...] }
  ]
}
```

A parser zips `headers` → each `rowSet` row into a keyed object (`Record<string, unknown>`),
which is then validated by a `zod` schema into a typed record. (Some endpoints return multiple
result sets; we select the relevant one by `name`.)

### 4.3 Endpoints (3, all league-wide)

We use league-wide endpoints so a full sync is a handful of calls, not 500+ per-player calls.

| Purpose           | Endpoint                | Key params                                                                                                         | Fields we keep                                                                                                  |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Player identity   | `playerindex`           | `Season=2025-26`, `LeagueID=00`                                                                                    | `PERSON_ID`, first/last name, `TEAM_ID`, `TEAM_ABBREVIATION`, `POSITION`, `JERSEY_NUMBER`                       |
| Season aggregates | `leaguedashplayerstats` | `Season=2025-26`, `SeasonType=Regular Season`, `PerMode=Totals`, `MeasureType=Base`, (+ required-but-empty params) | `PLAYER_ID`, `GP`, `MIN`, `FGM/FGA`, `FG3M/FG3A`, `FTM/FTA`, `OREB/DREB/REB`, `AST`, `STL`, `BLK`, `TOV`, `PTS` |
| Per-game logs     | `playergamelogs`        | `Season=2025-26`, `SeasonType=Regular Season`, `LeagueID=00`, `DateFrom`/`DateTo` (month chunks)                   | `PLAYER_ID`, `GAME_ID`, `GAME_DATE`, `TEAM_ID`, `TEAM_ABBREVIATION`, `MATCHUP`, `WL`, `MIN`, raw box score      |

`leaguedashplayerstats` requires a long list of filter params even when unused (e.g.
`Month=0`, `Period=0`, `LastNGames=0`, `PaceAdjust=N`, `PlusMinus=N`, `Rank=N`,
`OpponentTeamID=0`, `TeamID=0`, plus empty strings for `DateFrom`, `DateTo`, `Conference`,
`Division`, etc.). `endpoints.ts` owns these defaults so callers only pass what varies.

The game-logs payload for a full season is large (~30k rows). The sync **chunks `playergamelogs`
by calendar month** via `DateFrom`/`DateTo` so each call is bounded and a failure retries a
small window rather than the whole season.

### 4.4 Derived fields (from `MATCHUP`)

`MATCHUP` is `"DAL vs. BOS"` (home) or `"DAL @ BOS"` (away). The transform derives:

- `homeAway`: `"home"` when the separator is `vs.`, `"away"` when `@`
- `opponentAbbr`: the team abbreviation on the right-hand side

## 5. Prisma schema

Three models. Counting stats are stored as raw integer components; **percentages are derived,
not stored**, because the heat logic (PRD §7) weights efficiency categories by attempt volume.
Minutes are `Float` (NBA returns decimals). All writes are **upserts** keyed on natural unique
constraints so re-running a sync is idempotent.

```prisma
model Player {
  id           Int      @id            // NBA PERSON_ID (stable)
  firstName    String
  lastName     String
  fullName     String
  teamId       Int?
  teamAbbr     String?
  position     String?                 // "G", "F", "C", "G-F", ...
  jerseyNumber String?
  seasonStats  PlayerSeasonStats[]
  gameLogs     PlayerGameLog[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model PlayerSeasonStats {
  id          String   @id @default(cuid())
  player      Player   @relation(fields: [playerId], references: [id])
  playerId    Int
  season      String                   // "2025-26"
  seasonType  String                   // "Regular Season"
  gamesPlayed Int
  minutes     Float
  fgm Int; fga Int; fg3m Int; fg3a Int; ftm Int; fta Int
  oreb Int; dreb Int; reb Int; ast Int; stl Int; blk Int; tov Int; pts Int
  updatedAt   DateTime @updatedAt
  @@unique([playerId, season, seasonType])
}

model PlayerGameLog {
  id           String   @id @default(cuid())
  player       Player   @relation(fields: [playerId], references: [id])
  playerId     Int
  gameId       String                  // NBA GAME_ID
  gameDate     DateTime
  season       String
  seasonType   String
  teamId       Int
  teamAbbr     String
  matchup      String
  opponentAbbr String?
  homeAway     String                  // "home" | "away"
  winLoss      String?                 // "W" | "L"
  minutes      Float
  fgm Int; fga Int; fg3m Int; fg3a Int; ftm Int; fta Int
  oreb Int; dreb Int; reb Int; ast Int; stl Int; blk Int; tov Int; pts Int
  plusMinus    Int?
  @@unique([playerId, gameId])
  @@index([gameDate])
  @@index([playerId, gameDate])
}
```

> The `Int; Int` one-line field grouping above is shorthand for readability in this spec; the
> real schema writes one field per line.

The first migration SQL is generated with **`prisma migrate diff --from-empty
--to-schema-datamodel prisma/schema.prisma --script`** (which needs **no database**) and placed
under `prisma/migrations/`. It is **not applied** — there is no live DB in this step. `prisma
generate` (already DB-free in the scaffold) produces the typed client so `tsc` sees the models.

## 6. Module layout

All under `src/lib/nba/`, tests co-located (`*.test.ts`), fixtures under
`src/lib/nba/__fixtures__/`.

| File           | Responsibility                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts` | `SEASON`, `SEASON_TYPE`, `LEAGUE_ID`, base URL, the header set                                                               |
| `client.ts`    | Low-level fetch: applies headers, `AbortController` timeout, retry + exponential backoff on 429/5xx, polite inter-call delay |
| `parse.ts`     | `resultSets` → array of keyed `Record<string, unknown>`; selects a result set by name                                        |
| `schemas.ts`   | `zod` schemas for each endpoint's row + parsed-record inferred types                                                         |
| `endpoints.ts` | `fetchPlayerIndex`, `fetchSeasonStats`, `fetchPlayerGameLogs` — build param sets, call client, parse+validate                |
| `transform.ts` | Validated rows → Prisma input shapes; matchup→home/away+opponent, `GAME_DATE`→`Date`, minutes parsing                        |
| `persist.ts`   | Idempotent upserts for Player / PlayerSeasonStats / PlayerGameLog                                                            |
| `sync.ts`      | Orchestration: identity → season stats → game-logs-by-month; `import.meta.main` guard for CLI                                |

Entry point: a `sync:nba` script in `package.json` runs `bun run src/lib/nba/sync.ts`. No new
top-level `scripts/` directory — keeps `src/` as the single source root per CLAUDE.md.

## 7. Sync flow

1. `fetchPlayerIndex()` → validate → `persist.upsertPlayers()`.
2. `fetchSeasonStats()` → validate → `persist.upsertSeasonStats()`.
3. For each calendar month of the 2025–26 regular season: `fetchPlayerGameLogs({ dateFrom, dateTo })`
   → validate → `persist.upsertGameLogs()`.
4. Log a summary (players, season-stat rows, game-log rows upserted).

Idempotent throughout: upserts on the natural unique keys mean re-running never duplicates.

## 8. Dependencies

Add **`zod`** (exact-pinned, no `^`/`~`) as a runtime dependency for boundary validation.
No other new dependencies — `client.ts` uses the built-in `fetch`/`AbortController`.

## 9. Testing (code-only, mocked)

Small hand-authored JSON fixtures resembling real NBA payloads (a couple players, a few
game-log rows, including an `@` away game and a `vs.` home game, plus a row with a null/empty
field).

- `parse.test.ts` — header/rowSet zipping; result-set selection by name; empty `rowSet`.
- `schemas.test.ts` — valid rows parse; malformed rows reject (no silent `any`).
- `client.test.ts` — mocked `fetch`: correct URL/params/headers; retry + backoff on 429/5xx; timeout via `AbortController`.
- `endpoints.test.ts` — mocked `fetch`: each endpoint sends the right param set (incl. the required-but-empty params) and returns validated records.
- `transform.test.ts` — matchup parsing (home/away + opponent), `GAME_DATE` → `Date`, minutes parsing, derived fields, null handling.
- `persist.test.ts` — Prisma client mocked (`vi.mock`): asserts upsert payloads and that re-running issues upserts (idempotency), not inserts.

No live DB is touched. The full Vitest suite stays green under the existing pre-commit/pre-push gates.

## 10. Acceptance criteria

1. `prisma/schema.prisma` defines `Player`, `PlayerSeasonStats`, `PlayerGameLog`; `prisma generate` succeeds and `tsc --noEmit` passes against the generated client.
2. First migration SQL is generated via `prisma migrate diff --from-empty` (no DB) under `prisma/migrations/`, **not applied**.
3. `src/lib/nba/` modules exist with co-located tests; `bun run test` passes (incl. the new tests).
4. `bun run lint` (0 warnings), `bun run typecheck`, `bun run format:check` all pass.
5. No `any`, no type casts in authored code; the NBA payload is validated through `zod`.
6. `zod` is exact-pinned; no dependency carries `^`/`~`.
7. `bun run sync:nba` exists and wires fetch → transform → persist (runnable once a DB + `DATABASE_URL` are provided later); it is **not** run in this step.

## 11. Follow-ups (out of scope here)

- Stand up Postgres (docker-compose or hosted), apply the migration, run the real backfill.
- Cron / `app/api` route handler to schedule the sync 1–2×/day (PRD §8).
- Heat-score + time-window aggregation logic (PRD §7) — the priority test target.
- Playoffs and additional seasons; Balldontlie fallback behind a source adapter.
