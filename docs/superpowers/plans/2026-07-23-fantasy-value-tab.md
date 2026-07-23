# Fantasy Value Tab (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Fantasy Value tab on `/players`: Z-Score valuation over the latest season (or lastN window), sortable by total and per-category contribution, with punt/exclude/weight, league-size, search, range, and basis controls — all client-instant, all URL-addressable.

**Architecture:** A cached server loader fetches per-player stat lines for the window (key: `range` only, tag `players`). Everything else — basis, pool selection, μ/σ, z-scores, weights, sorting, filtering, pagination — is pure client math in `lib/valuation`, driven by nuqs URL state. This refines the spec: pool size depends on `teams × slots` (user config), so _all_ math moves client-side and only the DB fetch is cached; `mode` therefore becomes shallow. Task 13 syncs the docs.

**Tech Stack:** Next 16 App Router (RSC + client components), nuqs 2.9 (`NuqsAdapter` already in layout; `nuqs/adapters/testing` for tests), Prisma 7, Vitest + Testing Library, SCSS modules.

## Global Constraints

- Type aliases only, no `interface`; no `any`; no casts; type guards + `unknown`.
- No `for/of`/`for/in`; `Array.prototype` methods; `reduce` preferred.
- `!!` boolean conversion; `&&` over ternary-null; `?.` always paired with `??`.
- Single object parameters, not positional.
- Import via `@/*` aliases; same-dir `./` allowed.
- SCSS modules; tokens from `styles/globals.scss` (`--color-loss` for negatives, `--color-text-muted` for punted, `--space-*`, `--radius-*`, `--font-*`); mixins from `styles/mixins.scss` (`tooltip-bubble`, `control-field`, `micro-label`); grid + `gap`, no margins for spacing, no bare divs, no glows.
- Tests co-located; commit per task with `CV:` subject.
- **Do not touch Regular/Advanced tab behavior**; `parsePlayersSearchParams` stays untouched.

## Locked contracts (used across tasks)

```typescript
// lib/valuation/types.ts
export type CountingCategory = "pts" | "reb" | "ast" | "stl" | "blk" | "tpm" | "tov";
export type RatioCategory = "fg" | "ft";
export type Category = CountingCategory | RatioCategory;
export type Basis = "perGame" | "total";

export type FantasyStatLine = {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  gamesPlayed: number; // appearances (minutes > 0) in window
  minutes: number; // total minutes in window
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg3m: number;
  tov: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number; // window totals
};

export type CategoryContribution = { raw: number; weighted: number };
export type PlayerValue = {
  playerId: number;
  total: number;
  breakdown: Partial<Record<Category, CategoryContribution>>;
};
export type PoolStats = {
  poolSize: number;
  leagueFgPct: number;
  leagueFtPct: number;
  byCategory: Record<Category, { mu: number; sigma: number }>;
};
export type ValuationConfig = {
  categories: Category[]; // included (non-excluded) categories
  weights: Partial<Record<Category, number>>; // absent key = 1
  basis: Basis;
  teams: number;
  rosterSlots: number;
};
```

Key functions each task produces (consumed by later tasks):

- `categories.ts`: `CATEGORY_META: readonly CategoryMeta[]` (ordered: pts reb ast stl blk tpm tov fg ft; `{ key, label, fullName, description, formula, kind: "counting" | "ratio" }`), `CATEGORY_KEYS: readonly Category[]`, `isCategory(v: string): v is Category`, `categoryValue({ line, category, basis, leagueFgPct, leagueFtPct }): number` (TOV negated here; ratio = attempts × (pct − league); perGame divides by gamesPlayed, 0 GP → 0).
- `pool.ts`: `computePoolStats({ lines, basis, poolSize, range }): PoolStats`; internals `attemptWeightedPcts(lines)`, `meanSigma(values)` (two-pass), thresholds `MIN_GP_SHARE = 0.3` of window, `MIN_AVG_MINUTES = 15`; provisional equal-weight z ranking → top `poolSize` → recompute stats on pool. Candidates `< 2` → all sigmas 0.
- `methods/zscore.ts`: `scoreZScore({ lines, poolStats, config }): PlayerValue[]` (σ = 0 → z = 0; weighted = raw × (weight ?? 1); total = Σ weighted over `config.categories`).
- `index.ts`: `valuePlayers({ lines, config, range }): { values: PlayerValue[]; poolStats: PoolStats }` with `poolSize = Math.max(150, teams * rosterSlots)`.
- `registry.ts`: `FANTASY_METHODS` (one entry: zscore, `available: true`), `ENABLED_METHODS`.
- `searchParams.ts`: `fantasyParsers` (nuqs), `loadFantasySearchParams` (createLoader), `FANTASY_SORT_KEYS = ["value", ...CATEGORY_KEYS, "firstName", "lastName"]`, `snapWeight(v): number`, `parseWeights(s): Partial<Record<Category, number>> | null`, `serializeWeights(w): string`.
- `aggregate.ts`: `aggregateWindowLogs({ logs }): WindowTotals` (appearance = minutes > 0).
- `loader.ts`: `getFantasyPool({ range }): Promise<FantasyStatLine[]>` — latest season only, `unstable_cache(["fantasy:pool", range], { tags: ["players"], revalidate: 300 })`.
- Components: `FantasyPager({ page, totalPages, size, onPageChange, onSizeChange })`, `FantasyValueLegend({ poolSize, windowLabel, basis })`, `FantasyValueTable({ rows, sort, dir, onSort, config })` where `rows: FantasyTableRow[] = (FantasyStatLine & { value: PlayerValue; rank: number })[]`, `FantasyControls({ params…, onChange })`, `FantasyValueView({ lines })` (owns `useQueryStates`).

---

### Task 1: Category definitions and per-category primitive

**Files:** Create `src/lib/valuation/types.ts`, `src/lib/valuation/categories.ts`, `src/lib/valuation/categories.test.ts`.

- [ ] Failing tests: meta completeness (9 entries, unique labels, non-empty fields, order); `categoryValue` — counting perGame/total; TOV negation; ratio impact formula vs hand-computed `fga × (pct − league)`; zero attempts → 0; zero GP perGame → 0; `tpm` maps to `fg3m`.
- [ ] Run `bun run test src/lib/valuation/categories.test.ts` → fail (module missing).
- [ ] Implement; run → pass. Commit `CV: valuation category primitives`.

### Task 2: Pool selection and pool statistics

**Files:** Create `src/lib/valuation/pool.ts`, `src/lib/valuation/pool.test.ts`.

- [ ] Failing tests: `meanSigma` hand-checked; attempt-weighted pcts ≠ mean-of-pcts fixture; thresholds drop low-GP/low-minutes players from candidates but scoring set untouched; pool trims to `poolSize` by provisional z; μ/σ recomputed on the trimmed pool (assert differs from candidate-wide σ); `< 2` candidates → all σ 0; σ = 0 category preserved as 0.
- [ ] Run → fail. Implement. Run → pass. Commit `CV: valuation pool selection + stats`.

### Task 3: Z-Score method and public API

**Files:** Create `src/lib/valuation/methods/zscore.ts`, `src/lib/valuation/methods/zscore.test.ts`, `src/lib/valuation/index.ts`, `src/lib/valuation/index.test.ts`.

- [ ] Failing tests: golden 4-player hand-computed fixture (raw z per category, totals); weights scale `weighted` not `raw`; weight 0 keeps `raw`, zeroes `weighted`; excluded category absent from breakdown and total; empty `categories` → totals all 0; σ = 0 → z 0; `valuePlayers` pool floor `max(150, teams*slots)`; determinism (same input → identical output).
- [ ] Run → fail. Implement. Run → pass. Commit `CV: z-score valuation engine`.

### Task 4: Method registry

**Files:** Create `src/lib/valuation/registry.ts`, `src/lib/valuation/registry.test.ts`.

- [ ] Failing tests: zscore entry present with non-empty label/description/formula; `ENABLED_METHODS` = available only.
- [ ] Implement. Run → pass. Commit `CV: valuation method registry`.

### Task 5: Fantasy URL state (nuqs parsers + weights codec)

**Files:** Create `src/lib/valuation/searchParams.ts`, `src/lib/valuation/searchParams.test.ts`.

- [ ] Failing tests: `snapWeight` clamps to [0,2] and snaps to 0.25 steps; `parseWeights("ft:0,tov:0.5")` round-trips; weight 1 entries omitted from serialization; junk (`"ft:x"`, `"nope:1"`) → null (nuqs falls back to default); excluded parser rejects non-categories; teams/slots clamp 2–30 / 1–25; defaults produce empty query string (`createSerializer` output `""`); sort accepts `value`/category/name keys only.
- [ ] Implement with `parseAsStringLiteral`, `parseAsInteger`, `createParser` for weights, `parseAsArrayOf`; export `fantasyParsers`, `loadFantasySearchParams = createLoader(fantasyParsers)`. `range`/`mode` reuse literal values from `@/lib/players/searchParams`; `range` parser gets `.withOptions({ shallow: false })`.
- [ ] Run → pass. Commit `CV: fantasy tab nuqs search params`.

### Task 6: Window aggregation + cached loader

**Files:** Create `src/lib/valuation/aggregate.ts`, `src/lib/valuation/aggregate.test.ts`, `src/lib/valuation/loader.ts`.

- [ ] Failing tests (aggregate): sums stat totals; counts appearances by `minutes > 0` (DNP excluded); empty logs → zeroed line.
- [ ] Implement `aggregate.ts`; implement `loader.ts` (thin, untested like `search.ts`'s prisma layer): latest season via `findFirst` season desc; `range === "all"` → `playerSeasonStats.findMany` for that season joined to player identity; lastN → players with logs in season, per-player `take: N` desc, aggregated via `aggregateWindowLogs`. Wrap in `unstable_cache`.
- [ ] Run aggregate tests → pass. `bun run typecheck`. Commit `CV: fantasy pool loader + window aggregation`.

### Task 7: FantasyPager

**Files:** Create `src/components/FantasyPager/FantasyPager.tsx`, `.module.scss`, `.test.tsx`.

- [ ] Failing tests: renders page X of Y; Previous disabled on 1, Next disabled on last; callbacks fire with next page; size select lists `PAGE_SIZES` and fires `onSizeChange`.
- [ ] Implement: visual twin of `PlayersPager` (same class structure) but callback-driven, no router. Run → pass. Commit `CV: fantasy pager component`.

### Task 8: FantasyValueLegend

**Files:** Create `src/components/FantasyValueLegend/FantasyValueLegend.tsx`, `.module.scss`, `.test.tsx`.

- [ ] Failing tests: renders summary "How is value calculated?"; expanded content names Z-Score, shows pool size and window label, explains ratio impact and punting.
- [ ] Implement patterned on `AdvancedStatsLegend` (`<details>` card). Run → pass. Commit `CV: fantasy value legend`.

### Task 9: FantasyValueTable

**Files:** Create `src/components/FantasyValueTable/FantasyValueTable.tsx`, `.module.scss`, `.test.tsx`.

- [ ] Failing tests: renders rank/name/team/pos/VAL + one column per included category; excluded category column absent; punted column cells carry the dimmed class and show raw value; `aria-sort` on active header; header button click calls `onSort` with the key; negative weighted values get the negative class; VAL formats one decimal signed.
- [ ] Implement: header buttons (not Links) + `tooltip-bubble` header tips fed by `CATEGORY_META` and the zscore registry entry; `data-sort-active` column highlight; rank column only for stat sorts (mirrors existing `isStatSort`).
- [ ] Run → pass. Commit `CV: fantasy value table`.

### Task 10: FantasyControls

**Files:** Create `src/components/FantasyControls/FantasyControls.tsx`, `.module.scss`, `.test.tsx`.

- [ ] Failing tests: search input debounced onChange emits trimmed q; Games range + Averages/Totals selects emit; chip click toggles weight 0↔1; chip × excludes; excluded ghost chip click re-includes; weights stepper snaps and emits; Reset emits cleared `w`/`x`; teams/slots inputs clamp; method picker hidden when one enabled method.
- [ ] Implement: presentational, single `onChange(partial)` prop; controls styled with `control-field`/`micro-label` mixins; chips are per-category `<button>` + small exclude `<button>` in a chip cell; `<details>` for Weights and League.
- [ ] Run → pass. Commit `CV: fantasy controls`.

### Task 11: FantasyValueView (client orchestrator)

**Files:** Create `src/components/FantasyValueView/FantasyValueView.tsx`, `.module.scss`, `.test.tsx` (uses `withNuqsTestingAdapter` from `nuqs/adapters/testing`).

- [ ] Failing tests: renders table rows from `lines`; default sort = VAL desc; punting FT% via chip re-ranks (fixture where a poor-FT big overtakes); q filters client-side; pagination clamps; tiny pool (<2 lines) renders neutral-values notice; all-excluded renders prompt notice; tie on total orders by playerId asc.
- [ ] Implement: `useQueryStates(fantasyParsers)`; memoized `valuePlayers` on `[lines, config]`; sort (value/category [raw when punted]/names, existing nextDir semantics) → filter → clamp/paginate; summary line "Showing X–Y of Z"; composes Controls, Pager (top+bottom), Table, Legend, notices.
- [ ] Run → pass. Commit `CV: fantasy value view orchestration`.

### Task 12: Page wiring

**Files:** Modify `src/app/players/page.tsx` (replace ComingSoon branch: `loadFantasySearchParams` → `getFantasyPool({ range })` → `<FantasyValueView lines={…} />`), `src/components/PlayersTabs/PlayersTabs.tsx` (drop "Soon" badge), `PlayersTabs.test.tsx`, `src/app/players/page.test.tsx` (fantasy tab renders view, not ComingSoonPanel; regular/advanced assertions unchanged).

- [ ] Update tests first → fail; wire; `bun run test` (full) → pass; `bun run lint` + `bun run typecheck`. ComingSoonPanel component itself stays (other usages).
- [ ] Commit `CV: wire fantasy value tab into /players`.

### Task 13: Docs sync + full verification

**Files:** Modify `docs/superpowers/specs/2026-07-23-fantasy-value-tab-design.md` (mode → shallow true with "basis applied client-side"; FantasyControls owns search/range/mode because `PlayersSearchControls` navigation would wipe fantasy params via `buildPlayersHref`; tier-1 = cached DB fetch, math client-side; loader key `range` only), `docs/PRD-valuation-engine.md` §9.1/§9.4 (same refinement).

- [ ] Edit docs; `bun run build`; hit `http://localhost:46644/players?tab=fantasy` (dev server) to eyeball. Commit `CV: sync valuation docs with implementation`.
