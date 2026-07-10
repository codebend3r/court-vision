# Player stats chart + demo seed — design

Date: 2026-07-10
Status: Approved
Depends on: `docs/superpowers/specs/2026-07-10-balldontlie-player-stats-backfill-design.md`
(tables, `src/lib/stats/` write path, Balldontlie adapter)

## 1. Context and goal

The database now lives in Supabase (project `invmrcgjbdgfemrytlfp`); the Prisma
init migration and read-only RLS policies are applied, but the tables are
empty. The real Balldontlie backfill (`sync:bdl`) is still blocked: the API key
probes as Free tier (`/v1/teams` 200, `/v1/stats` 401), so per-game box scores
cannot be fetched yet.

Goal: ship the first user-facing feature — a page showing how one player's
**season-to-date averages** evolve across the 2025-26 season as a multi-series
line chart, starting with **Anthony Edwards** — and unblock it with a
**realistic demo seed** that the future real backfill overwrites cleanly.

An earlier idea to build the frontend in Angular is dropped: this repo stays a
Next.js project and the chart is built here.

## 2. Scope

**In scope**

- `seed:demo` script that seeds **all players** (cursor-paginated
  `GET /v1/players`, per <https://docs.balldontlie.io/#get-all-players>) plus
  full 2025-26 game logs for five profiled players, using real
  identities/schedules (Free-tier endpoints) and generated box scores.
- New `fetchAllPlayers` cursor-paginated fetcher (+ player Zod schema) in the
  Balldontlie adapter, mirroring `fetchAllStats`.
- Pure cumulative-average series builder in `src/lib/stats/`.
- Player page `/players/[playerId]` (server component, Prisma reads).
- `PlayerStatChart` client component (Recharts) with stat toggles.
- Home-page list of seeded players linking to their pages.
- Co-located unit tests throughout; green `bun run system-check`.

**Out of scope (follow-ups)**

- Player search, multi-player comparison, season selection, UI-triggered sync.
- Playoffs; other seasons.
- Replacing demo data — that is just `sync:bdl` once the key is ALL-STAR.

**Definition of done**

- `bun run seed:demo` populates Supabase; `/players/<edwardsId>` renders the
  chart from those rows; quality gate green.

## 3. Demo seed (`src/lib/demo/`, `bun run seed:demo`)

### 3.1 Real identity + schedule, generated stats

Free tier allows `/teams`, `/players`, `/games` (5 req/min — the script
throttles to ~13s between requests; ~55-60 requests total ≈ 13 min):

1. `GET /v1/players?per_page=100` + `cursor` pagination
   (<https://docs.balldontlie.io/#get-all-players>) → **every player** in the
   database (1946-current, roughly 5k rows / 50+ pages). Each row (id,
   first_name, last_name, position, jersey_number, team{id, abbreviation})
   maps to a `PlayerInput`; nullable fields (`teamId`, `position`,
   `jerseyNumber`) pass through as null when absent. All rows are upserted.
2. The five profiled players are found in that fetched set by exact
   full-name match (no extra `search` requests); a missing profile name
   aborts the script.
3. `/v1/games?seasons[]=2025&team_ids[]=<teamId>&per_page=100` → each
   profiled player's team schedule: real 2025-26 regular-season games
   (id, date, home/visitor, scores). 5 requests.
4. A deterministic seeded PRNG (e.g. mulberry32 keyed on `playerId`)
   generates one box score per game around a hardcoded per-player profile.

Because player ids and game ids are **real**, the future ALL-STAR backfill
upserts over the same `(playerId, gameId)` keys for games the real player
actually played. That is not "zero cleanup", though: the real sync only
writes rows for games the player appears in, so demo game logs generated for
games where the real player was DNP'd are never touched by the upsert and
would linger, mixing fabricated points into an otherwise-real series. Before
the first real `sync:bdl` backfill, delete the five profiled players'
2025-26 game logs (one `deleteMany` on their playerIds) so demo rows for
real-DNP games don't linger; then run the sync.

**Fallback** (only if `/v1/games` unexpectedly 401s): synthetic schedule with
deterministic fake game ids prefixed `demo-`; cleanup then =
`DELETE FROM "PlayerGameLog" WHERE "gameId" LIKE 'demo-%'` before a real sync.

### 3.2 Seeded players and profiles

Plausible (not official) 2025-26 per-game profiles; each stat gets a mean +
spread, and a games-played target introduces deterministic DNPs:

| Player                  | GP  | MIN  | PTS  | REB  | AST | STL | BLK | TOV | FG%  | 3P%  | FT%  |
| ----------------------- | --- | ---- | ---- | ---- | --- | --- | --- | --- | ---- | ---- | ---- |
| Anthony Edwards         | 79  | 36.3 | 27.6 | 5.7  | 4.5 | 1.2 | 0.6 | 3.3 | .447 | .395 | .837 |
| Shai Gilgeous-Alexander | 76  | 34.2 | 32.7 | 5.0  | 6.4 | 1.7 | 1.0 | 2.4 | .519 | .375 | .898 |
| Luka Dončić             | 70  | 35.4 | 28.2 | 8.2  | 7.7 | 1.6 | 0.4 | 3.6 | .450 | .368 | .782 |
| Jayson Tatum            | 74  | 36.4 | 26.8 | 8.7  | 6.0 | 1.1 | 0.5 | 2.9 | .452 | .343 | .814 |
| Giannis Antetokounmpo   | 67  | 34.2 | 30.4 | 11.9 | 6.5 | 0.9 | 1.2 | 3.1 | .601 | .222 | .617 |

### 3.3 Generator invariants (unit-tested)

- `pts = 2 × (fgm − fg3m) + 3 × fg3m + ftm`; `reb = oreb + dreb`;
  `fgm ≥ fg3m`; attempts ≥ makes for FG/3P/FT; all counts ≥ 0.
- `matchup`, `homeAway`, `winLoss`, `gameDate`, `season`, `seasonType` derive
  from the real game record (scores decide W/L).
- Same inputs → identical output (seeded PRNG, no `Date.now()`/`Math.random()`).

### 3.4 Persistence

Writes go through the existing source-agnostic path: `upsertPlayers` →
`upsertGameLogs` → `upsertSeasonStats` with `aggregateSeasonStats` reused for
the season rows. `.env`'s `DATABASE_URL` already points at the Supabase
transaction pooler, so the script needs no new configuration. The all-players
upsert is ~5k sequential round trips over the pooler (a few minutes) — fine
for a one-off script; the API throttle dominates anyway.

## 4. Cumulative series (`src/lib/stats/cumulative.ts`)

Pure function, `reduce`-based running sums; one input = game logs ordered by
`gameDate`, one output point per game:

- Counting stats (`min`, `pts`, `reb`, `ast`, `stl`, `blk`, `tov`):
  point N = (Σ games 1..N) / N, rounded for display only at render time.
- Shooting stats: point N = `Σfgm/Σfga`, `Σfg3m/Σfg3a`, `Σftm/Σfta`
  (**ratio of sums, not average of per-game percentages**); a zero-attempt
  denominator yields `null` for that point (Recharts skips nulls).
- Each point also carries `gameIndex`, `gameDate`, `matchup`, `winLoss` for
  tooltips.

## 5. UI

### 5.1 Page — `src/app/players/[playerId]/page.tsx` (RSC)

- Parses `playerId` (integer; non-numeric → `notFound()`).
- Prisma: player by id + game logs ordered by `gameDate` (via `@/lib/prisma`,
  which already targets Supabase). Unknown player → `notFound()`.
- Computes the series server-side and renders: header (full name, team abbr,
  position, season label, games played) + `PlayerStatChart`.
- Zero game logs → empty-state message instead of the chart.

### 5.2 Home page

The scaffold home page gains a "Players" section listing only players who
**have game logs** (the Player table itself holds ~5k players after seeding),
name + team, linking to `/players/[id]`. Nothing else changes.

### 5.3 `PlayerStatChart` — `src/components/PlayerStatChart/` (client)

- **Recharts** (exact-pinned `3.9.2`, React 19 compatible) rendered as **two
  stacked single-axis panels** sharing the game-number x-axis — never dual
  y-axes (the dataviz skill's #1 anti-pattern; amended from the earlier
  right-axis idea): "Per-game averages" (PTS, REB, AST, STL, BLK, MIN, TOV)
  and "Shooting percentages" (FG%, 3P%, FT%, y fixed 0–100). The shooting
  panel renders only while a % stat is active.
- Ten toggleable series via stat chips that double as the legend (color dot +
  label). **Default visible: PTS, REB, AST.** Colors follow the stat, never
  the toggle order — fixed slots from the dataviz reference palette (dark
  steps), validated with the palette script against the app surface `#151a23`
  (7-slot counting set passes with one floor-band CVD pair, mitigated by
  end-of-line direct labels in muted ink; 3-slot shooting set passes clean).
- X-axis: game number; tooltip shows date, matchup, W/L and the active
  series' values (counting stats 1dp; percentages 1dp + `%`).
- Styling: SCSS module; chart chrome (grid, axis text, chips) uses
  `styles/globals.scss` tokens; the validated series hexes live in
  `statMeta.ts` as data constants.
- The chart receives plain serializable props (series array) — no data
  fetching inside the component.

## 6. Error handling

- Seed script: any endpoint/Zod failure aborts with a clear message (same
  retry/backoff client as the adapter); partial writes are safe because every
  write is an idempotent upsert keyed on real ids.
- Page: `notFound()` for bad/unknown ids; empty state for zero logs; no
  client-side fetch failures possible (data arrives as props).

## 7. Testing

- `cumulative.test.ts`: golden cases — running averages, ratio-of-sums
  percentages, zero-attempt `null`, empty input → empty output.
- Adapter tests for `fetchAllPlayers` (mocked fetch): cursor pagination,
  schema validation, player-row → `PlayerInput` mapping incl. null fields.
- `generate.test.ts` (demo): determinism (same seed → same rows) and the §3.3
  invariants across all generated games.
- `PlayerStatChart.test.tsx`: renders default series; toggling a chip
  shows/hides a series; toggling a % stat reveals the shooting panel.
- Existing suites untouched; `bun run system-check` green.

## 8. Risks

- `/v1/games` tier drift → §3.1 fallback.
- Recharts/React 19 incompatibility → pin the current major (3.x); if broken,
  fall back to hand-rolled SVG + `d3-scale` (design unchanged from §5.3's
  perspective — same props contract).
- Free-tier rate limit (5 req/min) → 13s throttle in the seed script only.
