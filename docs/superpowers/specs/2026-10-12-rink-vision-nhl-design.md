# Rink Vision: NHL fantasy hockey

Date: 2026-10-12. Branch: `rink-and-diamond-specs`. Status: proposed.

## Problem

`apps/rink-vision` is a Next shell that renders the hockey descriptor through
`SportOverview` and nothing else: no data source, database or auth. The
engine it needs already exists. `@vision/sport-hockey` binds the shared
valuation engine to a hockey descriptor with Yahoo's default head-to-head
categories (7 skater, 4 goalie), two pools, and a 12-team roster. What is
missing is real NHL data, and the screens Court Vision already has for the NBA.

The site name is reserved: `rink-vision.netlify.app`, built from
`apps/rink-vision/netlify.toml`.

## Goal

Rink Vision does for NHL fantasy managers what Court Vision does for NBA
managers: browse and value every skater and goalie on the descriptor's
categories, season to date and over recent windows, and drill into a player's
game log.

Out of scope for this spec: accounts, leagues, rosters and the watchlist
(phase 3 below names them, but they get their own spec), multi-position
eligibility, and playoff valuation.

## Data source

### Decision: the NHL's own APIs

| Source                              | Per-game coverage of the 13 valued stats                                                    | Cost                              | Terms                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------ |
| NHL stats REST + `api-web.nhle.com` | All 13 (verified live 2026-10-12)                                                           | Free, no key                      | Non-commercial, personal use; no database copies |
| Balldontlie NHL                     | 7 of 13: box scores carry `power_play_goals` but no power-play points, and no goalie fields | $39.99/mo GOAT, per sport         | Licensed                                         |
| MySportsFeeds NHL                   | All (per docs)                                                                              | $5/mo personal, $25/mo commercial | Licensed                                         |

The NHL's APIs are the only source confirmed to carry every valued stat per
game. Balldontlie, the NBA app's source, cannot value goalies or PPP from its
box scores. Its goalie numbers are season totals only, and power-play points
cannot be rebuilt from power-play goals.

Two risks come with that choice, and the design contains both:

- **Terms.** nhl.com's terms allow "non-commercial, informational, personal
  use" and forbid copying content "into a database". Storing synced logs in
  Postgres is at odds with that. This is acceptable while Rink Vision is a
  free personal project, and must be revisited before any paid tier
  (`Profile.tier` already exists in Court Vision). The licensed fallback is
  MySportsFeeds.
- **Stability.** The endpoints are undocumented and change without notice.
  Every response is validated with zod at the boundary, exactly as the
  Balldontlie adapter does, so a shape change fails the sync loudly instead
  of writing bad rows.

Both risks are why the adapter sits behind a provider-neutral ingest boundary
(see _Ingest boundary_): swapping in MySportsFeeds later replaces one directory.

### Endpoints

All are unauthenticated GETs. `{season}` is the NHL's eight-digit id
(`20252026`); game type `2` is the regular season and `3` the playoffs.

| Need                                           | Endpoint                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skater per-game lines                          | `api.nhle.com/stats/rest/en/skater/summary` and `.../skater/realtime`, `?isAggregate=false&isGame=true&cayenneExp=gameDate="YYYY-MM-DD" and gameTypeId=2` |
| Goalie per-game lines                          | `api.nhle.com/stats/rest/en/goalie/summary`, same filter                                                                                                  |
| Schedule (which dates had final games)         | `api-web.nhle.com/v1/schedule/{date}`; `gameState: "OFF"` is final                                                                                        |
| Player bio and headshot                        | `api-web.nhle.com/v1/player/{id}/landing` (`headshot`, `positionCode`, height, weight, birth date, draft)                                                 |
| Teams and standings                            | `api-web.nhle.com/v1/standings/{date}` (32 current teams; `stats/rest/en/team` also returns defunct franchises)                                           |
| One game's box score (debugging, cross-checks) | `api-web.nhle.com/v1/gamecenter/{gameId}/boxscore`                                                                                                        |

A skater line is the summary row joined to the realtime row on
`playerId + gameId`. Summary has goals, assists, plus/minus, `ppPoints`,
`shots` and time on ice; realtime has `hits` and `blockedShots`.

The stats REST reports cap a query at 10,000 rows (a whole-season query
reported `total: 10000` against ~44k real rows). The sync therefore queries
**one game date at a time**. That is three reports per date, about 600
requests per season.

### Field mapping

| Valued stat      | Source field                                                       | Notes                                                                     |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `g`, `a`, `pm`   | `goals`, `assists`, `plusMinus`                                    | skater summary                                                            |
| `ppp`            | `ppPoints`                                                         | skater summary; not in the boxscore or player game log                    |
| `sog`            | `shots`                                                            | skater summary                                                            |
| `hit`, `blk`     | `hits`, `blockedShots`                                             | skater realtime; untracked before 2005-06 (zeros, not nulls)              |
| `w`, `so`        | `wins`, `shutouts`                                                 | goalie summary                                                            |
| `ga`, `sv`, `sa` | `goalsAgainst`, `saves`, `shotsAgainst`                            | goalie summary                                                            |
| `toi`            | `timeOnIcePerGame` (skater), `timeOnIce` (goalie), both in seconds | stored as integer seconds, converted to minutes at the valuation boundary |

The engine computes GAA and SV% from `ga`/`toi` and `sv`/`sa`; the API's
`goalsAgainstAverage` and `savePct` are ignored. A skater's goalie stats are
zero and a goalie's skater stats are zero, as the descriptor already assumes.

`positionCode` is `C`, `L`, `R`, `D` or `G`. Ingest maps `L` and `R` to `LW`
and `RW` so `parseHockeyPosition` reads it. No source gives fantasy
multi-position eligibility, so every player has exactly one group in v1.

### Rate limits and history

- No published limit. Responses come through Cloudflare with no rate-limit
  headers; community clients report occasional 429s with `Retry-After: 60`.
  The shared fetch helper (below) already honors `Retry-After`; the sync
  throttles to one request per 250ms to stay polite.
- Per-game rows exist back to at least 2003-04. Backfill starts at 2016-17,
  the same window Court Vision keeps, which avoids the pre-2005-06 hit and
  block zeros entirely.

## Design

### Shared groundwork

Rink Vision and Diamond Vision need the same few things from the monorepo.
Whichever app is built first does this work; the other reuses it.

1. **Pool membership in the engine.** `PoolDef.groups` is declared by every
   descriptor but read by nothing. `valuePlayers` values whichever lines it
   is handed against `pool ?? sport.pools[0]`, and the provisional ranking
   uses every category in `sport.categoryOrder`. A split-pool sport needs the
   engine to (a) keep only lines whose position group is in `pool.groups`, and
   (b) rank provisionally on `pool.categories`. Both land in
   `@vision/core/valuation` with tests in `sport-hockey` and `sport-baseball`.
   Basketball has one `"all"` pool, so its golden test must not move.
2. **A shared fetch helper.** Court Vision's `bdlFetch` (retry with backoff,
   `Retry-After`, zod parsing, `FetchImpl` injection) is the right shape for
   every provider. Lift the provider-neutral part into
   `@vision/core/util/fetchJson` so each adapter only adds its base URL,
   auth header and endpoints.
3. **Descriptor-driven UI.** Court Vision's fantasy table, controls, legend
   and game-log table are written against basketball types. The parts that
   only read a `SportDescriptor` (category columns, method columns, weights,
   pool tabs) move into `@vision/ui`, which may read core types but no sport
   lib. Basketball-only pieces (shooting splits, advanced metrics) stay in
   Court Vision.

### App layout

```
apps/rink-vision/
  prisma/schema.prisma          own schema and generated client
  prisma.config.ts
  src/lib/nhl/                  the adapter: client, endpoints, schemas, transform
  src/lib/stats/                provider-neutral inputs, persist, season constants
  src/lib/sync/                 backfill, nightly and player CLIs
  src/app/                      routes
```

The app keeps Court Vision's conventions: `@/*` imports, no barrels, server
components that read through `unstable_cache`, nuqs for search params.

### Ingest boundary

`src/lib/stats/inputs.ts` defines the rows the database takes:
`PlayerInput`, `GameLogInput` and `SeasonLineInput`. The NHL adapter's
`transform.ts` is the only code that knows NHL field names. Persist, sync and
everything above it only see inputs, so a licensed provider later means a new
adapter directory and nothing else.

### Database

Decision: a separate Supabase project for Rink Vision, with its own Prisma
schema.

- Each app migrates on its own schedule, and a hockey backfill cannot eat
  Court Vision's storage quota.
- It matches the "one full-stack app per sport" structure. Nothing reaches
  across apps at runtime.
- Cost: an account in one app is not an account in another. Shared identity
  across the three apps would need one Supabase project and is deferred to
  the accounts spec.

Models, mirroring Court Vision's where the shape is the same:

- `Player`: `id` (the NHL player id), names, `teamAbbr`, `position` (the
  mapped group), `headshotUrl`, height, weight, `birthDate`, draft fields.
  The headshot path embeds season and team, so the sync stores the URL from
  `landing` rather than building it.
- `PlayerGameLog`: unique on `(playerId, gameId)`. Holds `gameDate`, `season`
  (`"2025-26"`, from `crossYearSeasonLabel`), `seasonType`, team, opponent,
  home/away, `decision` (goalies), every valued stat as a non-null `Int`, and
  `toiSeconds`. Indexed on `(playerId, gameDate)`, `gameDate`, and
  `(season, seasonType)`, the indexes Court Vision needed for the same reads.
- `PlayerSeasonStats`: one row per player, season and season type, summed
  from the logs as `aggregateSeasonStats` does for the NBA. Cross-checked
  against the same reports with `isGame=false` in tests.
- `TeamStanding`: a daily snapshot from `standings/{date}`, used for the
  standings trend chart.

### Sync

| CLI                | What it does                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync:nhl`         | Backfill: for each season in the window, each date with final regular-season games, fetch the three reports, transform, and replace that date's logs. Then rebuild season lines for the season. |
| `sync:nhl:players` | For every player in the logs, fetch `landing` and upsert bio and headshot. Run after `sync:nhl`, as `sync:players` follows `sync:bdl`.                                                          |
| `sync:nhl:nightly` | Yesterday's date (New York time): the three reports, replace those games, refresh season lines and standings for the touched players.                                                           |

A nightly GitHub Actions workflow runs `sync:nhl:nightly` at 3am New York
time, reusing the DST gate from `nightly-sync.yml`. It needs `DATABASE_URL`
as a repository secret, distinct from Court Vision's. Every write is
fetch-first, then one transaction per date, so a failed request never leaves
a date half replaced.

### Screens

Phase 2 builds these, each opening with `PageHeader`:

- **Players**, with **Skaters** and **Goalies** tabs instead of Court Vision's
  Regular and Advanced. Columns come from each pool's categories. Ranges are
  Court Vision's: the season and the last 5, 10, 20, 40 and 60 games. An
  82-game schedule makes game windows as natural as in basketball.
- **Player** detail: bio, season line, game log, and the stat and fantasy
  charts. A goalie's log shows the goalie columns.
- **Fantasy Value**: Z, G, Points, VORP, positional, SGP and Sim Value through
  `hockeyEngine`, one pool at a time, using the descriptor's defaults.
- **Teams**: standings and the standings trend chart.

### Netlify

The site builds from `apps/rink-vision/netlify.toml`. Phase 1 adds
`DATABASE_URL` to the site's environment, and the same
`SECRETS_SCAN_OMIT_PATHS` treatment Court Vision's `netlify.toml` gives the
Turbopack cache. The site's package directory is set to `apps/rink-vision`
when it is linked to the repo.

## Phasing

1. **Groundwork and data.** Shared groundwork 1 and 2, the Prisma schema, the
   adapter, the three CLIs, and the nightly workflow. Backfill 2016-17 to the
   current season. Done when a season's summed logs match the NHL's own
   season report for a sample of players.
2. **Read-only app.** Shared groundwork 3 and the four screens, deployed to
   `rink-vision.netlify.app`.
3. **Accounts** (separate spec). Auth, leagues, rosters with the hockey
   slots, and the watchlist, after deciding whether identity is shared
   across apps.

## Testing

- Adapter: zod schemas tested against fixtures captured from live responses;
  transform tested for the `L`/`R` mapping, seconds to minutes, and the
  summary and realtime join.
- Sync: injected `FetchImpl` and a mocked Prisma delegate, following
  `apps/court-vision/src/lib/balldontlie/sync.test.ts`. Includes an empty
  night and a 429 retry.
- Engine: pool membership and per-pool provisional ranking tested in
  `sport-hockey`, and Court Vision's `golden.test.ts` must stay unchanged.
- Screens: role and name queries, as in the unit-tester skill.

## Open questions

- **Commercial use.** If Rink Vision will ever charge, move to MySportsFeeds
  before launch rather than after.
- **Multi-position eligibility.** Yahoo and ESPN grant C/LW-style
  eligibility that no stats source publishes. Should a later version import
  it from a fantasy platform?
- **Playoffs.** Value regular season only, as Court Vision does, or add a
  playoff toggle?
