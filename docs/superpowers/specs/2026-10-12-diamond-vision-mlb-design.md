# Diamond Vision: MLB fantasy baseball

Date: 2026-10-12. Branch: `rink-and-diamond-specs`. Status: proposed.

## Problem

`apps/diamond-vision` is a Next shell that renders the baseball descriptor
through `SportOverview` and nothing else: no data source, database or auth.
`@vision/sport-baseball` already binds the shared valuation engine to classic
5×5 rotisserie (R, HR, RBI, SB, AVG; W, SV, K, ERA, WHIP), with hitter and
pitcher pools and a 12-team roster. What is missing is real MLB data, and the
screens Court Vision already has for the NBA.

The site name is reserved: `diamond-vision.netlify.app`, built from
`apps/diamond-vision/netlify.toml`.

## Goal

Diamond Vision does for MLB fantasy managers what Court Vision does for NBA
managers: browse and value every hitter and pitcher on the 5×5 categories,
season to date and over recent windows, and drill into a player's game log.

Out of scope for this spec: accounts, leagues, rosters and the watchlist
(phase 3 below names them, but they get their own spec), and categories
outside 5×5 (OBP, quality starts, holds).

## Data source

### Decision: Balldontlie MLB, with the MLB Stats API for enrichment

| Source                             | Per-game coverage of the 12 valued stats          | Cost                                                         | Terms                                           |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Balldontlie MLB                    | All 12 (per docs) on ALL-STAR and up, 2002 onward | $9.99/mo ALL-STAR (60 req/min); $39.99/mo GOAT (600 req/min) | Licensed                                        |
| MLB Stats API (`statsapi.mlb.com`) | All 12 (verified live 2026-10-12), deeper history | Free, no key                                                 | "Only individual, non-commercial, non-bulk use" |
| MySportsFeeds MLB                  | All (per docs)                                    | $5/mo personal, $35/mo commercial                            | Licensed                                        |

Balldontlie is the primary source:

- **Its license permits what a sync does.** The MLB Stats API's notice
  forbids bulk use, and a backfill into Postgres is bulk use by definition.
- **The adapter already exists.** Court Vision's Balldontlie client handles
  cursor pagination, the `Authorization` header, retries and throttling.
  Only the base path (`/mlb/v1`) and the endpoints differ.

Billing is per sport: an NBA GOAT key does not unlock MLB. ALL-STAR is enough
for a nightly sync. A full backfill at 60 req/min takes about 15 minutes per
season, so either accept roughly 2.5 hours for ten seasons, or run GOAT for
the backfill month and drop to ALL-STAR.

The MLB Stats API supplies what Balldontlie does not, one request per player
rather than in bulk: headshots, MLBAM ids, and fielding-based position data
for two-way players.

**Verified 2026-10-13 with Court Vision's NBA GOAT key:** `/mlb/v1/teams` (a
free endpoint) answers 200, but `/mlb/v1/stats` answers 401. The key works
across sports, and the per-game stats need an MLB tier of their own. No
`/mlb/v1/stats` field has been seen live yet. Phase 1 starts with a 48-hour
trial that checks those fields, their nulls, and the position strings against
the mapping below before anything is built on them.

### Endpoints

| Need                              | Endpoint                                                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final games for a date            | `/mlb/v1/games?dates[]=YYYY-MM-DD&season_type=regular`, keep `status_state=final`                                                                                                |
| Per-game hitter and pitcher lines | `/mlb/v1/stats?game_ids[]=…` (ALL-STAR). There is no date filter and no nested game, so the sync lists games first and joins on `game_id`.                                       |
| Player index                      | `/mlb/v1/players`, `/mlb/v1/players/active`                                                                                                                                      |
| Teams                             | `/mlb/v1/teams`                                                                                                                                                                  |
| Standings                         | `/mlb/v1/standings` (ALL-STAR)                                                                                                                                                   |
| Injuries (the IL slot)            | `/mlb/v1/player_injuries` (ALL-STAR)                                                                                                                                             |
| MLBAM id mapping                  | MLB Stats API `/api/v1/sports/1/players?season=YYYY` (names, birth dates, current team, ids)                                                                                     |
| Headshots                         | `img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{mlbamId}/headshot/67/current` (has a built-in generic fallback) |

### Field mapping

| Valued stat            | Balldontlie `/stats`                | Notes                                                                                      |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `r`, `hr`, `rbi`, `sb` | `runs`, `hr`, `rbi`, `stolen_bases` | hitting                                                                                    |
| `h`, `ab`              | `hits`, `at_bats`                   | hitting; AVG's numerator and denominator                                                   |
| `w`, `sv`, `k`         | `wins`, `saves`, `p_k`              | pitching                                                                                   |
| `er`                   | `er`                                | pitching; ERA's numerator                                                                  |
| `br`                   | `p_hits + p_bb`                     | materialized at ingest: WHIP's variance needs Σ(h+bb)², which separate sums cannot rebuild |
| `outs`                 | `pitching_outs`                     | integer outs, so innings sums stay exact (`6.2` innings is 20 outs)                        |
| playing time           | 1 per game appeared                 | the descriptor's `playingTime` is games, with no per-unit rate                             |

Hitting and pitching both have hits, walks and strikeouts: a hitter's `hits`
are hits made and a pitcher's `p_hits` are hits allowed. Transform namespaces
them by group and never mixes the two. The API's string ratios (AVG, ERA,
WHIP) are ignored; the engine computes them.

Positions arrive as text ("Relief Pitcher", "Left Fielder", "Designated
Hitter"). Transform maps them to the descriptor's groups: the three outfield
spots to `OF`, starting and relief pitchers to `SP` and `RP`. A two-way
player (MLBAM `TWP`, e.g. Ohtani) is eligible in both pools, as `DH` and
`SP`.

### Rate limits and history

- ALL-STAR: 60 req/min, 100 rows per page. A night is about 15 games and
  under 10 requests. A season is about 92k rows, roughly 925 pages.
- Detail fields can be `null` until the full box score lands. The nightly
  sync re-fetches the previous two dates, and replacing whole games makes
  that idempotent.
- Backfill starts at 2016, matching Court Vision's ten-season window.
- Doubleheaders and suspended games make the date ambiguous, so every row is
  keyed by `game_id`, never by date.

## Design

### Shared groundwork

Rink Vision's spec (`2026-10-12-rink-vision-nhl-design.md`) defines three
pieces of shared groundwork: pool membership in the engine, a shared fetch
helper in `@vision/core/util/fetchJson`, and descriptor-driven UI in
`@vision/ui`. Whichever app is built first does that work. Diamond Vision
adds one more:

4. **A Balldontlie lib.** Court Vision's client, cursor paginator and zod
   envelope are not NBA-specific. Lift them into a new `libs/balldontlie`
   (`@vision/balldontlie`), which may import only core. The NBA endpoints
   stay in Court Vision and the MLB endpoints live in Diamond Vision; both
   call the lib with their own base path. Court Vision's endpoint tests must
   pass unchanged after the move.

Pool membership matters more here than in hockey. A two-way player's lines
carry both hitting and pitching stats, and the hitter pool must not rank on
pitching categories, or the reverse.

### App layout

```
apps/diamond-vision/
  prisma/schema.prisma          own schema and generated client
  prisma.config.ts
  src/lib/mlb/                  endpoints, schemas, transform (client from @vision/balldontlie)
  src/lib/mlbam/                id mapping and headshots from the MLB Stats API
  src/lib/stats/                provider-neutral inputs, persist, season constants
  src/lib/sync/                 backfill, nightly, players and headshot CLIs
  src/app/                      routes
```

### Ingest boundary

As in Rink Vision, `src/lib/stats/inputs.ts` defines `PlayerInput`,
`GameLogInput` and `SeasonLineInput`, and `src/lib/mlb/transform.ts` is the
only code that knows Balldontlie's MLB field names. Moving to the MLB Stats
API or MySportsFeeds later replaces one directory.

### Database

Decision: a separate Supabase project with its own Prisma schema, for the
same reasons as Rink Vision: independent migrations, storage that cannot
crowd Court Vision's, and no runtime coupling between apps. Shared identity
across apps is deferred to the accounts spec.

- `Player`: `id` (the Balldontlie id), `mlbamId` (nullable until mapped),
  names, `teamAbbr`, `positions` (the mapped groups; a two-way player has
  two), bats/throws, height, weight, `birthDate`.
- `PlayerGameLog`: unique on `(playerId, gameId)`. Holds `gameDate`, `season`
  (`"2026"`, from `singleYearSeasonLabel`), `seasonType`, team, opponent,
  home/away, `started` (pitchers; it drives SP/RP), and every valued stat as
  a non-null `Int` with `br` materialized. Indexed on `(playerId, gameDate)`,
  `gameDate`, and `(season, seasonType)`.
- `PlayerSeasonStats`: summed from the logs per player, season and season
  type.
- `TeamStanding`: a daily snapshot for the standings trend chart.

SP or RP is decided per season by the share of appearances started: at least
half makes SP. Balldontlie's position text is the fallback for a pitcher with
no appearances yet.

### Sync

| CLI                | What it does                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync:mlb`         | Backfill: for each season, each date's final games, then their stats in pages, transform, and replace those games' logs. Then rebuild season lines.                                                                                     |
| `sync:mlb:players` | Upsert the player index and positions. Run after `sync:mlb`.                                                                                                                                                                            |
| `map:mlbam`        | Match players without an `mlbamId` to the MLB Stats API season roster by normalized name, birth date and team, the way Court Vision's `map:headshots` matches `nbaPersonId`. Unmatched players keep a null id and the generic headshot. |
| `sync:mlb:nightly` | The last two dates (New York time): replace those games, refresh touched season lines, positions and standings.                                                                                                                         |

A nightly GitHub Actions workflow runs `sync:mlb:nightly` at 3am New York
time; late West Coast games end around 1:30am. It reuses the DST gate from
`nightly-sync.yml` and needs its own `DATABASE_URL` and
`BALLDONTLIE_API_KEY` secrets. Every write is fetch-first, then one
transaction per date.

### Screens

Phase 2 builds these, each opening with `PageHeader`:

- **Players**, with **Hitters** and **Pitchers** tabs. Columns come from each
  pool's categories plus the counting stats behind the ratios (H/AB, IP, ER,
  H+BB). Ranges are the season and the last 7, 14 and 30 days. In baseball,
  days read better than games: a reliever pitches 2 or 3 times a week.
- **Player** detail: bio, season line, game log, and the stat and fantasy
  charts. Pitcher logs show innings (outs ÷ 3, written as `6.2`).
- **Fantasy Value**: Z, G, Points, VORP, positional, SGP and Sim Value through
  `baseballEngine`, one pool at a time.
- **Teams**: standings and the standings trend chart.

Day-based ranges are new. Court Vision's ranges count games (the last 5 to
60), so the window-aggregation API in core needs a date-window variant. The
phase 2 plan must say whether that lands in core or in the app.

### Netlify

The site builds from `apps/diamond-vision/netlify.toml`. Phase 1 adds
`DATABASE_URL` and `BALLDONTLIE_API_KEY` to the site's environment, and the
same `SECRETS_SCAN_OMIT_PATHS` treatment Court Vision's `netlify.toml` gives
the Turbopack cache, since the API key will reach the build. The site's
package directory is set to `apps/diamond-vision` when it is linked to the
repo.

## Phasing

1. **Trial and groundwork.** A Balldontlie MLB trial confirms the field
   mapping. Then shared groundwork 1, 2 and 4, the Prisma schema, the
   adapter, the CLIs, and the nightly workflow. Backfill 2016 to the current
   season. Done when a season's summed logs match the MLB Stats API season
   totals for a sample of hitters and pitchers.
2. **Read-only app.** Shared groundwork 3, day-based ranges, and the four
   screens, deployed to `diamond-vision.netlify.app`.
3. **Accounts** (separate spec). Auth, leagues, rosters with the baseball
   slots (including IL from the injuries endpoint), and the watchlist.

## Testing

- Adapter: zod schemas tested against fixtures captured during the trial;
  transform tested for the position mapping, the hitting and pitching
  namespaces, `br` materialization, and a two-way player.
- Sync: injected `FetchImpl` and a mocked Prisma delegate. Includes a
  doubleheader, a suspended game, an empty night, and a 429 retry.
- `map:mlbam`: name normalization, birth-date tie-breaking, and unmatched
  players.
- Engine: pool membership and the two-way player tested in `sport-baseball`.
  Court Vision's `golden.test.ts` must stay unchanged.

## Open questions

- **Tier.** ALL-STAR year-round, or GOAT for the backfill month only?
- **Commercial use.** Balldontlie's license covers a paid Diamond Vision; the
  MLB Stats API enrichment (headshots, ids) does not clearly do so at scale.
  Check before a paid tier.
- **Two-way players.** Value them in both pools (the default above), or
  combine both values into one?
- **Ranges.** Days for both pools, or games for hitters and days for
  pitchers?
