# Loading optimization

Date: 2026-10-02. Branch: `loading-optimization`.

## Problem

Filters, sorts, the Advanced tab, and the Fantasy tab were slow on a cold
cache, and every `/players` tab shipped the chart library.

- Prisma's nested `take` does not limit per parent in SQL. A "last 10" stat
  sort fetched all 352k game logs and trimmed them in memory (~3s). The
  Advanced tab fetched all 309k advanced logs (5–7s). The fantasy pool
  fetched a season's ~26k logs to aggregate ~600 lines (~1.2s).
- The players cache key included `page`, `size` and `q`, so every page flip
  or keystroke re-ran that full fetch.
- `FantasyValueView` statically imported both chart layouts, so recharts
  (112KB gzip) loaded on every tab, including the default table views.
- Range, mode, minimums and page size snapped back to their old values until
  the server answered; sort headers showed no pending state.
- The Fantasy tab's Rolling layout spent ~170ms building 50 trends per
  render; Sim Value spent ~12ms in a 582 × 9 × 400 loop.

## Design

### Aggregate in SQL, rank in memory

- `fetchRegularPool`, `fetchAdvancedPool` (`lib/players/search*.ts`) and the
  fantasy loader (`lib/valuation/loader.ts`) aggregate in one tagged
  `$queryRaw` each: a per-player `LATERAL ... LIMIT n` over the
  `(playerId, gameDate)` index, or a `row_number()` window over one season.
  Rows are validated with zod; integer sums are cast to `int4` in SQL.
- `searchCached.ts` caches one pool per range (key: range only, tag
  `players`). `rankPlayers` / `rankAdvancedPlayers` filter, sort, apply
  minimums and page in memory, so after the first view of a range every
  search, sort, filter and page is a cache hit.
- Verified against the old code on live data: 18 players-search cases and
  all 12 fantasy range × season pools are identical (strict deep equality,
  float minutes included: `sum(minutes ORDER BY "gameDate" DESC)` adds in
  the same order the JS reducer did).

### Security scan

- Rule 3 (`raw-prisma-interpolation`) blocked Prisma's parameterized tagged
  template. It now allows bare-identifier placeholders (bound parameters) and
  still flags the Unsafe variants, the call form, expression placeholders,
  and `Prisma.raw`, the one way to splice SQL text into a bound slot.

### Client payload

- Chart layouts load through `next/dynamic` (SSR kept; prefetched on hover or
  focus). `/teams` and home trend plots load client-only behind a same-size
  `ChartPlaceholder`.
- `formatSigned` / `METHOD_LABELS` moved to the recharts-free
  `PlayerFantasyChart/labels.ts`, so the game log table no longer pulls
  recharts in.
- The player page keeps recharts eager: its charts render real SSR content
  on every view.

### Perceived speed

- `useOptimistic` for range, mode, minimums, page and page size; sort headers
  get a `LinkPending` spinner with a status announcement and
  `prefetch={false}`.

### Server waterfalls

- `/players` runs the session check alongside its data read.
- The player page runs session, player, filters and season rows in one
  `Promise.all`.
- `getActiveLeagueRecord` (React `cache`) dedupes the active-league lookup
  across the layout, watchlist reads and pages.
- `/my-teams/[teamSlug]` loads the pool alongside the team lookup.

### Valuation compute

- Sim Value counts wins by binary search over sorted draws (12 → 3.4ms).
- Rolling trends score only the kept games and share each window between Z
  and G (170 → 6ms), memoized in `RollingRows`. Both are verified
  bit-identical against verbatim copies of the old code in tests.

### Web Workers

Not adopted. After the two algorithm fixes nothing on the client exceeds a
frame budget, SSR would still need a synchronous path, and the alias lint
rule forbids the relative `new URL()` a worker entry needs. Revisit if a
4×-throttled profile still shows long tasks; the boundary would be
`valuePlayers({ lines, config, methodWeights, range })`.

## Results (`next start`, cold data cache, Supabase ~105ms RTT)

| Interaction                                | Before        | After       |
| ------------------------------------------ | ------------- | ----------- |
| Regular stat sort, lastN (cold)            | 2.4–3.0s      | 0.25–0.95s  |
| Advanced tab (cold)                        | 5.2–6.9s      | 0.25–0.55s  |
| Fantasy pool (cold)                        | ~1.2s         | 0.4–0.5s    |
| Page / sort / search within a cached range | full re-fetch | ~20ms       |
| Player page (warm)                         | ~0.3s         | ~0.25s      |
| `/players` JS (gzip)                       | 335KB         | 215KB       |
| `/` and `/teams` JS (gzip)                 | 311 / 299KB   | 198 / 187KB |

## Follow-ups

- `/teams` cold load (~0.9s) is untouched.
- The player career view ships every career game (1.66MB HTML); paginating
  or virtualizing the game log table is the lever.
- `PlayerAdvancedGameLog` has no `(playerId, season)` index; not needed by
  the new queries, but the player page's season-scoped advanced read would
  use it.
- The fantasy league seed applies in a mount effect, which re-values the
  table once after hydration.
