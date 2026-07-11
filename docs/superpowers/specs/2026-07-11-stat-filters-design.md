# Player stat mode + timeframe filters — design

Date: 2026-07-11
Status: Approved
Depends on: `docs/superpowers/specs/2026-07-10-player-stats-chart-design.md`
(`/players/[playerId]` page, `PlayerStatChart`, `src/lib/stats/cumulative.ts`)

## 1. Context and goal

The player page charts season-to-date cumulative averages only. Goal: let the
user re-shape the chart along two axes — **stat mode** (per-game averages,
accumulating totals, per-36-minutes rates) and **timeframe** (last 10/20/30
games, or the entire season to date).

Filter state lives in the URL (shareable, back/forward-friendly) and is
managed by **nuqs** (<https://nuqs.dev/>) on both server and client, so the
series keeps being computed server-side and the chart keeps receiving plain
serializable props.

## 2. Scope

**In scope**

- `nuqs` dependency (exact-pinned) + `NuqsAdapter` in the root layout.
- Shared param contract in `src/lib/stats/searchParams.ts`.
- `buildStatSeries({ logs, mode })` generalizing `buildCumulativeSeries`.
- Timeframe windowing in the page (slice before building).
- `PlayerStatFilters` client component (segmented chips for mode + span).
- Mode-aware `PlayerStatChart` (panel title, value formatting, MIN handling).
- Co-located tests; green `bun run system-check`.

**Out of scope**

- Per-game (non-cumulative) scatter/bars, season selection, multi-player
  comparison, persisting filter prefs.

## 3. URL contract

On `/players/[playerId]`:

- `mode`: `avg` (default) | `totals` | `per36`
- `span`: `10` | `20` | `30` | `season` (default)

Both are `parseAsStringLiteral(...).withDefault(...)`; invalid values fall
back to the default (never a 404) and defaults are omitted from the URL
(nuqs `clearOnDefault`).

`src/lib/stats/searchParams.ts` is the single definition: parsers, derived
`StatMode` / `StatSpan` union types, and a `createLoader` wrapper
(`loadStatFilters`) for the RSC page. Client and server both import from it
so the contract cannot drift.

## 4. Series math — `src/lib/stats/cumulative.ts`

`buildCumulativeSeries` generalizes to `buildStatSeries({ logs, mode })`,
keeping the `CumulativePoint` output shape and the single-`reduce`
accumulation of running totals:

- `avg` — point N = (Σ games 1..N) / N (current behavior, unchanged).
- `totals` — point N = Σ games 1..N.
- `per36` — point N = (Σ stat 1..N ÷ Σ minutes 1..N) × 36; `null` while the
  minutes total is 0. `min` itself is emitted as the running minutes total
  (the chip is disabled in this mode — see §6).
- Shooting percentages are **ratio-of-sums in every mode** — a "total" or
  "per-36" of a percentage is not meaningful.

## 5. Timeframe windowing

The page slices logs before building: `span === "season" ? logs :
logs.slice(-span)`. The accumulation restarts inside the window
(recompute-within-window — "last 10 games averages" means the math sees only
those 10 games). Fewer games than the span simply means the window is the
whole season.

## 6. UI

### 6.1 Page — `players/[playerId]/page.tsx` (RSC)

Awaits `searchParams` through `loadStatFilters`, slices by span, calls
`buildStatSeries`, renders `PlayerStatFilters` above the chart and passes
`series` + `mode` to `PlayerStatChart`.

### 6.2 `PlayerStatFilters` — `src/components/PlayerStatFilters/` (client)

Two segmented chip groups: **Avg · Totals · Per 36** and **L10 · L20 · L30 ·
Season**. `useQueryStates` with `shallow: false` (server recompute) and
`startTransition` for a pending state (`data-pending`/`aria-busy`, same
pattern as `PlayersSearchControls`). Buttons carry `aria-pressed`; styling
via SCSS module using global tokens.

### 6.3 `PlayerStatChart` mode awareness

- New `mode: StatMode` prop.
- Counting-panel title by mode: "Per-game averages" / "Accumulating totals" /
  "Per 36 minutes".
- Counting values format 0 dp in `totals` mode, 1 dp otherwise; percentages
  always 1 dp + `%`.
- In `per36` mode the MIN chip is disabled (per-36 minutes is the constant 36) and MIN is excluded from the plot.

## 7. Error handling

Invalid `mode`/`span` values parse to defaults. Empty window cannot occur
(span ≥ 10 and the page already renders an empty state for zero logs).

## 8. Testing

- `cumulative.test.ts`: golden cases per mode — totals sums, per-36 math,
  per-36 `null` at zero minutes; existing avg cases unchanged.
- `searchParams.test.ts`: defaults, literal parsing, invalid → default.
- `PlayerStatFilters.test.tsx`: renders groups, `aria-pressed` reflects URL
  state, clicking updates the query (via `withNuqsTestingAdapter`).
- `PlayerStatChart.test.tsx`: title/formatting per mode; MIN disabled in
  per36.
- Page test: `?mode=totals&span=10` produces a 10-point summed series.
