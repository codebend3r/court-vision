# /players Searchable Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/players` route rendering a server-side searched + paginated table of players with a 300 ms-debounced search input, page-size select, retired toggle, and pager — all state in the URL.

**Architecture:** RSC page reads `searchParams`, normalizes them through a pure parser, queries Prisma through a single `searchPlayers` function (with last-page clamping), and renders the table server-side. A client controls component owns the inputs and rewrites the URL via `router.replace` inside `useTransition`; it never fetches data.

**Tech Stack:** Next.js 16 App Router (RSC + one client component), Prisma 7 via `@/lib/prisma`, Vitest + Testing Library (fake timers), SCSS modules.

**Spec:** `docs/superpowers/specs/2026-07-10-players-table-design.md`

## Global Constraints

- Stay on the current branch — do NOT create a new branch (CLAUDE.md rule).
- No `any`, no type casts (`as`) — including `as const`; use explicit type annotations instead (e.g. `Prisma.PlayerWhereInput` from `@generated/prisma/client` makes `mode: "insensitive"` typecheck without a cast).
- `reduce`/array methods, never `for/of` / `for/in`; `?.` always paired with `??`; `!!` for boolean conversion; single object parameter for new functions.
- SCSS modules; every color/space/font-size from `src/styles/globals.scss` tokens; grid + `gap`; no classless divs.
- Tests co-located. Bun only (`bun run test -- <path>`). Commit subjects `CV:` + concise bullets; pre-commit hook runs the full gate.
- Param rules (spec §4.1, exact): `q` trimmed + capped at 100 chars; `page` positive int default 1; `size` ∈ {10, 25, 50, 100} default 25; `retired === "1"` → includeRetired.
- URL serialization (spec §5.2): defaults omitted — `q` omitted when empty, `page` when 1, `size` when 25, `retired` unless true.
- Debounce: exactly 300 ms, timer cleared on new keystroke and on unmount, no navigation when the trimmed value equals the current `q`.
- Default filter: `gameLogs: { some: {} }` unless `includeRetired` (spec §1 — empty until a backfill lands; that's expected).

---

### Task 1: Query layer — `src/lib/players/`

**Files:**

- Create: `src/lib/players/searchParams.ts`, `src/lib/players/search.ts`
- Test: `src/lib/players/searchParams.test.ts`, `src/lib/players/search.test.ts`

**Interfaces:**

- Consumes: `prisma` from `@/lib/prisma`; `Prisma` types from `@generated/prisma/client`.
- Produces (used by Tasks 2–3):
  - `PAGE_SIZES: readonly number[]` = `[10, 25, 50, 100]`; `DEFAULT_PAGE_SIZE = 25`
  - `interface PlayersSearchParams { q: string; page: number; size: number; includeRetired: boolean }`
  - `parsePlayersSearchParams(raw: { q?: string; page?: string; size?: string; retired?: string }): PlayersSearchParams`
  - `interface PlayerRow { id: number; fullName: string; teamAbbr: string | null; position: string | null }`
  - `interface PlayersSearchResult { rows: PlayerRow[]; total: number; page: number }` (`page` = effective page after clamping)
  - `searchPlayers(args: PlayersSearchParams): Promise<PlayersSearchResult>`

- [ ] **Step 1: Write failing parser tests** (`searchParams.test.ts`) — table-driven:

```ts
import { describe, expect, it } from "vitest";

import { parsePlayersSearchParams } from "./searchParams";

describe("parsePlayersSearchParams", () => {
  it("returns defaults for empty input", () => {
    expect(parsePlayersSearchParams({})).toEqual({
      q: "",
      page: 1,
      size: 25,
      includeRetired: false,
    });
  });

  it.each([
    [{ q: "  curry  " }, { q: "curry" }],
    [{ q: "x".repeat(150) }, { q: "x".repeat(100) }],
    [{ page: "3" }, { page: 3 }],
    [{ page: "0" }, { page: 1 }],
    [{ page: "-2" }, { page: 1 }],
    [{ page: "abc" }, { page: 1 }],
    [{ size: "50" }, { size: 50 }],
    [{ size: "33" }, { size: 25 }],
    [{ size: "" }, { size: 25 }],
    [{ retired: "1" }, { includeRetired: true }],
    [{ retired: "true" }, { includeRetired: false }],
  ])("normalizes %j", (raw, expected) => {
    expect(parsePlayersSearchParams(raw)).toMatchObject(expected);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bun run test -- src/lib/players` → FAIL (module not found).
- [ ] **Step 3: Implement `searchParams.ts`:**

```ts
export const PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_QUERY_LENGTH = 100;

export interface PlayersSearchParams {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
}

export const parsePlayersSearchParams = (raw: {
  q?: string;
  page?: string;
  size?: string;
  retired?: string;
}): PlayersSearchParams => {
  const q = (raw.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const parsedPage = Number.parseInt(raw.page ?? "", 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const parsedSize = Number.parseInt(raw.size ?? "", 10);
  const size = PAGE_SIZES.includes(parsedSize) ? parsedSize : DEFAULT_PAGE_SIZE;
  return { q, page, size, includeRetired: raw.retired === "1" };
};
```

- [ ] **Step 4: Write failing search tests** (`search.test.ts`) — mock `@/lib/prisma` with `vi.mock`; the mock exposes `player.findMany`, `player.count`, and `$transaction` (implement `$transaction: vi.fn((ops) => Promise.all(ops))` — Prisma batch form takes an array of promises from the mocked methods). Cases:
  - default view: `findMany` called with `where: { gameLogs: { some: {} } }`, `orderBy: { fullName: "asc" }`, `skip: 0`, `take: 25`, and the exact `select`;
  - with `q: "curry"`: where additionally has `fullName: { contains: "curry", mode: "insensitive" }`;
  - `includeRetired: true`: where has NO `gameLogs` key;
  - clamp: `findMany` first returns `[]` with `count` 30, `page: 9`, `size: 25` → a second `findMany` runs with `skip: 25` and the result carries `page: 2`;
  - `total: 0` returns `{ rows: [], total: 0, page: 1 }` with no second query.
- [ ] **Step 5: Run to verify failure**, then **Step 6: Implement `search.ts`:**

```ts
import { Prisma } from "@generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { PlayersSearchParams } from "./searchParams";

export interface PlayerRow {
  id: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
}

export interface PlayersSearchResult {
  rows: PlayerRow[];
  total: number;
  page: number;
}

const rowSelect = { id: true, fullName: true, teamAbbr: true, position: true };

export const searchPlayers = async (args: PlayersSearchParams): Promise<PlayersSearchResult> => {
  const { q, page, size, includeRetired } = args;
  const where: Prisma.PlayerWhereInput = {
    ...(includeRetired ? {} : { gameLogs: { some: {} } }),
    ...(q === "" ? {} : { fullName: { contains: q, mode: "insensitive" } }),
  };

  const pageQuery = (pageNumber: number) =>
    prisma.player.findMany({
      where,
      select: rowSelect,
      orderBy: { fullName: "asc" },
      skip: (pageNumber - 1) * size,
      take: size,
    });

  const [rows, total] = await prisma.$transaction([
    pageQuery(page),
    prisma.player.count({ where }),
  ]);
  if (rows.length > 0 || total === 0) {
    return { rows, total, page: total === 0 ? 1 : page };
  }
  const lastPage = Math.max(1, Math.ceil(total / size));
  const clamped = await pageQuery(lastPage);
  return { rows: clamped, total, page: lastPage };
};
```

- [ ] **Step 7: Run tests** — `bun run test -- src/lib/players` → PASS; run full `bun run test` once.
- [ ] **Step 8: Commit** — `CV: add players query layer (param parsing + server search)`

---

### Task 2: `PlayersSearchControls` client component

**Files:**

- Create: `src/components/PlayersSearchControls/PlayersSearchControls.tsx`, `src/components/PlayersSearchControls/PlayersSearchControls.module.scss`
- Test: `src/components/PlayersSearchControls/PlayersSearchControls.test.tsx`

**Interfaces:**

- Consumes: `PAGE_SIZES`, `DEFAULT_PAGE_SIZE`, `MAX_QUERY_LENGTH` from `@/lib/players/searchParams`; `useRouter` from `next/navigation`.
- Produces: `PlayersSearchControls(props: { q: string; page: number; size: number; includeRetired: boolean; totalPages: number })` — client component; root element carries `data-pending` + `aria-busy` while a navigation transition is pending (the page's SCSS dims the table via `:has([data-pending="true"])`).

Component behavior (implement exactly):

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useTransition } from "react";

import { DEFAULT_PAGE_SIZE, MAX_QUERY_LENGTH, PAGE_SIZES } from "@/lib/players/searchParams";

import styles from "./PlayersSearchControls.module.scss";

export interface PlayersSearchControlsProps {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
  totalPages: number;
}

const DEBOUNCE_MS = 300;

const buildHref = (args: {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
}): string => {
  const params = new URLSearchParams();
  if (args.q !== "") {
    params.set("q", args.q);
  }
  if (args.page > 1) {
    params.set("page", String(args.page));
  }
  if (args.size !== DEFAULT_PAGE_SIZE) {
    params.set("size", String(args.size));
  }
  if (args.includeRetired) {
    params.set("retired", "1");
  }
  const query = params.toString();
  return query === "" ? "/players" : `/players?${query}`;
};

export function PlayersSearchControls({
  q,
  page,
  size,
  includeRetired,
  totalPages,
}: PlayersSearchControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  const navigate = (href: string) => {
    startTransition(() => router.replace(href));
  };

  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim().slice(0, MAX_QUERY_LENGTH);
      if (trimmed === q) {
        return;
      }
      navigate(buildHref({ q: trimmed, page: 1, size, includeRetired }));
    }, DEBOUNCE_MS);
  };

  // size select: navigate(buildHref({ q, page: 1, size: newSize, includeRetired })) immediately
  // retired checkbox: navigate(buildHref({ q, page: 1, size, includeRetired: !includeRetired })) immediately
  // pager: Prev → page - 1 (disabled when page <= 1); Next → page + 1 (disabled when page >= totalPages); both preserve q/size/includeRetired
  // root: <section className={styles.controls} data-pending={isPending ? "true" : "false"} aria-busy={isPending}>
  // input: <input type="search" defaultValue={q} onChange={onSearchChange} placeholder="Search players…" aria-label="Search players" />
  // size: <select value={size} onChange={...} aria-label="Page size"> {PAGE_SIZES.map(...)} </select>
  // retired: <label><input type="checkbox" checked={includeRetired} onChange={...} /> Include retired players</label>
  // pager: <button type="button" disabled={page <= 1}>Previous</button> <span>Page {page} of {totalPages}</span> <button type="button" disabled={page >= totalPages}>Next</button>
}
```

SCSS: `.controls { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }`; input/select/buttons on `--color-surface` with `--color-border`, `--radius-sm`, `--font-size-sm`; disabled buttons at reduced opacity; checkbox label in `--color-text-muted`.

- [ ] **Step 1: Write failing tests** — mock the router (`const replace = vi.fn(); vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));`), `vi.useFakeTimers()` in `beforeEach` (+ `vi.useRealTimers()` after), local `afterEach(cleanup)` (copy the pattern from `src/components/PlayerStatChart/PlayerStatChart.test.tsx` — this repo has no vitest globals). Use `fireEvent.change` (not userEvent — fake timers). Cases:
  - typing "c", "cu", "cur" quickly then `vi.advanceTimersByTime(300)` → `replace` called exactly once with `/players?q=cur`;
  - advancing only 299 ms → zero calls; the last 1 ms fires it;
  - typing the current `q` back → advance 300 → zero calls;
  - size select → immediate `replace` with `/players?size=50` (no `page` param — reset to 1; test with props `page: 3` to prove the reset);
  - retired toggle from props `{ q: "cur", size: 50 }` → `/players?q=cur&size=50&retired=1`;
  - Next from `page: 2, totalPages: 3, size: 50` → `/players?page=3&size=50`; Prev disabled at `page: 1`, Next disabled at `page === totalPages`;
  - unmount with a pending timer then advance 300 → zero calls.
- [ ] **Step 2: Run to verify failure** — `bun run test -- src/components/PlayersSearchControls`.
- [ ] **Step 3: Implement** component + SCSS per the skeleton above (fill in the commented handlers/JSX; no deviations from `buildHref`).
- [ ] **Step 4: Run tests** → PASS; full `bun run test` once.
- [ ] **Step 5: Commit** — `CV: add PlayersSearchControls (debounced search, size, pager)`

---

### Task 3: `/players` page, home link, README

**Files:**

- Create: `src/app/players/page.tsx`, `src/app/players/page.module.scss`
- Modify: `src/app/page.tsx` (add "All players →" link in the Players section heading)
- Modify: `README.md` (routes table row)
- Test: `src/app/players/page.test.tsx`

**Interfaces:**

- Consumes: `parsePlayersSearchParams`, `searchPlayers`, `PlayersSearchControls` (Tasks 1–2).
- Produces: route `/players` (coexists with `/players/[playerId]` — a static segment wins over the dynamic one in the App Router).

Page essentials:

```tsx
import Link from "next/link";

import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { searchPlayers } from "@/lib/players/search";
import { parsePlayersSearchParams } from "@/lib/players/searchParams";

import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = parsePlayersSearchParams({
    q: firstValue(raw.q),
    page: firstValue(raw.page),
    size: firstValue(raw.size),
    retired: firstValue(raw.retired),
  });
  const { rows, total, page } = await searchPlayers(params);
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);

  return (
    <main className={styles.page}>
      <h1>Players</h1>
      <PlayersSearchControls
        q={params.q}
        page={page}
        size={params.size}
        includeRetired={params.includeRetired}
        totalPages={totalPages}
      />
      <p className={styles.summary}>
        {total === 0
          ? params.q === ""
            ? "No players yet — the season data hasn't been synced."
            : `No players match "${params.q}".`
          : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
      </p>
      {total > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/players/${row.id}`}>{row.fullName}</Link>
                </td>
                <td>{row.teamAbbr ?? "—"}</td>
                <td>{row.position ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
```

SCSS: `.page { display: grid; gap: var(--space-4); padding: var(--space-6); }`; `.table` full-width, header row muted (`--color-text-muted`), cell padding `--space-2`/`--space-3`, row borders `--color-border`, row hover `--color-surface`; `.summary` muted small; dim-while-pending: `.page:has([data-pending="true"]) .table { opacity: 0.6; }`.

Home page: in the existing Players section of `src/app/page.tsx`, add `<Link href="/players" className={styles.allPlayers}>All players →</Link>` next to the section heading (extend `src/app/page.module.scss` with a token-only style; keep the heading + link on one grid row with `gap`).

README routes table row (after the `/players/[playerId]` row):

```
| `/players` | `src/app/players/page.tsx` | Searchable, paginated table of all players |
```

- [ ] **Step 1: Write failing page tests** (`page.test.tsx`) — `vi.mock("@/lib/players/search")`; local `afterEach(cleanup)`; render via `render(await PlayersPage({ searchParams: Promise.resolve({...}) }))`. Cases:
  - rows render: mock returns 2 rows / total 60 / page 2 with `size=25` in params → both names linked to `/players/<id>`, summary `Showing 26–50 of 60`;
  - empty with q: total 0, `q: "zz"` → `No players match "zz"` and no `<table>`;
  - empty without q: total 0 → the not-synced message;
  - array params: `searchParams` with `q: ["curry", "x"]` → `searchPlayers` called with `q: "curry"`.
- [ ] **Step 2: Run to verify failure** — `bun run test -- src/app/players`.
- [ ] **Step 3: Implement** page + SCSS + home link + README row.
- [ ] **Step 4: Run** focused tests → PASS; `bun run system-check` → green; `bun run build` → `/players` listed as dynamic (ƒ).
- [ ] **Step 5: Commit** — `CV: add /players searchable paginated table`

---

## Self-review notes

- Spec coverage: §3 URL-state → Tasks 2–3 (`buildHref`, page params); §4.1 parser → Task 1; §4.2 search + clamp → Task 1; §5.1 route/table/summary/empty → Task 3; §5.2 controls (debounce/size/retired/pager/pending) → Task 2; §6 error normalization → Task 1; §7 tests → each task's Step 1; home link → Task 3.
- Type consistency: `PlayersSearchParams`/`PlayerRow`/`PlayersSearchResult`/`PAGE_SIZES`/`DEFAULT_PAGE_SIZE`/`MAX_QUERY_LENGTH` names match across tasks; `PlayersSearchControlsProps` consumed by Task 3's JSX.
- No placeholders: handler comments in Task 2's skeleton specify exact behavior + exact hrefs in tests.
