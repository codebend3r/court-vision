# Fantasy Value tab

Populate the Fantasy Value tab on `/players` with a method-comparison table:
**one sortable column per valuation method** (Z-Score, G-Score, Points, VORP,
Pos VORP, and a blocked SGP placeholder — PRD §9.3) for every player, with
punt/weight controls, league settings, and instant client-side recomputation.
Companion to `PRD/PRD-valuation-engine.md` v0.2, which owns the math; this
spec owns the tab. (Revised 2026-07-23 per CJ's direction: the original
single-method layout with per-category contribution columns was replaced by
method columns.)

## Approaches considered

- **A. Server-rendered like the existing tabs.** Config in URL, every change
  is a server round trip, Link-based sorting. Consistent with
  Regular/Advanced, but weight sliders are continuous: each tweak would pay a
  server navigation, and folding config into `unstable_cache` keys makes
  cache cardinality unbounded. Fails the PRD's "results update instantly"
  goal.
- **B. Client-computed over a server-cached pool (chosen).** A server
  component loads the window's stat lines (cached by `range` only) and passes
  them to a client component that does pool statistics, weighting, modifier
  shifts, sorting, filtering, and pagination in memory. (Implementation
  refinement: pool size depends on `teams × slots`, which is user config, so
  μ/σ computation moved client-side too — the cached tier is the DB fetch
  alone, and `basis` dropped out of the cache key.) First paint still renders on
  the server via normal RSC serialization of the client component's initial
  props, so there is no blank-then-hydrate flash. Payload ≈ pool-sized rows ×
  9 primitives + identity fields, tens of KB.
- **C. API route + SWR fetching.** Adds a fetch waterfall and a client data
  layer for no benefit over B; rejected.

## Data flow

```
app/players/page.tsx (tab === "fantasy")
  └─ loadFantasySearchParams(searchParams)      // nuqs createLoader, server
  └─ getFantasyPool({ range })                   // lib/valuation/loader.ts
     • unstable_cache, key ["fantasy:pool", range],
       tags ["players"], revalidate 300 — same regime as searchCached.ts.
     • Never includes user config in the key (weights are continuous).
  └─ <FantasyValueView lines={…} />              // client component
       ├─ useQueryStates(fantasyParsers)         // nuqs, adapter already in layout
       ├─ valuePlayers (pool stats + zscore)     // useMemo on [lines, config]
       ├─ sort → filter(q) → paginate            // in memory
       └─ renders controls + table + legend
```

- **Season:** latest season, matching the existing tabs' `take: 1` desc
  convention. A season picker is out of scope until `/players` itself grows
  one.
- **Rows displayed:** every player with ≥1 appearance (minutes > 0) in the
  window. Pool membership (per PRD §5.1) only determines the statistics;
  non-members are scored against the pool and appear in the ranking.
- `PlayersTabs` drops the "Soon" badge; the `ComingSoonPanel` branch in
  `page.tsx` is replaced by the flow above.

## URL state (nuqs)

Parsers and serializers live in `src/lib/valuation/searchParams.ts`, shared
between the server loader (`createLoader`) and the client
(`useQueryStates`) — CJ's established nuqs pattern. All params are omitted at
their defaults so `/players?tab=fantasy` stays clean.

| Param          | Values / default                                                                    | Shallow   | Why                                       |
| -------------- | ----------------------------------------------------------------------------------- | --------- | ----------------------------------------- |
| `range`        | existing values, `all`                                                              | **false** | new pool data from server                 |
| `mode`         | existing values, `average`                                                          | true      | is the PRD's `basis`; applied client-side |
| `q`            | existing, `""`                                                                      | true      | client filters the in-memory pool         |
| `page`, `size` | existing, 1 / 50                                                                    | true      | client paginates                          |
| `sort`         | `z` \| `g` \| `points` \| `vorp` \| `pos` \| `firstName` \| `lastName`; default `z` | true      | client sorts (one key per method column)  |
| `dir`          | `asc`/`desc`, default `desc`                                                        | true      | client sorts                              |
| `x`            | comma list of excluded categories, default none                                     | true      | full category exclusion                   |
| `w`            | comma list `cat:weight` for weights ≠ 1, e.g. `w=ft:0,tov:0.5`                      | true      | punt/weight state                         |
| `base`         | `mean` \| `repl`, default `mean` (Phase 2)                                          | true      | replacement modifier                      |
| `budget`       | integer, default 200 (Phase 2, only with `base=repl`)                               | true      | auction $                                 |
| `teams`        | 2–30, default 12                                                                    | true      | league settings                           |
| `slots`        | 1–25, default 13                                                                    | true      | league settings                           |
| `pos`          | `1` to enable positional modifier (Phase 4)                                         | true      | modifier toggle                           |

Parsing is strict: unknown categories, weights outside `[0, 2]`, or
off-step values snap to the nearest legal value rather than erroring. The
`minimums` param is ignored on this tab (pool thresholds replace it, PRD
§5.4). `sort`/`dir`/`q`/`page`/`size` deliberately reuse the existing names
so tab-switch links and user habits carry over; the fantasy parser owns their
fantasy-specific domains. `parsePlayersSearchParams` stays untouched for the
other two tabs; `page.tsx` branches to the fantasy loader before reaching it.

## Controls

Rendered above the table, in order:

1. **Search / Games / Stats filters live inside `FantasyControls`** rather
   than reusing `PlayersSearchControls` (implementation refinement: that
   component navigates via `buildPlayersHref`, which rebuilds the URL from
   its own props and would wipe every fantasy param). Same visual controls:
   debounced search, Games range select, Averages/Totals select; the
   qualifying-minimums switch never appears on this tab.
2. **`FantasyControls`** (new client component) — a single controls card.
   There is **no method picker**: every method renders as its own column
   simultaneously, and `lib/valuation/registry.ts` (key, label, description,
   formula, availability + unavailability reason) feeds the column headers,
   tooltips, and legend instead.
   - **Category chips.** One chip per category in table order. Click toggles
     punt: weight 1 ↔ 0. Punted chips render struck-through in the muted
     ink. A chip's overflow action (small "×" on hover/focus) fully excludes
     the category (`x` param), removing its column; excluded categories
     reappear from a trailing "+ Add" chip. Distinction per PRD §7: punt =
     visible with no effect; exclude = gone.
   - **Weights disclosure.** A `<details>` row ("Weights") expands to a
     grid of steppers, one per included category, `0–2` step `0.25`,
     default 1. A "Reset" button clears `w` and `x`. Chips and steppers are
     two views of the same `w` state.
   - **League disclosure.** A `<details>` row ("League") with Teams and
     Roster slots number inputs. Phase 2 adds the Baseline segmented control
     (Average player / Replacement) and, when Replacement is active, the
     Budget input and the $ column. Phase 2 also adds the league-format
     select that powers the PRD §11 format-mismatch warning banner.

All state changes go through `useQueryStates` — no local component state for
anything URL-addressable, so every view is shareable and back/forward works.

## Table

Extends the existing table pattern (`.tableScroller`, sortable `<th>`,
`aria-sort`, `data-sort-active` column highlight, rank column). Headers are
buttons wired to nuqs instead of `<Link>`s, since sorting is client-side.

Columns, in order:

| Column            | Notes                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `#`               | rank in current sort; deterministic tie-break sorted metric, then `playerId` asc (PRD §8)          |
| First / Last name | avatar + link to player page, sortable, same as existing tabs                                      |
| Team, Position    | same as existing tabs                                                                              |
| **Z-Score**       | default sort desc; one decimal, signed                                                             |
| **G-Score**       | one decimal, signed                                                                                |
| **Points**        | default points-league scoring, per-game or total per `mode`; one decimal, unsigned                 |
| **VORP**          | Z-Score minus replacement at teams × slots; one decimal, signed                                    |
| **Pos VORP**      | Z-Score minus the per-position replacement (lowest eligible level); one decimal, signed            |
| **SGP**           | blocked placeholder: muted header, `—` cells, tooltip explains the missing denominators (PRD §9.3) |

- Every method column header carries a tooltip (name, description, formula)
  fed by `lib/valuation/registry.ts`.
- Punting/excluding categories reshapes the category-based columns (Z-Score,
  G-Score, VORP, Pos VORP); Points ignores them by design.
- Negative scores render in the danger/negative token color; positive in
  default ink. Flat text color only — no backgrounds, no glows (design
  language rule).
- Pagination: **`FantasyPager`**, visually identical to `PlayersPager` but
  button-driven through nuqs (`page` is shallow; Links would trigger a
  pointless server round trip on a `force-dynamic` page).

## Tooltips and legend

Reuses the Advanced tab's explain-in-place system wholesale:

- **Header tooltips** via the shared `tooltip-bubble` mixin: each category
  header explains "weighted Z-Score contribution from points" with the
  formula (`(PTS − pool avg) ÷ pool std dev × weight`); the VAL header
  explains the active method. Metadata lives beside the engine
  (`lib/valuation/registry.ts` for methods; category meta in
  `lib/valuation/categories.ts`) so headers, tooltips, and legend render from
  one source, mirroring `advancedStatMeta.ts`.
- **`FantasyValueLegend`**, patterned on `AdvancedStatsLegend`: a collapsed
  `<details>` card under the table — "How is value calculated?" — explaining
  the active method, the pool (size, thresholds, window), the ratio-impact
  form, and what punting does. Content switches with `vm`.

## Warnings and empty states

Rendered as a flat bordered notice above the table (no new component if
`ComingSoonPanel`'s card style generalizes; otherwise a small
`FantasyNotice`):

- **Tiny pool** (< 2 pool members after thresholds): neutral values notice
  (PRD §11), table still renders identity columns.
- **All categories excluded:** table shows zeros; notice prompts re-adding a
  category; the "+ Add" chip pulses once (respecting `prefers-reduced-motion`).
- **Format mismatch** (Phase 2): points method + category league or vice
  versa.
- **No players in window:** reuse the existing `renderSummary` empty copy.

## Visual design

Follows the established retro language: long-text-shadow display type for the
tab's section furniture via the existing mixin, flat accent borders for
active states (chips, segmented controls), no glows anywhere, all colors /
spacing / radii from `styles/globals.scss` tokens. Component styles in
co-located `*.module.scss`, grid + `gap` layout, no margins for spacing, no
bare divs. Controls card and table reuse the existing table/controls tokens
so the three tabs read as one surface.

## Module map (new files)

```
src/lib/valuation/            // engine per PRD §9.2 (types, pool, categories,
                              // registry, searchParams, methods/, modifiers/)
src/lib/valuation/loader.ts   // server-only: getFantasyPool + unstable_cache
src/components/FantasyValueView/     // client orchestrator (state, memoized scoring)
src/components/FantasyControls/      // method picker, chips, weights, league
src/components/FantasyValueTable/    // table + sortable headers
src/components/FantasyValueLegend/   // details card
src/components/FantasyPager/         // nuqs-driven pager
```

`FantasyValueView` holds the `useQueryStates` call and passes plain props
down, so `FantasyControls`/`FantasyValueTable` stay presentational and
testable without URL machinery.

## Testing

Co-located, per repo convention:

- **Engine** (covered by PRD §10's automated validation suite): golden
  fixture of a small hand-computed pool for zscore; property tests for
  dollar conservation and tie-break determinism; punt-flow and invariance
  tests against a season-snapshot fixture.
- **`searchParams.test.ts`:** parse/serialize round-trips; illegal weights
  snap to legal values; defaults omit from URLs; excluded/punted encoding.
- **`FantasyValueView.test.tsx`:** renders rows from primitives; punting FT%
  dims the column and re-ranks; sort toggles `aria-sort`; excluded category
  removes its column.
- **`FantasyControls.test.tsx`:** chip click cycles punt; stepper clamps to
  `[0, 2]`; reset clears; method picker hidden with a single registry entry.
- **`page.test.tsx`:** fantasy tab renders the table (not the
  ComingSoonPanel) and passes range/mode through to the loader.

## Phase alignment

Phase 1 ships everything above except: method picker visibility (single
method), `$`/baseline/budget/format controls (Phase 2), G-Score registry
entry (Phase 3), `pos` toggle and `valuedAtPosition` display (Phase 4), SGP
(Phase 5). All later phases land as registry entries plus small control
additions — no table or state-model changes.
