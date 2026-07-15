# Player Season Dropdown (Spec Alignment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the shipped player season dropdown with the approved spec (`docs/superpowers/specs/2026-07-15-player-season-dropdown-design.md`): literal-validated `?season=` in `lib/stats/searchParams.ts`, requested-season-wins resolution, dropdown in the header meta line, career span label, and the span filter relabeled "All".

**Architecture:** The `season` param joins `mode`/`span` in `statFilterParsers` (single `useQueryStates` contract for server and client). `lib/players/seasonScope.ts` is deleted; its consumers (`SeasonSelect`, the player page) move to the new vocabulary. Game logs are fetched pre-filtered by the resolved season in the Prisma query rather than filtered in JS.

**Tech Stack:** Next.js RSC, nuqs (`parseAsStringLiteral`), Prisma, Vitest + Testing Library, SCSS modules.

## Global Constraints

- Commit subjects start with `CV:` (cv-commit-format skill); no AI attribution anywhere.
- No en/em dashes in any output, including code, comments, and UI copy. The spec's career label example "2020-21 – 2025-26" is rendered as "2020-21 to 2025-26".
- Type aliases only, no interfaces; no `any`; no type casts.
- Prefer `reduce`/`map`/`filter` over loops; `?.` always paired with `??`.
- SCSS modules with token values from `styles/globals.scss`; grid + gap over margins.
- Single object parameters over positional parameters.
- All scripts through Bun (`bun run test`, `bun run lint`).

## Deliberate deviations from the old draft (0286526)

- Keep main's `aggregateCareerTotals` + `buildCareerAverageLine({ totals })` API in `seasonAverages.ts` (already shipped with tests; equivalent to the spec's "career card line built by summing the player's own season rows").
- Keep main's dynamic empty message `No game logs for this {season|player} yet.` (the draft used a fixed string).
- Career span label uses "to" instead of an en dash.

---

### Task 1: Season vocabulary in `lib/stats/searchParams.ts`

**Files:**

- Modify: `src/lib/stats/searchParams.ts`
- Test: `src/lib/stats/searchParams.test.ts`

**Interfaces:**

- Produces: `CAREER = "career"`, `SEASON_OPTIONS: readonly string[]` (newest first, 2025-26 down to 2020-21), `statFilterParsers.season` (literal parser, no default, `string | null`), `resolveSeasonSelection({ requested, playerSeasons }): string`.

- [ ] **Step 1: Extend the tests** — update the two `toEqual` fallback assertions to include `season: null`, and add:

```ts
import {
  gamesForSpan,
  loadStatFilters,
  resolveSeasonSelection,
  SEASON_OPTIONS,
} from "@/lib/stats/searchParams";

it("parses every known season label and the career sentinel", async () => {
  expect((await loadStatFilters({ season: "2025-26" })).season).toBe("2025-26");
  expect((await loadStatFilters({ season: "2020-21" })).season).toBe("2020-21");
  expect((await loadStatFilters({ season: "career" })).season).toBe("career");
});

it("rejects seasons outside the backfill window", async () => {
  expect((await loadStatFilters({ season: "2019-20" })).season).toBeNull();
  expect((await loadStatFilters({ season: "bogus" })).season).toBeNull();
});

describe("SEASON_OPTIONS", () => {
  it("lists every backfilled season newest first", () => {
    expect(SEASON_OPTIONS[0]).toBe("2025-26");
    expect(SEASON_OPTIONS[SEASON_OPTIONS.length - 1]).toBe("2020-21");
    expect(SEASON_OPTIONS).toHaveLength(6);
  });
});

describe("resolveSeasonSelection", () => {
  it("honors an explicit request over the player's seasons", () => {
    expect(
      resolveSeasonSelection({ requested: "2021-22", playerSeasons: ["2025-26", "2024-25"] }),
    ).toBe("2021-22");
    expect(resolveSeasonSelection({ requested: "career", playerSeasons: ["2025-26"] })).toBe(
      "career",
    );
  });

  it("defaults to the player's most recent season with data", () => {
    expect(resolveSeasonSelection({ requested: null, playerSeasons: ["2023-24", "2022-23"] })).toBe(
      "2023-24",
    );
  });

  it("falls back to the current league season when the player has none", () => {
    expect(resolveSeasonSelection({ requested: null, playerSeasons: [] })).toBe("2025-26");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bun run test src/lib/stats/searchParams.test.ts` fails (no `SEASON_OPTIONS` export).

- [ ] **Step 3: Implement** — in `src/lib/stats/searchParams.ts`, import from constants and add below `DEFAULT_SPAN`:

```ts
import {
  BACKFILL_START_YEAR,
  SEASON_LABEL,
  SEASON_YEAR,
  seasonLabelFromYear,
} from "@/lib/balldontlie/constants";

export const CAREER = "career";

// Every season label the database can hold (newest first), bounded by the
// backfill window; these are the only seasons a ?season= value could name.
export const SEASON_OPTIONS: readonly string[] = Array.from(
  { length: Number(SEASON_YEAR) - BACKFILL_START_YEAR + 1 },
  (_, index) => seasonLabelFromYear(Number(SEASON_YEAR) - index),
);

const SEASON_SELECTIONS: readonly string[] = [...SEASON_OPTIONS, CAREER];
```

Add `season: parseAsStringLiteral(SEASON_SELECTIONS)` to `statFilterParsers` (update the comment above it: the contract is now `?mode=&span=&season=`; `season` has no static default, absent resolves per player via `resolveSeasonSelection`). Then:

```ts
// Requested season (already literal-validated) wins even if the player never
// played it; otherwise the player's most recent season with data; otherwise
// the current league season so an empty page still labels itself sensibly.
export const resolveSeasonSelection = ({
  requested,
  playerSeasons,
}: {
  requested: string | null;
  playerSeasons: readonly string[];
}): string => requested ?? playerSeasons[0] ?? SEASON_LABEL;
```

- [ ] **Step 4: Verify pass** — `bun run test src/lib/stats/searchParams.test.ts` all green.
- [ ] **Step 5: Commit** — `CV: add season vocabulary to stat search params`

### Task 2: `SeasonSelect` binds the shared parsers and injects unplayed seasons

**Files:**

- Modify: `src/components/SeasonSelect/SeasonSelect.tsx`
- Modify: `src/components/SeasonSelect/SeasonSelect.module.scss`
- Test: `src/components/SeasonSelect/SeasonSelect.test.tsx`

**Interfaces:**

- Consumes: `CAREER`, `statFilterParsers` from Task 1.
- Produces: `SeasonSelect({ seasons, value })`, a bare `<select aria-label="Season">` sized for the header meta line; options are `seasons` in given order, plus the requested-but-unplayed season injected first when `value` is not in `seasons`, plus Career last.

- [ ] **Step 1: Rewrite the test** to the draft's five cases: ordered options plus Career; server-resolved value selected; unplayed value injected first; picking a season writes `?season=`; picking Career writes the sentinel and keeps `?mode=totals`. All queries use `getByRole("combobox", { name: "Season" })`.
- [ ] **Step 2: Verify failure** — injection case fails against the current component.
- [ ] **Step 3: Implement** — replace the component body:

```tsx
"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import { CAREER, statFilterParsers } from "@/lib/stats/searchParams";

import styles from "@/components/SeasonSelect/SeasonSelect.module.scss";

export type SeasonSelectProps = {
  seasons: readonly string[];
  value: string;
};

// The header's season picker. `value` is the server-resolved selection (the
// URL param may be absent while a default season is showing), so the select
// is controlled from props rather than from the param itself.
export function SeasonSelect({ seasons, value }: SeasonSelectProps) {
  const [isPending, startTransition] = useTransition();
  // shallow: false re-runs the RSC page so logs, card, and games count are
  // refetched for the picked season; the transition drives the pending state.
  const [, setFilters] = useQueryStates(statFilterParsers, {
    shallow: false,
    startTransition,
  });

  // A hand-edited URL can request a league season the player never played;
  // without a matching option the controlled select would display the first
  // season while showing another season's (empty) data.
  const optionSeasons = value === CAREER || seasons.includes(value) ? seasons : [value, ...seasons];

  return (
    <select
      value={value}
      onChange={(event) => setFilters({ season: event.target.value })}
      aria-label="Season"
      aria-busy={isPending}
      data-pending={isPending ? "true" : "false"}
      className={styles.select}
    >
      {optionSeasons.map((season) => (
        <option key={season} value={season}>
          {season}
        </option>
      ))}
      <option value={CAREER}>Career</option>
    </select>
  );
}
```

SCSS shrinks to a single class (keep the `control-field` mixin, drop the wrap/label):

```scss
@use "@/styles/mixins" as *;

.select {
  @include control-field;
  cursor: pointer;
  transition: opacity var(--duration-base) var(--ease-out);

  &[data-pending="true"] {
    opacity: 0.6;
  }
}
```

- [ ] **Step 4: Verify pass** — `bun run test src/components/SeasonSelect/SeasonSelect.test.tsx`.
- [ ] **Step 5: Commit** — `CV: bind SeasonSelect to the shared stat filter parsers`

### Task 3: Page resolution, scoped queries, header dropdown; delete `seasonScope`

**Files:**

- Modify: `src/app/players/[playerId]/page.tsx`
- Delete: `src/lib/players/seasonScope.ts`, `src/lib/players/seasonScope.test.ts`
- Test: `src/app/players/[playerId]/page.test.tsx`

**Interfaces:**

- Consumes: `CAREER`, `loadStatFilters`, `resolveSeasonSelection` (Task 1); `SeasonSelect` (Task 2); existing `aggregateCareerTotals`, `buildCareerAverageLine`, `buildSeasonAverageLine`; `SEASON_LABEL`, `SEASON_TYPE` from `lib/balldontlie/constants`.

- [ ] **Step 1: Update the page tests** (port the draft tests, adjusted):
  - `season: null` never appears in assertions (page tests assert rendering + Prisma calls).
  - Extend `buildSeasonRow` with an optional `season = "2025-26"` param.
  - New: "filters the logs to the player's latest season by default" (asserts `where: { playerId, season: "2023-24" }` and combobox value).
  - New: "honors an explicit season param even if the player never played it" (asserts `where: { playerId, season: "2021-22" }`, combobox "2021-22", and the empty message "No game logs for this season yet.").
  - New: "aggregates a rank-less career card spanning the played seasons" (asserts `where: { playerId }` only, "Career averages", span label "2024-25 to 2025-26", "20.0", no "in NBA" pills, combobox "career").
  - Replace the old dropdown/career tests that relied on JS filtering of an all-logs fetch (`renders the season dropdown...`, `scopes the header...`, `aggregates every season...`).
  - Existing no-season-rows tests keep passing via the static meta text fallback (selection resolves to "2025-26").
- [ ] **Step 2: Verify failures** — `bun run test "src/app/players/[playerId]/page.test.tsx"`.
- [ ] **Step 3: Rewrite the page data flow** (port draft structure, keep main's card API):
  - Replace `loadSeasonScope`/`resolveSeasonScope`/`seasonScopeValue` imports with `CAREER`, `resolveSeasonSelection` from `@/lib/stats/searchParams` and `SEASON_LABEL`, `SEASON_TYPE` from `@/lib/balldontlie/constants`; drop local `SEASON_TYPE`/`FALLBACK_SEASON`.
  - `const { mode, span, season: requestedSeason } = await loadStatFilters(searchParams ?? Promise.resolve({}));`
  - `playerSeasons` = deduped seasons of `playerSeasonRows` (fetched first, newest first).
  - `const selection = resolveSeasonSelection({ requested: requestedSeason, playerSeasons }); const isCareer = selection === CAREER;`
  - Logs query: `where: isCareer ? { playerId: numericId } : { playerId: numericId, season: selection }`.
  - Stat line: career keeps `aggregateCareerTotals` + `buildCareerAverageLine({ totals })`; season keeps the pool query with `season: selection`.
  - Career span label from own rows: oldest "to" newest, single season plain, no rows falls back to `SEASON_LABEL`.
  - Header meta: seasons exist renders `<SeasonSelect seasons={playerSeasons} value={selection} />` plus `<span>{gamesPlayed} games</span>`; no seasons renders the static `{isCareer ? "Career" : selection} · {gamesPlayed} games`. Remove the standalone `<SeasonSelect>` block below the header.
  - Card: `season={isCareer ? careerSpanLabel : selection}`, title unchanged.
  - Experience fact uses `Number.parseInt(SEASON_LABEL, 10)`.
  - Empty message stays dynamic (`this season` / `this player`).
- [ ] **Step 4: Delete `seasonScope.ts` + `seasonScope.test.ts`**; `grep -rn seasonScope src/` returns nothing.
- [ ] **Step 5: Verify pass** — page, SeasonSelect, and full `bun run test`; `bun run lint`.
- [ ] **Step 6: Commit** — `CV: honor requested seasons and move the dropdown into the header`

### Task 4: Span filter label reads "All"

**Files:**

- Modify: `src/components/PlayerStatFilters/PlayerStatFilters.tsx`
- Test: `src/components/PlayerStatFilters/PlayerStatFilters.test.tsx`

- [ ] **Step 1: Update tests** — replace `"Season"` with `"All"` in the two label assertions (`renders both segmented groups`, `presses the defaults`).
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement** — change `season: "Season"` to `season: "All"` in `SPAN_LABELS`, with the comment: the window applies to the whole current selection (a single season or the career), so "Season" would read wrong in the career view.
- [ ] **Step 4: Verify pass** — `bun run test src/components/PlayerStatFilters/PlayerStatFilters.test.tsx`.
- [ ] **Step 5: Commit** — `CV: relabel the season span filter to "All"`

### Task 5: Full verification

- [ ] `bun run test` (whole suite), `bun run lint`, `bun run build` all green.
- [ ] Commit any straggler fixes; body bullets note the spec alignment.

## Self-Review

- Spec coverage: URL contract (Task 1), requested-wins resolution (Tasks 1, 3), scoped queries + career flow (Task 3), header dropdown placement (Task 3), card span label + title (Task 3), span label "All" (Task 4), constants cleanup (Task 3), all Testing-section cases mapped (searchParams, SeasonSelect, page, PlayerStatFilters; seasonAverages career tests and the SeasonStatCard title default already exist on main).
- No placeholders; types consistent across tasks (`resolveSeasonSelection` object param, `SeasonSelectProps`).
