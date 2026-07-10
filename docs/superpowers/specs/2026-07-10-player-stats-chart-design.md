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

- `seed:demo` script that seeds five players' full 2025-26 game logs into
  Supabase using real identities/schedules (Free-tier endpoints) and generated
  box scores.
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
throttles to ~13s between requests; total ~12 requests ≈ 2.5 min):

1. `/v1/players?search=<name>` → real Balldontlie player id, team, position.
2. `/v1/games?seasons[]=2025&team_ids[]=<teamId>&per_page=100` → the team's
   real 2025-26 regular-season games (id, date, home/visitor, scores).
3. A deterministic seeded PRNG (e.g. mulberry32 keyed on `playerId`)
   generates one box score per game around a hardcoded per-player profile.

Because player ids and game ids are **real**, the future ALL-STAR backfill
upserts over the same `(playerId, gameId)` keys — demo rows are replaced with
zero cleanup.

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
transaction pooler, so the script needs no new configuration.

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

The scaffold home page gains a "Players" section listing seeded players
(Prisma query, name + team) linking to `/players/[id]`. Nothing else changes.

### 5.3 `PlayerStatChart` — `src/components/PlayerStatChart/` (client)

- **Recharts** `LineChart` (exact-pinned version compatible with React 19).
- X-axis: game number; tooltip shows date, matchup, W/L and the active series'
  values.
- Ten toggleable series via stat chips: PTS, REB, AST, STL, BLK, MIN, TOV,
  FG%, 3P%, FT%. **Default visible: PTS, REB, AST.**
- Counting stats → left y-axis; any active shooting % → right y-axis (0–100%).
- Styling: SCSS module, all colors/spacing/type from `styles/globals.scss`
  tokens; chart palette chosen per the dataviz skill (read before building).
- The chart receives plain serializable props (series array + stat metadata) —
  no data fetching inside the component.

## 6. Error handling

- Seed script: any endpoint/Zod failure aborts with a clear message (same
  retry/backoff client as the adapter); partial writes are safe because every
  write is an idempotent upsert keyed on real ids.
- Page: `notFound()` for bad/unknown ids; empty state for zero logs; no
  client-side fetch failures possible (data arrives as props).

## 7. Testing

- `cumulative.test.ts`: golden cases — running averages, ratio-of-sums
  percentages, zero-attempt `null`, empty input → empty output.
- `generate.test.ts` (demo): determinism (same seed → same rows) and the §3.3
  invariants across all generated games.
- `PlayerStatChart.test.tsx`: renders default series; toggling a chip
  shows/hides a series; % toggle activates the right axis.
- Existing suites untouched; `bun run system-check` green.

## 8. Risks

- `/v1/games` tier drift → §3.1 fallback.
- Recharts/React 19 incompatibility → pin the current major (3.x); if broken,
  fall back to hand-rolled SVG + `d3-scale` (design unchanged from §5.3's
  perspective — same props contract).
- Free-tier rate limit (5 req/min) → 13s throttle in the seed script only.
