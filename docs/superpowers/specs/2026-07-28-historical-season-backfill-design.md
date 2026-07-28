# Historical season backfill to 2016-17

Extend the Balldontlie backfill window four seasons deeper, from the current
2020-21 floor back to **2016-17**. Every historical season gets the same
treatment 2020+ already has: `PlayerGameLog`, `PlayerAdvancedGameLog`, and the
aggregated `PlayerSeasonStats`. No new tables, no schema migration.

Follows the 2020-2025 backfill (PR #8, 2026-07-13), which established the
adapter, the write path and the advanced-stats table. This spec owns only the
window extension and the parsing change that unblocks it.

## Balldontlie coverage, verified live 2026-07-28

The adapter's assumptions were checked against the live API rather than the
docs. Findings that shaped this design:

| Era                   | Box scores (`/v1/stats`)                                                  | Advanced (`/v1/stats/advanced`)                     |
| --------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| 2019-20 → now         | Complete, zero nulls                                                      | Available                                           |
| **2016-17 → 2018-19** | Complete for every _played_ row; inactive roster rows return all-`null`   | Available                                           |
| 1996-97 → 2015-16     | Same all-`null` inactive rows                                             | Available (1996-97 is the floor; 1990 returns `[]`) |
| 1983-84 → 1995-96     | Complete                                                                  | **Absent**                                          |
| 1979-80 → 1982-83     | `oreb`/`dreb`/`stl`/`blk`/`turnover` null on 16–50% of _played_ rows      | Absent                                              |
| 1946-47 → 1978-79     | Whole categories untracked (no 3PT pre-1979, no STL/BLK/TOV/ORB pre-1974) | Absent                                              |

Data is available all the way to 1946-47, so "as far as possible" is a choice
rather than a limit. **2016-17 was chosen** (CJ, 2026-07-28) over the deeper
options. Two consequences worth recording:

- Storage is not the constraint. The Supabase org (`Court Vision`,
  `invmrcgjbdgfemrytlfp`) is on the **Pro** plan — 8 GB included, 177 MB in
  use. Even a full 1946 backfill (~1.3 GB) would have fit.
- Staying at 2016 keeps every stored `0` honest. Below 1979 a `0` in `stl`
  would mean "the league did not record steals", which the 9-category
  valuation engine would silently score as a real zero. Going deeper later
  would require nullable era-gated columns and era-awareness in
  `lib/valuation/` — out of scope here.

## Approaches considered

- **A. Point the existing sync at 2016 and run it (chosen, with two
  amendments).** `sync:bdl` already accepts season years and owns whole
  seasons idempotently. The window is one constant. Needs the null fix below
  to survive 2016-2018, and a follow-up `sync:players` to protect current
  team assignments.
- **B. A Prisma migration that inserts the rows.** Rejected. Migrations carry
  schema, not ~160k rows of third-party data; the file would be unreviewable
  and unrepeatable, and Prisma's migration runner has no throttling or resume.
  The population mechanism is the sync script. (This was the initial framing
  of the request; recorded here because the distinction matters.)
- **C. Make the Prisma counting-stat columns nullable and store `null` for
  inactive rows.** Rejected for this window. It is the _correct_ model below
  1979, but at 2016+ the only nulls are whole-row inactive entries, which
  2022-23+ already represents as zeros. Adopting nullable columns now would
  make 2016-2019 inconsistent with the six seasons already stored and force
  null handling through every consumer for no gain.

## Change 1 — Null-tolerant stat parsing

**This is the blocker.** `bdlStatSchema` declares `fgm`, `fga`, `fg3m`,
`fg3a`, `ftm`, `fta`, `oreb`, `dreb`, `reb`, `ast`, `stl`, `blk`, `turnover`
and `pts` as plain `z.number()`. Seasons 2016-2018 return rows where every one
of those fields is `null` — an inactive roster entry (9 of 100 rows in a 2016
sample; 2019 had none). Zod validates a whole page at once via
`bdlPaginatedPage`, so a single such row rejects the page and aborts the
season.

- `schemas.ts`: mark those fourteen fields `.nullable()` on `bdlStatSchema`.
  `min` is already `.nullable()`. Leave `id`, `player`, `team`, `game`
  required — those are never null and a missing one is a real error.
- `transform.ts`: coalesce with `?? 0` in `toGameLogInput`.

The result is byte-identical to how a 2022-23 DNP row lands today: zeros with
`minutes` 0. `aggregateSeasonStats` increments `gamesPlayed` only when
`log.minutes > 0`, so coalesced rows cannot inflate games played — that guard
already exists and needs no change.

Nulls are _not_ propagated to Prisma. At 2016+ every played row is complete,
so a stored `0` only ever means "did not play".

## Change 2 — Move the backfill floor

`constants.ts`: `BACKFILL_START_YEAR` 2020 → 2016.

That constant is already the single source of truth. It derives
`BACKFILL_SEASON_YEARS` (the `--all` window) and is imported by
`lib/stats/searchParams.ts` to derive `SEASON_OPTIONS`, so the season dropdown
and the `?season=` literal validator both widen from 6 entries to 10 with no
further edits. Update the comment on `BACKFILL_START_YEAR`, which currently
says "2020-21 through the current season".

## Change 3 — Protect current player teams

`upsertPlayers` performs `update: rest`, overwriting `teamId`, `teamAbbr`,
`position` and `jerseyNumber` from whichever season is being synced.
`lib/teams/loader.ts:97` builds team rosters from `Player.teamAbbr`. Syncing
2016-2019 in isolation would therefore rewrite every player's team to their
2019 team and scramble the team pages and team builder.

Today's code avoids this only incidentally, by running seasons oldest-first
and finishing on the current season.

**Chosen mitigation:** a two-step run, no code change.

```sh
bun run sync:bdl 2016 2017 2018 2019
bun run sync:players
```

`sync:players` reads `/v1/players`, whose rows carry each player's _current_
team, and upserts through the same `upsertPlayers`. It is the canonical source
for current team and position, so it restores correct values for every player
the backfill touched. It also fills `heightInches`, `weightLbs`, `college`,
`country` and draft fields, which `toPlayerInputs` (the stats-derived path)
does not populate.

Rejected alternatives: re-running the full `--all` window (correct by
construction, but rewrites 232k good rows for a metadata ordering concern),
and adding a `refreshTeam` flag to `upsertPlayers` (cleanest long-term, but
new conditional logic on the shared write path for a one-off run).

Note: `sync:players` throttles at `FREE_TIER_THROTTLE_MS` (13 s), so it takes
roughly 12 minutes for ~57 pages. Left as-is per the throttle decision below.

## Change 4 — Throttle stays at 1100 ms

Recorded as a deliberate non-change. `THROTTLE_MS = 1100` and its comment cite
a 60 req/min ALL-STAR ceiling, but the key's live response headers report
`x-ratelimit-limit: 600`. Dropping to ~150 ms would cut the run from ~1–1.5
hours to ~20 minutes, and `bdlFetch` already honours `Retry-After` on 429 and
backs off on 5xx.

**CJ elected to leave it at 1100 ms** (2026-07-28) rather than change the
production sync path as part of a backfill.

The value stays, but the comment above it is factually wrong and should be
corrected to record the real 600 req/min ceiling and note that 1100 ms is a
deliberately conservative choice, not a limit. Leaving a known-false comment
in place would mislead the next reader into believing the headroom does not
exist.

## Execution

Seasons run sequentially inside `syncBalldontlie`. Per season: fetch stats →
upsert players → upsert game logs → aggregate and upsert season stats → fetch
advanced → upsert advanced logs.

Expect roughly 400 pages per endpoint per season at ~1.1 s/page ≈ 8 min per
endpoint, so **~15 min per season and ~1–1.5 hours for the four**, plus ~12
min for `sync:players`.

Resumability needs no new work. `upsertGameLogs` and `upsertAdvancedGameLogs`
delete and re-insert scoped to the incoming `(season, seasonType)` pairs
inside one transaction, so re-running any single year is idempotent and a
mid-run failure is recovered by re-running that year alone.

Projected growth: ~160k game logs (~66 MB) and ~120k advanced logs (~43 MB),
taking the database from 177 MB to roughly **290 MB** — well inside Pro's
8 GB.

## Testing

Unit tests, co-located per the repo convention:

- `schemas.test.ts` — a stat row with every counting field `null` parses; a
  row missing `player` or `game` still fails.
- `transform.test.ts` — `toGameLogInput` coalesces each nullable field to `0`;
  `aggregateSeasonStats` does not count a coalesced all-null row toward
  `gamesPlayed`.
- `constants.test.ts` — `BACKFILL_SEASON_YEARS` starts at `"2016"` and spans
  ten seasons through `SEASON_YEAR`.
- `searchParams.test.ts` — `SEASON_OPTIONS` has ten entries newest-first,
  `"2016-17"` is an accepted `?season=` value and `"2015-16"` is not.

`sync.test.ts` must stay green unchanged; the fetch/persist orchestration is
not being modified.

## Verification after the run

1. `select season, count(*) from "PlayerGameLog" group by 1 order by 1` — ten
   seasons, 2016-17 through 2025-26.
2. Same grouping on `PlayerAdvancedGameLog` — 2016-17 onward present.
3. Spot-check one 2016-17 season line against Basketball-Reference (points,
   rebounds, assists, games played) to confirm the aggregation is sane and the
   DNP coalescing did not distort totals.
4. Confirm `Player.teamAbbr` reflects 2025-26 rosters after `sync:players` —
   e.g. Anthony Edwards (id 3547238) should be MIN, not his 2019 team.
5. Load `/players` and confirm the season dropdown offers 2016-17 and renders
   a chart for a player active that season.

## Risks

- **Mid-run failure.** Mitigated by per-season idempotency; re-run the year.
- **Forgetting `sync:players`.** Leaves team pages showing 2019 rosters. The
  two commands must be run as a pair; called out in the plan and in the
  verification checklist above.
- **Unexpected null shapes in an unsampled season.** Sampling covered 2016 and
  2019 but not every page of every year. The `.nullable()` change covers all
  fourteen counting stats uniformly rather than only the ones observed null,
  so an unsampled combination is already handled.
- **Micro compute (2 cores, 1 GB RAM) under large transactions.** The existing
  1000-row `createMany` chunking and 120 s transaction timeout already carry
  43k-row seasons; 2016-2019 seasons are comparable.
