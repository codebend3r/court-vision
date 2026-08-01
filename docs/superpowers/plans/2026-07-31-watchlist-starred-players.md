# Starred Players (Watchlist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user star up to 50 players, browse them in a dedicated section, and see the five most recent on the homepage alongside their newest fantasy team and a rolling z-score chart.

**Architecture:** Stars persist in a `WatchlistPlayer` table (composite PK, owner-only RLS) read through `lib/watchlist/queries.ts` and written through server actions that enforce the 50-cap inside a transaction. A non-persisted zustand store, hydrated once per navigation from the root layout, gives every `StarButton` optimistic state without re-rendering the `force-dynamic` players tables. The homepage chart computes each player's trailing-10-game z-score against a season-fixed pool yardstick.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), Prisma 7 / Supabase Postgres, zustand 5, recharts 3, bun:test + Testing Library, SCSS modules.

## Global Constraints

- **Do not commit.** Apply changes only; CJ will say when to commit.
- Run tests with `bun run test` (never bare `bun test` — it reports ~27 false failures).
- Named exports only; no default exports except Next.js `page.tsx` / `route.ts` / `layout.tsx` files, which Next requires.
- Type aliases only — never `interface`. No `any`, no type casts (`as`), no double casts. Use type guards or `unknown`.
- Import via `@/*` aliases; never parent-relative (`../`). Same-directory `./` is fine.
- Prefer immutable operations and `Array.prototype` methods; never `for`/`for-in`/`for-of`.
- `!!value` for boolean conversion; `&&` (not a ternary) when the else branch is null; optional chaining always paired with `??`.
- Single object parameter per function: `doSomething({ foo, bar })`, never positional.
- SCSS modules per component; all sizes, colors, spacing, and radii from `styles/globals.scss` tokens. Grid-first layout with `gap`, never margins for spacing.
- Accessibility: semantic elements, keyboard operable, visible `:focus-visible`, `aria-label` on icon-only controls, `role="alert"` for async errors, never color alone, WCAG AA contrast, `rem` units, `prefers-reduced-motion` respected.
- Tests are co-located: `lib/foo.ts` ↔ `lib/foo.test.ts`, `components/Foo/Foo.tsx` ↔ `components/Foo/Foo.test.tsx`.
- Spec: `docs/superpowers/specs/2026-07-31-watchlist-starred-players-design.md`.

---

## File Structure

**Create**

| File                                           | Responsibility                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/watchlist/constants.ts`               | `MAX_WATCHLIST`, `HOMEPAGE_WATCHLIST_LIMIT`                         |
| `src/lib/watchlist/types.ts`                   | `WatchlistActionResult`, `WatchlistError`, `WatchlistPlayerSummary` |
| `src/lib/watchlist/guards.ts` (+ test)         | `isWatchlistActionResult`                                           |
| `src/lib/watchlist/queries.ts` (+ test)        | Read side: ids, summaries, count                                    |
| `src/lib/watchlist/actions.ts` (+ test)        | `starPlayer` / `unstarPlayer`, cap enforcement                      |
| `src/lib/watchlist/store.ts` (+ test)          | Zustand star set + error state                                      |
| `src/lib/watchlist/zTrend.ts` (+ test)         | Pure rolling-window z-score series                                  |
| `src/lib/watchlist/zTrendLoader.ts`            | Cached per-player series loader                                     |
| `src/components/StarButton/*` (+ test)         | The star control, all sizes and states                              |
| `src/components/WatchlistHydrator/*`           | Seeds the store from the server                                     |
| `src/components/WatchlistAlert/*` (+ test)     | One `role="alert"` region                                           |
| `src/components/PlayersTable/*`                | Table extracted from `players/page.tsx`                             |
| `src/components/StarredPlayersView/*` (+ test) | Shared starred list, both entry points                              |
| `src/components/HomeStarredPanel/*` (+ test)   | Homepage last-5 panel                                               |
| `src/components/HomeTeamPanel/*` (+ test)      | Homepage newest-team panel                                          |
| `src/components/WatchlistZChart/*` (+ test)    | Recharts z-score trend                                              |
| `src/app/watchlist/page.tsx` (+ test)          | `/watchlist` route                                                  |

**Modify**

| File                                                     | Change                                           |
| -------------------------------------------------------- | ------------------------------------------------ |
| `prisma/schema.prisma`                                   | `WatchlistPlayer` model + back-relations         |
| `src/lib/players/searchParams.ts` (+ test)               | `"starred"` tab, `starredAt` sort key            |
| `src/lib/players/search.ts` (+ test)                     | Optional `playerIds` filter                      |
| `src/app/players/page.tsx`                               | Use `PlayersTable`; add the `starred` tab branch |
| `src/components/FantasyValueTable/FantasyValueTable.tsx` | Star column                                      |
| `src/app/players/[playerId]/page.tsx`                    | Star beside the heading                          |
| `src/app/layout.tsx`                                     | `WatchlistHydrator` + `WatchlistAlert`           |
| `src/components/SideNav/SideNav.tsx` (+ test)            | "Starred" entry                                  |
| `src/app/page.tsx` (+ test)                              | Three real panels                                |

---

# Phase 1 — Core

## Task 1: Schema, migration, RLS, constants

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `src/lib/watchlist/constants.ts`

**Interfaces:**

- Produces: `WatchlistPlayer` Prisma model; `MAX_WATCHLIST: 50`, `HOMEPAGE_WATCHLIST_LIMIT: 5`.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`** (after `Profile`)

```prisma
// A user's starred players (spec: docs/superpowers/specs/2026-07-31-watchlist-starred-players-design.md).
// Composite PK is the natural key, so double-starring is impossible by
// construction; the index serves the only ordered read — newest first.
model WatchlistPlayer {
  profileId String   @db.Uuid
  playerId  Int
  profile   Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([profileId, playerId])
  @@index([profileId, createdAt(sort: Desc)])
}
```

- [ ] **Step 2: Add back-relations**

In `model Profile`, add: `watchlist    WatchlistPlayer[]`
In `model Player`, add: `watchlist    WatchlistPlayer[]`

- [ ] **Step 3: Generate the client and the migration**

Run: `bun run db:migrate --name add_watchlist_player`
Expected: migration created under `prisma/migrations/`, client regenerated. If the shell prompts for a name interactively, the flag above already supplies it.

- [ ] **Step 4: Apply owner-only RLS**

Create the policy SQL as a second migration (`prisma/migrations/<timestamp>_watchlist_rls/migration.sql`) so it ships with the schema:

```sql
alter table "WatchlistPlayer" enable row level security;

-- Personal data: unlike the stats tables, this is NOT anon-readable.
create policy "watchlist_owner_select" on "WatchlistPlayer"
  for select using (auth.uid() = "profileId");
create policy "watchlist_owner_insert" on "WatchlistPlayer"
  for insert with check (auth.uid() = "profileId");
create policy "watchlist_owner_delete" on "WatchlistPlayer"
  for delete using (auth.uid() = "profileId");
```

- [ ] **Step 5: Create `src/lib/watchlist/constants.ts`**

```ts
// The hard cap on starred players, enforced server-side in actions.ts and
// echoed in UI copy. It lives here so the number 50 appears exactly once.
export const MAX_WATCHLIST = 50;

// How many of the most recently starred players the homepage panel and the
// z-score chart show.
export const HOMEPAGE_WATCHLIST_LIMIT = 5;
```

- [ ] **Step 6: Verify**

Run: `bun run typecheck`
Expected: PASS.

---

## Task 2: Result types and type guard

**Files:**

- Create: `src/lib/watchlist/types.ts`, `src/lib/watchlist/guards.ts`
- Test: `src/lib/watchlist/guards.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `WatchlistActionResult`, `WatchlistError`, `WatchlistPlayerSummary`, `isWatchlistActionResult({ value }): value is WatchlistActionResult`.

- [ ] **Step 1: Write the failing test** — `src/lib/watchlist/guards.test.ts`

```ts
import { describe, expect, it } from "bun:test";

import { isWatchlistActionResult } from "@/lib/watchlist/guards";

describe("isWatchlistActionResult", () => {
  it("accepts an ok result with a count", () => {
    expect(isWatchlistActionResult({ value: { status: "ok", count: 3 } })).toBe(true);
  });

  it("accepts a limit result with a count", () => {
    expect(isWatchlistActionResult({ value: { status: "limit", count: 50 } })).toBe(true);
  });

  it("accepts the countless statuses", () => {
    expect(isWatchlistActionResult({ value: { status: "unauthenticated" } })).toBe(true);
    expect(isWatchlistActionResult({ value: { status: "error" } })).toBe(true);
  });

  it("rejects ok without a numeric count", () => {
    expect(isWatchlistActionResult({ value: { status: "ok" } })).toBe(false);
    expect(isWatchlistActionResult({ value: { status: "ok", count: "3" } })).toBe(false);
  });

  it("rejects unknown statuses and non-objects", () => {
    expect(isWatchlistActionResult({ value: { status: "nope" } })).toBe(false);
    expect(isWatchlistActionResult({ value: null })).toBe(false);
    expect(isWatchlistActionResult({ value: "ok" })).toBe(false);
    expect(isWatchlistActionResult({ value: undefined })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun run test src/lib/watchlist/guards.test.ts`
Expected: FAIL — module `@/lib/watchlist/guards` not found.

- [ ] **Step 3: Write `src/lib/watchlist/types.ts`**

```ts
// Why a result union instead of thrown errors: server actions cross the RSC
// boundary, where a thrown error reaches the client as an opaque digest. The
// client needs to tell "you hit 50" from "you're signed out" to pick copy.
export type WatchlistError = "limit" | "unauthenticated" | "error";

export type WatchlistActionResult =
  | { status: "ok"; count: number }
  | { status: "limit"; count: number }
  | { status: "unauthenticated" }
  | { status: "error" };

// Identity fields the homepage panel and starred list render, plus when the
// star happened so callers can order without a second query.
export type WatchlistPlayerSummary = {
  playerId: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  starredAt: string; // ISO date — serializable across the RSC boundary
};
```

- [ ] **Step 4: Write `src/lib/watchlist/guards.ts`**

```ts
import { type WatchlistActionResult } from "@/lib/watchlist/types";

const hasCount = (value: Record<string, unknown>): boolean => typeof value.count === "number";

export const isWatchlistActionResult = ({
  value,
}: {
  value: unknown;
}): value is WatchlistActionResult => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  if (record.status === "ok" || record.status === "limit") return hasCount(record);
  return record.status === "unauthenticated" || record.status === "error";
};
```

- [ ] **Step 5: Run the test**

Run: `bun run test src/lib/watchlist/guards.test.ts`
Expected: PASS (5 tests).

---

## Task 3: Read queries

**Files:**

- Create: `src/lib/watchlist/queries.ts`
- Test: `src/lib/watchlist/queries.test.ts`

**Interfaces:**

- Consumes: `getProfile` from `@/lib/auth/session`; `WatchlistPlayerSummary`.
- Produces: `getWatchlistPlayerIds(): Promise<number[]>`, `getWatchlistPlayers({ limit }): Promise<WatchlistPlayerSummary[]>`, `getWatchlistCount(): Promise<number>`.

- [ ] **Step 1: Write the failing test** — `src/lib/watchlist/queries.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "bun:test";

const findMany = vi.fn();
const count = vi.fn();
const getProfile = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { watchlistPlayer: { findMany, count } } }));
vi.mock("@/lib/auth/session", () => ({ getProfile }));

import {
  getWatchlistCount,
  getWatchlistPlayerIds,
  getWatchlistPlayers,
} from "@/lib/watchlist/queries";

const profile = { id: "11111111-1111-1111-1111-111111111111" };

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
  getProfile.mockReset();
  getProfile.mockResolvedValue(profile);
});

describe("getWatchlistPlayerIds", () => {
  it("returns ids newest-starred first", async () => {
    findMany.mockResolvedValue([{ playerId: 7 }, { playerId: 3 }]);
    expect(await getWatchlistPlayerIds()).toEqual([7, 3]);
    expect(findMany).toHaveBeenCalledWith({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      select: { playerId: true },
    });
  });

  it("returns an empty list when signed out, without querying", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getWatchlistPlayerIds()).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("getWatchlistPlayers", () => {
  it("flattens the joined player into a summary with an ISO starredAt", async () => {
    findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-07-30T12:00:00.000Z"),
        player: {
          id: 7,
          fullName: "Jalen Brunson",
          teamAbbr: "NYK",
          position: "G",
          nbaPersonId: 1628973,
        },
      },
    ]);
    expect(await getWatchlistPlayers({ limit: 5 })).toEqual([
      {
        playerId: 7,
        fullName: "Jalen Brunson",
        teamAbbr: "NYK",
        position: "G",
        nbaPersonId: 1628973,
        starredAt: "2026-07-30T12:00:00.000Z",
      },
    ]);
  });

  it("returns an empty list when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getWatchlistPlayers({ limit: 5 })).toEqual([]);
  });
});

describe("getWatchlistCount", () => {
  it("counts the signed-in profile's rows", async () => {
    count.mockResolvedValue(42);
    expect(await getWatchlistCount()).toBe(42);
  });

  it("is zero when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getWatchlistCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun run test src/lib/watchlist/queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/watchlist/queries.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/auth/session";
import { type WatchlistPlayerSummary } from "@/lib/watchlist/types";

// Deliberately uncached: these reads are per-user and tiny (≤50 rows), and
// they must reflect a write immediately. An unstable_cache tier here would
// need a per-user key and buy nothing.

export const getWatchlistPlayerIds = async (): Promise<number[]> => {
  const profile = await getProfile();
  if (profile === null) return [];
  const rows = await prisma.watchlistPlayer.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    select: { playerId: true },
  });
  return rows.map((row) => row.playerId);
};

export const getWatchlistPlayers = async ({
  limit,
}: {
  limit: number;
}): Promise<WatchlistPlayerSummary[]> => {
  const profile = await getProfile();
  if (profile === null) return [];
  const rows = await prisma.watchlistPlayer.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      createdAt: true,
      player: {
        select: {
          id: true,
          fullName: true,
          teamAbbr: true,
          position: true,
          nbaPersonId: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    playerId: row.player.id,
    fullName: row.player.fullName,
    teamAbbr: row.player.teamAbbr,
    position: row.player.position,
    nbaPersonId: row.player.nbaPersonId,
    starredAt: row.createdAt.toISOString(),
  }));
};

export const getWatchlistCount = async (): Promise<number> => {
  const profile = await getProfile();
  if (profile === null) return 0;
  return prisma.watchlistPlayer.count({ where: { profileId: profile.id } });
};
```

- [ ] **Step 4: Run the test**

Run: `bun run test src/lib/watchlist/queries.test.ts`
Expected: PASS (6 tests).

---

## Task 4: Server actions with the 50-cap

**Files:**

- Create: `src/lib/watchlist/actions.ts`
- Test: `src/lib/watchlist/actions.test.ts`

**Interfaces:**

- Consumes: `MAX_WATCHLIST`, `getProfile`, `WatchlistActionResult`.
- Produces: `starPlayer({ playerId }): Promise<WatchlistActionResult>`, `unstarPlayer({ playerId }): Promise<WatchlistActionResult>`.

- [ ] **Step 1: Write the failing test** — `src/lib/watchlist/actions.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "bun:test";

const count = vi.fn();
const create = vi.fn();
const deleteMany = vi.fn();
const getProfile = vi.fn();

// $transaction receives a callback here (interactive transaction), so the mock
// hands it the same delegate object the action would get from Prisma.
const tx = { watchlistPlayer: { count, create, deleteMany } };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    watchlistPlayer: { count, create, deleteMany },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));

import { starPlayer, unstarPlayer } from "@/lib/watchlist/actions";

const profile = { id: "11111111-1111-1111-1111-111111111111" };

beforeEach(() => {
  count.mockReset();
  create.mockReset();
  deleteMany.mockReset();
  getProfile.mockReset();
  getProfile.mockResolvedValue(profile);
  create.mockResolvedValue({});
  deleteMany.mockResolvedValue({ count: 1 });
});

describe("starPlayer", () => {
  it("creates the row and returns the new count", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 4 });
    expect(create).toHaveBeenCalledWith({ data: { profileId: profile.id, playerId: 7 } });
  });

  it("refuses the 51st star and reports the cap", async () => {
    count.mockResolvedValueOnce(50);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "limit", count: 50 });
    expect(create).not.toHaveBeenCalled();
  });

  it("treats an already-starred player as success", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(3);
    create.mockRejectedValue({ code: "P2002" });
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 3 });
  });

  it("is unauthenticated when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(create).not.toHaveBeenCalled();
  });

  it("reports error when the write blows up", async () => {
    count.mockResolvedValueOnce(3);
    create.mockRejectedValue(new Error("connection reset"));
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "error" });
  });
});

describe("unstarPlayer", () => {
  it("deletes the row and returns the new count", async () => {
    count.mockResolvedValueOnce(2);
    expect(await unstarPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 2 });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { profileId: profile.id, playerId: 7 },
    });
  });

  it("is unauthenticated when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await unstarPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun run test src/lib/watchlist/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/watchlist/actions.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/auth/session";
import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { type WatchlistActionResult } from "@/lib/watchlist/types";

// Prisma's unique-constraint code. Re-starring a player the user already
// starred is a no-op, not an error — a double click must not look broken.
const UNIQUE_VIOLATION = "P2002";

const isUniqueViolation = ({ error }: { error: unknown }): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === UNIQUE_VIOLATION;

export const starPlayer = async ({
  playerId,
}: {
  playerId: number;
}): Promise<WatchlistActionResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  try {
    // The cap is checked and the row written in one transaction so a stale
    // client (or two tabs) can never push the list past MAX_WATCHLIST.
    return await prisma.$transaction(async (tx) => {
      const current = await tx.watchlistPlayer.count({ where: { profileId: profile.id } });
      if (current >= MAX_WATCHLIST) return { status: "limit", count: current };
      try {
        await tx.watchlistPlayer.create({ data: { profileId: profile.id, playerId } });
      } catch (error) {
        if (!isUniqueViolation({ error })) throw error;
      }
      const count = await tx.watchlistPlayer.count({ where: { profileId: profile.id } });
      return { status: "ok", count };
    });
  } catch {
    return { status: "error" };
  }
};

export const unstarPlayer = async ({
  playerId,
}: {
  playerId: number;
}): Promise<WatchlistActionResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  try {
    await prisma.watchlistPlayer.deleteMany({ where: { profileId: profile.id, playerId } });
    const count = await prisma.watchlistPlayer.count({ where: { profileId: profile.id } });
    return { status: "ok", count };
  } catch {
    return { status: "error" };
  }
};
```

- [ ] **Step 4: Run the test**

Run: `bun run test src/lib/watchlist/actions.test.ts`
Expected: PASS (7 tests). If the `"use server"` directive makes bun's transpiler complain about non-async exports, confirm every export is `async` — that is the rule the directive enforces.

---

## Task 5: Zustand store

**Files:**

- Create: `src/lib/watchlist/store.ts`
- Test: `src/lib/watchlist/store.test.ts`

**Interfaces:**

- Consumes: `WatchlistError`.
- Produces: `useWatchlistStore` with state `{ playerIds: ReadonlySet<number>; count: number; lastError: WatchlistError | null }` and actions `hydrate({ playerIds })`, `add({ playerId })`, `remove({ playerId })`, `setCount({ count })`, `setError({ error })`, `clearError()`.

- [ ] **Step 1: Write the failing test** — `src/lib/watchlist/store.test.ts`

```ts
import { beforeEach, describe, expect, it } from "bun:test";

import { useWatchlistStore } from "@/lib/watchlist/store";

const reset = () =>
  useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null });

beforeEach(reset);

describe("useWatchlistStore", () => {
  it("hydrates ids and count together", () => {
    useWatchlistStore.getState().hydrate({ playerIds: [3, 7] });
    const state = useWatchlistStore.getState();
    expect([...state.playerIds]).toEqual([3, 7]);
    expect(state.count).toBe(2);
  });

  it("adds and removes without mutating the previous set", () => {
    const { hydrate, add, remove } = useWatchlistStore.getState();
    hydrate({ playerIds: [3] });
    const before = useWatchlistStore.getState().playerIds;
    add({ playerId: 7 });
    expect([...before]).toEqual([3]);
    expect(useWatchlistStore.getState().playerIds.has(7)).toBe(true);
    expect(useWatchlistStore.getState().count).toBe(2);
    remove({ playerId: 3 });
    expect(useWatchlistStore.getState().playerIds.has(3)).toBe(false);
    expect(useWatchlistStore.getState().count).toBe(1);
  });

  it("does not double-count a re-added player", () => {
    const { add } = useWatchlistStore.getState();
    add({ playerId: 7 });
    add({ playerId: 7 });
    expect(useWatchlistStore.getState().count).toBe(1);
  });

  it("holds the last error until cleared", () => {
    useWatchlistStore.getState().setError({ error: "limit" });
    expect(useWatchlistStore.getState().lastError).toBe("limit");
    useWatchlistStore.getState().clearError();
    expect(useWatchlistStore.getState().lastError).toBeNull();
  });

  it("takes an authoritative count from the server", () => {
    useWatchlistStore.getState().setCount({ count: 42 });
    expect(useWatchlistStore.getState().count).toBe(42);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun run test src/lib/watchlist/store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/watchlist/store.ts`**

```ts
import { create } from "zustand";

import { type WatchlistError } from "@/lib/watchlist/types";

type WatchlistState = {
  playerIds: ReadonlySet<number>;
  count: number;
  lastError: WatchlistError | null;
  hydrate: (args: { playerIds: number[] }) => void;
  add: (args: { playerId: number }) => void;
  remove: (args: { playerId: number }) => void;
  setCount: (args: { count: number }) => void;
  setError: (args: { error: WatchlistError }) => void;
  clearError: () => void;
};

// Deliberately NOT persisted: the database is the source of truth, and a
// stale localStorage copy would contradict it after a sign-out or on a second
// device. The server re-seeds this store on every navigation via
// WatchlistHydrator, and `count` is corrected from each action's result.
export const useWatchlistStore = create<WatchlistState>()((set) => ({
  playerIds: new Set<number>(),
  count: 0,
  lastError: null,
  hydrate: ({ playerIds }) => set({ playerIds: new Set(playerIds), count: playerIds.length }),
  add: ({ playerId }) =>
    set((state) => {
      const playerIds = new Set(state.playerIds).add(playerId);
      return { playerIds, count: playerIds.size };
    }),
  remove: ({ playerId }) =>
    set((state) => {
      const playerIds = new Set(state.playerIds);
      playerIds.delete(playerId);
      return { playerIds, count: playerIds.size };
    }),
  setCount: ({ count }) => set({ count }),
  setError: ({ error }) => set({ lastError: error }),
  clearError: () => set({ lastError: null }),
}));

export const useIsStarred = ({ playerId }: { playerId: number }): boolean =>
  useWatchlistStore((state) => state.playerIds.has(playerId));

export const useWatchlistCount = (): number => useWatchlistStore((state) => state.count);
```

- [ ] **Step 4: Run the test**

Run: `bun run test src/lib/watchlist/store.test.ts`
Expected: PASS (5 tests).

---

## Task 6: StarButton, hydrator, alert region

**Files:**

- Create: `src/components/StarButton/StarButton.tsx`, `StarButton.module.scss`, `StarButton.test.tsx`
- Create: `src/components/WatchlistHydrator/WatchlistHydrator.tsx`
- Create: `src/components/WatchlistAlert/WatchlistAlert.tsx`, `WatchlistAlert.module.scss`, `WatchlistAlert.test.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**

- Consumes: `useWatchlistStore`, `useIsStarred`, `starPlayer`, `unstarPlayer`, `isWatchlistActionResult`, `MAX_WATCHLIST`, `safeNextPath` from `@/lib/auth/safeNextPath`.
- Produces: `<StarButton playerId fullName isSignedIn size />` where `size` is `"sm" | "md"`; `<WatchlistHydrator playerIds count />`; `<WatchlistAlert />`.

- [ ] **Step 1: Write the failing test** — `src/components/StarButton/StarButton.test.tsx`

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const starPlayer = vi.fn();
const unstarPlayer = vi.fn();

vi.mock("@/lib/watchlist/actions", () => ({ starPlayer, unstarPlayer }));
vi.mock("next/navigation", () => ({ usePathname: () => "/players" }));

import { StarButton } from "@/components/StarButton/StarButton";
import { useWatchlistStore } from "@/lib/watchlist/store";

beforeEach(() => {
  starPlayer.mockReset();
  unstarPlayer.mockReset();
  useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null });
});

afterEach(cleanup);

describe("StarButton", () => {
  it("labels an unstarred player and reports aria-pressed=false", () => {
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    const button = screen.getByRole("button", { name: "Star Jalen Brunson" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("flips optimistically before the action resolves", async () => {
    let resolve = (result: unknown) => {
      void result;
    };
    starPlayer.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    await userEvent.click(screen.getByRole("button"));
    expect(useWatchlistStore.getState().playerIds.has(7)).toBe(true);
    resolve({ status: "ok", count: 1 });
    await waitFor(() => expect(useWatchlistStore.getState().count).toBe(1));
  });

  it("rolls back and records the error when the cap is hit", async () => {
    starPlayer.mockResolvedValue({ status: "limit", count: 50 });
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(useWatchlistStore.getState().lastError).toBe("limit"));
    expect(useWatchlistStore.getState().playerIds.has(7)).toBe(false);
    expect(useWatchlistStore.getState().count).toBe(50);
  });

  it("unstars a starred player", async () => {
    unstarPlayer.mockResolvedValue({ status: "ok", count: 0 });
    useWatchlistStore.setState({ playerIds: new Set([7]), count: 1, lastError: null });
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    const button = screen.getByRole("button", { name: "Unstar Jalen Brunson" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(button);
    await waitFor(() => expect(useWatchlistStore.getState().playerIds.has(7)).toBe(false));
  });

  it("renders a sign-in link instead of a button when signed out", () => {
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in to star Jalen Brunson" })).toHaveAttribute(
      "href",
      "/login?next=%2Fplayers",
    );
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun run test src/components/StarButton/StarButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/components/StarButton/StarButton.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Star } from "lucide-react";

import { starPlayer, unstarPlayer } from "@/lib/watchlist/actions";
import { isWatchlistActionResult } from "@/lib/watchlist/guards";
import { useIsStarred, useWatchlistStore } from "@/lib/watchlist/store";

import styles from "@/components/StarButton/StarButton.module.scss";

export type StarButtonProps = {
  playerId: number;
  fullName: string;
  isSignedIn: boolean;
  size?: "sm" | "md";
};

export function StarButton({ playerId, fullName, isSignedIn, size = "sm" }: StarButtonProps) {
  const pathname = usePathname();
  const isStarred = useIsStarred({ playerId });
  const [isPending, startTransition] = useTransition();

  // Signed out, a disabled control is a dead end. A link to sign-in that
  // returns here afterwards is the useful answer.
  if (!isSignedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className={styles.star}
        data-size={size}
        aria-label={`Sign in to star ${fullName}`}
      >
        <Star aria-hidden="true" className={styles.icon} />
      </Link>
    );
  }

  const toggle = () => {
    const { add, remove, setCount, setError, clearError } = useWatchlistStore.getState();
    clearError();
    // Optimistic: the store flips now, and the action's result either confirms
    // the count or rolls the change back.
    if (isStarred) {
      remove({ playerId });
    } else {
      add({ playerId });
    }
    startTransition(async () => {
      const result = isStarred ? await unstarPlayer({ playerId }) : await starPlayer({ playerId });
      if (!isWatchlistActionResult({ value: result })) {
        setError({ error: "error" });
        if (isStarred) add({ playerId });
        else remove({ playerId });
        return;
      }
      if (result.status === "ok") {
        setCount({ count: result.count });
        return;
      }
      if (isStarred) add({ playerId });
      else remove({ playerId });
      setError({ error: result.status === "limit" ? "limit" : result.status });
      if (result.status === "limit") setCount({ count: result.count });
    });
  };

  return (
    <button
      type="button"
      className={styles.star}
      data-size={size}
      aria-pressed={isStarred}
      aria-label={isStarred ? `Unstar ${fullName}` : `Star ${fullName}`}
      data-pending={isPending || undefined}
      onClick={toggle}
    >
      {/* Fill, not colour, carries the state — colour alone never conveys meaning. */}
      <Star aria-hidden="true" className={styles.icon} fill={isStarred ? "currentColor" : "none"} />
    </button>
  );
}
```

- [ ] **Step 4: Write `src/components/StarButton/StarButton.module.scss`**

Use only `styles/globals.scss` tokens. Required rules: a grid-centered inline control sized `--space-*`, `color: var(--color-text-muted)` unstarred and `var(--color-accent)` starred (`[aria-pressed="true"]`), a `:focus-visible` outline using the accent token, `[data-pending]` at reduced opacity, and a `transform` hover cue wrapped in `@media (prefers-reduced-motion: no-preference)`. No `box-shadow` glows (repo rule).

- [ ] **Step 5: Run the StarButton test**

Run: `bun run test src/components/StarButton/StarButton.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Write `src/components/WatchlistHydrator/WatchlistHydrator.tsx`**

```tsx
"use client";

import { useEffect } from "react";

import { useWatchlistStore } from "@/lib/watchlist/store";

export type WatchlistHydratorProps = {
  playerIds: number[];
};

// Seeds the star set from the server once per navigation. Rendering it in the
// root layout means every surface — tables, detail page, homepage panels —
// shares one query and one source of truth.
export function WatchlistHydrator({ playerIds }: WatchlistHydratorProps) {
  useEffect(() => {
    useWatchlistStore.getState().hydrate({ playerIds });
  }, [playerIds]);
  return null;
}
```

- [ ] **Step 7: Write the failing test** — `src/components/WatchlistAlert/WatchlistAlert.test.tsx`

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { WatchlistAlert } from "@/components/WatchlistAlert/WatchlistAlert";
import { useWatchlistStore } from "@/lib/watchlist/store";

beforeEach(() => {
  useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null });
});

afterEach(cleanup);

describe("WatchlistAlert", () => {
  it("renders nothing when there is no error", () => {
    render(<WatchlistAlert />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces the cap message", () => {
    useWatchlistStore.setState({ lastError: "limit", count: 50 });
    render(<WatchlistAlert />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Watchlist full (50/50) — unstar someone first.",
    );
  });

  it("announces a sign-in prompt when unauthenticated", () => {
    useWatchlistStore.setState({ lastError: "unauthenticated" });
    render(<WatchlistAlert />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign in to star players.");
  });
});
```

- [ ] **Step 8: Write `src/components/WatchlistAlert/WatchlistAlert.tsx`**

```tsx
"use client";

import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { useWatchlistStore } from "@/lib/watchlist/store";

import styles from "@/components/WatchlistAlert/WatchlistAlert.module.scss";

// One live region for the whole app: a per-row alert would announce the same
// message once per table row.
export function WatchlistAlert() {
  const lastError = useWatchlistStore((state) => state.lastError);
  const count = useWatchlistStore((state) => state.count);
  if (lastError === null) return null;
  const message =
    lastError === "limit"
      ? `Watchlist full (${count}/${MAX_WATCHLIST}) — unstar someone first.`
      : lastError === "unauthenticated"
        ? "Sign in to star players."
        : "Couldn't update your watchlist. Try again.";
  return (
    <p className={styles.alert} role="alert">
      {message}
    </p>
  );
}
```

Write `WatchlistAlert.module.scss` as a fixed-position toast at the viewport bottom using `--space-*`, `--color-surface`, `--color-border`, `--radius-*` tokens and AA-contrast text; no glow.

- [ ] **Step 9: Wire both into `src/app/layout.tsx`**

Import `getWatchlistPlayerIds`, and inside `RootLayout` after `const user = await getUser();`:

```tsx
const watchlistPlayerIds = await getWatchlistPlayerIds();
```

Render inside `<ThemeProvider>`, directly after `<SiteHeader />`:

```tsx
<WatchlistHydrator playerIds={watchlistPlayerIds} />
<WatchlistAlert />
```

- [ ] **Step 10: Verify the phase**

Run: `bun run test && bun run typecheck && bun run lint`
Expected: PASS. **Do not commit** — report Phase 1 complete and wait for review.

---

# Phase 2 — Starred views

## Task 7: `playerIds` filter and the `starred` tab param

**Files:**

- Modify: `src/lib/players/search.ts`, `src/lib/players/searchParams.ts`
- Test: `src/lib/players/search.test.ts`, `src/lib/players/searchParams.test.ts`

**Interfaces:**

- Produces: `searchPlayers(args & { playerIds?: number[] })`; `PlayersTab` includes `"starred"`; `PlayerSortKey` includes `"starredAt"`.

- [ ] **Step 1: Add failing tests to `src/lib/players/search.test.ts`**

```ts
it("restricts the query to the given player ids", async () => {
  findMany.mockResolvedValue([]);
  count.mockResolvedValue(0);
  await searchPlayers({ ...defaultParams, playerIds: [7, 3] });
  expect(findMany.mock.calls[0]?.[0]).toMatchObject({
    where: { gameLogs: { some: {} }, id: { in: [7, 3] } },
  });
});

it("short-circuits an empty id list without querying", async () => {
  findMany.mockClear();
  const result = await searchPlayers({ ...defaultParams, playerIds: [] });
  expect(result).toEqual({ rows: [], total: 0, page: 1 });
  expect(findMany).not.toHaveBeenCalled();
});
```

Add to `src/lib/players/searchParams.test.ts`:

```ts
it("accepts the starred tab", () => {
  expect(parsePlayersSearchParams({ tab: "starred" }).tab).toBe("starred");
});

it("defaults the starred tab to starredAt, newest first", () => {
  const params = parsePlayersSearchParams({ tab: "starred" });
  expect(params.sort).toBe("starredAt");
  expect(params.dir).toBe("desc");
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `bun run test src/lib/players/search.test.ts src/lib/players/searchParams.test.ts`
Expected: FAIL — `playerIds` not accepted; `"starred"` falls back to `"regular"`.

- [ ] **Step 3: Extend `searchParams.ts`**

- Add `"starred"` to `PlayersTab` and `PLAYERS_TABS`, and update the stale comment above them (it still says Fantasy renders a `ComingSoonPanel`).
- Add `"starredAt"` to `PlayerSortKey` and `PLAYER_SORT_KEYS`.
- Add `export const DEFAULT_STARRED_SORT_KEY: PlayerSortKey = "starredAt";`
- In `parsePlayersSearchParams`, the sort fallback becomes: advanced → `DEFAULT_ADVANCED_SORT_KEY`, starred → `DEFAULT_STARRED_SORT_KEY`, else `DEFAULT_SORT_KEY`.
- In `buildPlayersHref`, `defaultSort` gains the same three-way branch so a starred link stays clean.

- [ ] **Step 4: Extend `search.ts`**

- Widen the parameter type: `searchPlayers(args: PlayersSearchParams & { playerIds?: number[] })`.
- First line of the function body:

```ts
// An empty watchlist has no query to run — `id: { in: [] }` would scan for nothing.
if (args.playerIds?.length === 0) return { rows: [], total: 0, page: 1 };
```

- Extend the `where`:

```ts
const where: Prisma.PlayerWhereInput = {
  gameLogs: { some: {} },
  ...(q === "" ? {} : { fullName: { contains: q, mode: "insensitive" } }),
  ...(args.playerIds === undefined ? {} : { id: { in: args.playerIds } }),
};
```

- `statSortValue` returns `0` for `"starredAt"` (order is applied by the caller, which knows the star order); leave `isSortableCountingStatKey` untouched so `starredAt` never enters the minimums rule.

- [ ] **Step 5: Run the tests**

Run: `bun run test src/lib/players/search.test.ts src/lib/players/searchParams.test.ts`
Expected: PASS.

---

## Task 8: Extract `PlayersTable`

**Files:**

- Create: `src/components/PlayersTable/PlayersTable.tsx`, `PlayersTable.module.scss`
- Modify: `src/app/players/page.tsx`, `src/app/players/page.module.scss`

**Interfaces:**

- Consumes: `PlayerRow`, `PlayersSearchParams`, `ADVANCED_STAT_META`, `StarButton`.
- Produces:

```ts
export type PlayersTableProps = {
  variant: "regular" | "advanced";
  rows: PlayerRow[] | AdvancedPlayerRow[];
  params: PlayersSearchParams;
  page: number;
  isSignedIn: boolean;
};
```

- [ ] **Step 1: Move the markup**

Cut `STAT_COLUMNS`, `PERCENTAGE_METRIC_KEYS`, `formatPerGame`, `formatPercentage`, `formatAdvancedMetric`, `renderSortableHeader`, and both `<table>` blocks out of `src/app/players/page.tsx` into `PlayersTable.tsx`. Move the table-related rules from `players/page.module.scss` into `PlayersTable.module.scss` (`table`, `tableScroller`, `numeric`, `rank`, `nameCell`, `sortLink`, `headerTip*`). This is a move, not a rewrite: keep the existing comments, the `data-sort-active` attributes, and the `aria-sort` logic exactly as they are.

- [ ] **Step 2: Add the star column**

As the first `<th>` in both variants:

```tsx
<th className={styles.starColumn}>
  <span className={styles.visuallyHidden}>Watchlist</span>
</th>
```

and as the first `<td>` of each row:

```tsx
<td className={styles.starCell}>
  <StarButton playerId={row.id} fullName={row.fullName} isSignedIn={isSignedIn} />
</td>
```

`.visuallyHidden` is the standard clip-rect pattern — a header the screen reader announces but the layout doesn't show.

- [ ] **Step 3: Re-wire `players/page.tsx`**

Both the regular and advanced branches now render `<PlayersTable variant=… rows=… params=… page=… isSignedIn=… />`. Get `isSignedIn` from `const isSignedIn = !!(await getUser());` at the top of the page component.

- [ ] **Step 4: Verify nothing regressed**

Run: `bun run test src/app/players/page.test.tsx && bun run typecheck && bun run lint`
Expected: PASS. The existing page test covers the table markup; if a selector broke, the extraction changed markup it shouldn't have.

---

## Task 9: Stars on the Fantasy tab and the player detail page

**Files:**

- Modify: `src/components/FantasyValueTable/FantasyValueTable.tsx` (+ its `.module.scss` and test)
- Modify: `src/app/players/[playerId]/page.tsx` (+ its `.module.scss` and test)

- [ ] **Step 1: Fantasy tab**

Add a leading star column to `FantasyValueTable` using the identical header/cell markup from Task 8. It is already a client component, so `StarButton` drops in directly. `isSignedIn` threads down from `players/page.tsx` → `FantasyValueView` → `FantasyValueTable` as a prop.

- [ ] **Step 2: Player detail page**

Render `<StarButton playerId={player.id} fullName={player.fullName} isSignedIn={isSignedIn} size="md" />` beside the `<h1>`, inside the existing heading container. Wrap the heading and button in a grid with `grid-auto-flow: column`, `justify-content: start`, `align-items: center`, and a `--space-*` gap — do not add margins.

- [ ] **Step 3: Add assertions to both tests**

In `src/app/players/[playerId]/page.test.tsx`:

```tsx
expect(screen.getByRole("button", { name: /Star / })).toBeInTheDocument();
```

(The existing file already mocks `@/lib/auth/session`; make the signed-in case return a user so the button, not the link, renders.)

- [ ] **Step 4: Verify**

Run: `bun run test && bun run typecheck && bun run lint`
Expected: PASS.

---

## Task 10: `StarredPlayersView`, the tab, and `/watchlist`

**Files:**

- Create: `src/components/StarredPlayersView/StarredPlayersView.tsx`, `.module.scss`, `.test.tsx`
- Create: `src/app/watchlist/page.tsx`, `page.module.scss`, `page.test.tsx`
- Modify: `src/app/players/page.tsx`, `src/components/PlayersTabs/PlayersTabs.tsx`, `src/components/SideNav/SideNav.tsx` (+ test)

**Interfaces:**

- Consumes: `getWatchlistPlayerIds`, `getWatchlistCount`, `searchPlayers`, `PlayersTable`, `MAX_WATCHLIST`.
- Produces: `<StarredPlayersView params showCounter />` (async server component).

- [ ] **Step 1: Write `StarredPlayersView.tsx`**

```tsx
import Link from "next/link";

import { PlayersTable } from "@/components/PlayersTable/PlayersTable";
import { getUser } from "@/lib/auth/session";
import { searchPlayers } from "@/lib/players/search";
import { type PlayersSearchParams } from "@/lib/players/searchParams";
import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { getWatchlistPlayerIds } from "@/lib/watchlist/queries";

import styles from "@/components/StarredPlayersView/StarredPlayersView.module.scss";

export type StarredPlayersViewProps = {
  params: PlayersSearchParams;
  showCounter: boolean;
};

export async function StarredPlayersView({ params, showCounter }: StarredPlayersViewProps) {
  const user = await getUser();
  if (user === null) {
    return (
      <p className={styles.empty}>
        <Link href="/login?next=%2Fwatchlist">Sign in</Link> to star players.
      </p>
    );
  }
  const playerIds = await getWatchlistPlayerIds();
  const { rows, total, page } = await searchPlayers({ ...params, playerIds });
  // The set is capped at 50, so star order is applied in memory rather than by
  // teaching the stats query about a join order it otherwise never needs.
  const ordered =
    params.sort === "starredAt"
      ? [...rows].sort((a, b) => {
          const difference = playerIds.indexOf(a.id) - playerIds.indexOf(b.id);
          return params.dir === "asc" ? -difference : difference;
        })
      : rows;

  if (playerIds.length === 0) {
    return (
      <p className={styles.empty}>
        No starred players yet — star players from the <Link href="/players">Players</Link> page.
      </p>
    );
  }

  return (
    <section className={styles.view}>
      {showCounter && (
        <p className={styles.counter}>
          {playerIds.length} / {MAX_WATCHLIST} starred
        </p>
      )}
      <PlayersTable variant="regular" rows={ordered} params={params} page={page} isSignedIn />
      <p className={styles.summary}>
        {total === 1 ? "1 starred player" : `${total} starred players`}
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Write `StarredPlayersView.test.tsx`**

Mock `@/lib/auth/session`, `@/lib/watchlist/queries`, and `@/lib/players/search`; render the resolved component (`render(await StarredPlayersView({ params, showCounter: true }))`). Assert: the sign-in link when signed out; the empty-state copy when `getWatchlistPlayerIds` resolves `[]`; the `"2 / 50 starred"` counter; and that rows come back in star order when `sort` is `"starredAt"` (mock `searchPlayers` to return the rows in the _wrong_ order and assert the rendered order is corrected).

- [ ] **Step 3: Add the tab**

In `PlayersTabs.tsx`, add `{ tab: "starred", label: "Starred" }` to `TAB_ENTRIES`. In `players/page.tsx`, before the advanced branch:

```tsx
if (params.tab === "starred") {
  return (
    <main className={styles.page}>
      <h1>Players</h1>
      {tabsNav}
      <StarredPlayersView params={params} showCounter={false} />
    </main>
  );
}
```

- [ ] **Step 4: Add the route** — `src/app/watchlist/page.tsx`

```tsx
import { StarredPlayersView } from "@/components/StarredPlayersView/StarredPlayersView";
import { parsePlayersSearchParams } from "@/lib/players/searchParams";

import styles from "@/app/watchlist/page.module.scss";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = parsePlayersSearchParams({
    q: firstValue(raw.q),
    page: firstValue(raw.page),
    size: firstValue(raw.size),
    sort: firstValue(raw.sort),
    dir: firstValue(raw.dir),
    range: firstValue(raw.range),
    mode: firstValue(raw.mode),
    minimums: firstValue(raw.minimums),
    tab: "starred",
  });
  return (
    <main className={styles.page}>
      <h1>Starred Players</h1>
      <StarredPlayersView params={params} showCounter />
    </main>
  );
}
```

- [ ] **Step 5: Add the SideNav entry**

In `NAV_ENTRIES`, after My Teams: `{ href: "/watchlist", label: "Starred", shortLabel: "S" }`. Add an assertion to `SideNav.test.tsx` that the link renders with that href.

- [ ] **Step 6: Verify the phase**

Run: `bun run test && bun run typecheck && bun run lint`
Expected: PASS. **Do not commit** — report Phase 2 complete and wait for review.

---

# Phase 3 — Homepage and the z-score chart

## Task 11: Rolling z-score series (pure)

**Files:**

- Create: `src/lib/watchlist/zTrend.ts`
- Test: `src/lib/watchlist/zTrend.test.ts`

**Interfaces:**

- Consumes: `aggregateWindowLogs` (`@/lib/valuation/aggregate`), `scoreZScore` (`@/lib/valuation/methods/zscore`), `PoolStats`, `ValuationConfig`, `FantasyStatLine`.
- Produces:

```ts
export const ROLLING_WINDOW_GAMES = 10;
export type ZTrendPoint = { date: number; z: number };
export type ZTrendSeries = { playerId: number; fullName: string; points: ZTrendPoint[] };
export const buildRollingZSeries = (args: {
  playerId: number;
  fullName: string;
  logs: readonly (WindowLog & { gameDate: Date })[];
  poolStats: PoolStats;
  config: ValuationConfig;
  windowSize?: number;
}): ZTrendSeries;
```

- [ ] **Step 1: Write the failing test** — `src/lib/watchlist/zTrend.test.ts`

```ts
import { describe, expect, it } from "bun:test";

import { TEAM_BUILDER_VALUATION_CONFIG } from "@/lib/fantasyTeams/insights";
import { computePoolStats } from "@/lib/valuation/pool";
import { buildRollingZSeries } from "@/lib/watchlist/zTrend";
import { makeLine } from "@/lib/valuation/fixtures";

// A 12-game log where the last games are much better than the first, so the
// rolling window must trend upward.
const log = ({ day, pts }: { day: number; pts: number }) => ({
  gameDate: new Date(Date.UTC(2026, 0, day)),
  minutes: 32,
  pts,
  reb: 5,
  ast: 5,
  stl: 1,
  blk: 1,
  fg3m: 2,
  tov: 2,
  fgm: 8,
  fga: 16,
  ftm: 4,
  fta: 5,
});

const poolStats = computePoolStats({
  lines: Array.from({ length: 20 }, (_, index) => makeLine({ playerId: index + 100 })),
  basis: "perGame",
  poolSize: 150,
  range: "all",
});

describe("buildRollingZSeries", () => {
  it("emits one point per game from the window size onward", () => {
    const logs = Array.from({ length: 12 }, (_, index) => log({ day: index + 1, pts: 20 }));
    const series = buildRollingZSeries({
      playerId: 7,
      fullName: "Jalen Brunson",
      logs,
      poolStats,
      config: TEAM_BUILDER_VALUATION_CONFIG,
    });
    expect(series.points).toHaveLength(3); // games 10, 11, 12
    expect(series.points[0]?.date).toBe(Date.UTC(2026, 0, 10));
  });

  it("emits no points for a player under the window size", () => {
    const logs = Array.from({ length: 9 }, (_, index) => log({ day: index + 1, pts: 20 }));
    const series = buildRollingZSeries({
      playerId: 7,
      fullName: "Jalen Brunson",
      logs,
      poolStats,
      config: TEAM_BUILDER_VALUATION_CONFIG,
    });
    expect(series.points).toEqual([]);
  });

  it("rises when recent games are stronger than early ones", () => {
    const logs = [
      ...Array.from({ length: 10 }, (_, index) => log({ day: index + 1, pts: 5 })),
      ...Array.from({ length: 10 }, (_, index) => log({ day: index + 11, pts: 40 })),
    ];
    const series = buildRollingZSeries({
      playerId: 7,
      fullName: "Jalen Brunson",
      logs,
      poolStats,
      config: TEAM_BUILDER_VALUATION_CONFIG,
    });
    const first = series.points[0]?.z ?? 0;
    const last = series.points.at(-1)?.z ?? 0;
    expect(last).toBeGreaterThan(first);
  });
});
```

Before writing the test, open `src/lib/valuation/fixtures.ts` and use whatever line-builder it actually exports — if the export is not named `makeLine`, use the real name in both the import and the calls.

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun run test src/lib/watchlist/zTrend.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/watchlist/zTrend.ts`**

```ts
import { aggregateWindowLogs, type WindowLog } from "@/lib/valuation/aggregate";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { type FantasyStatLine, type PoolStats, type ValuationConfig } from "@/lib/valuation/types";

// Ten games is the shortest window that smooths a single blow-up game without
// lagging a real change in role.
export const ROLLING_WINDOW_GAMES = 10;

export type DatedLog = WindowLog & { gameDate: Date };
export type ZTrendPoint = { date: number; z: number };
export type ZTrendSeries = { playerId: number; fullName: string; points: ZTrendPoint[] };

// The identity fields scoreZScore needs but never reads.
const identity = ({ playerId, fullName }: { playerId: number; fullName: string }) => ({
  playerId,
  firstName: fullName.split(" ")[0] ?? fullName,
  lastName: fullName.split(" ").slice(1).join(" "),
  fullName,
  teamAbbr: null,
  position: null,
  nbaPersonId: null,
});

export const buildRollingZSeries = ({
  playerId,
  fullName,
  logs,
  poolStats,
  config,
  windowSize = ROLLING_WINDOW_GAMES,
}: {
  playerId: number;
  fullName: string;
  logs: readonly DatedLog[];
  poolStats: PoolStats;
  config: ValuationConfig;
  windowSize?: number;
}): ZTrendSeries => {
  // Under a full window there is no honest number to plot; the chart says so
  // in its legend rather than drawing a stub.
  if (logs.length < windowSize) return { playerId, fullName, points: [] };
  const points = logs.reduce<ZTrendPoint[]>((acc, log, index) => {
    if (index + 1 < windowSize) return acc;
    const window = logs.slice(index + 1 - windowSize, index + 1);
    const line: FantasyStatLine = {
      ...identity({ playerId, fullName }),
      ...aggregateWindowLogs({ logs: window }),
    };
    const [value] = scoreZScore({ lines: [line], poolStats, config });
    return [...acc, { date: log.gameDate.getTime(), z: value?.total ?? 0 }];
  }, []);
  return { playerId, fullName, points };
};
```

- [ ] **Step 4: Run the test**

Run: `bun run test src/lib/watchlist/zTrend.test.ts`
Expected: PASS (3 tests).

---

## Task 12: Cached series loader

**Files:**

- Create: `src/lib/watchlist/zTrendLoader.ts`

**Interfaces:**

- Consumes: `getFantasyPool`, `computePoolStats`, `TEAM_BUILDER_VALUATION_CONFIG`, `buildRollingZSeries`.
- Produces: `getZTrendSeries({ players }): Promise<ZTrendSeries[]>` where `players` is `{ playerId: number; fullName: string }[]`.

- [ ] **Step 1: Write `src/lib/watchlist/zTrendLoader.ts`**

```ts
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { TEAM_BUILDER_VALUATION_CONFIG } from "@/lib/fantasyTeams/insights";
import { computePoolStats } from "@/lib/valuation/pool";
import { getFantasyPool } from "@/lib/valuation/loader";
import { buildRollingZSeries, type ZTrendSeries } from "@/lib/watchlist/zTrend";

// Pool floor mirrors lib/valuation/index.ts: small leagues still standardize
// against a broad pool so values stay stable (PRD §5.1).
const POOL_FLOOR = 150;

const latestSeason = async (): Promise<string | null> => {
  const row = await prisma.playerSeasonStats.findFirst({
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" },
    select: { season: true },
  });
  return row?.season ?? null;
};

const fetchSeries = async ({
  playerId,
  fullName,
}: {
  playerId: number;
  fullName: string;
}): Promise<ZTrendSeries> => {
  const season = await latestSeason();
  if (season === null) return { playerId, fullName, points: [] };
  // The yardstick is the whole season's pool, held fixed for every window, so
  // a rising line means the player improved — not that the league shifted.
  const lines = await getFantasyPool({ range: "all" });
  const poolStats = computePoolStats({
    lines,
    basis: TEAM_BUILDER_VALUATION_CONFIG.basis,
    poolSize: Math.max(
      POOL_FLOOR,
      TEAM_BUILDER_VALUATION_CONFIG.teams * TEAM_BUILDER_VALUATION_CONFIG.rosterSlots,
    ),
    range: "all",
  });
  const logs = await prisma.playerGameLog.findMany({
    where: { playerId, season, seasonType: "Regular Season" },
    orderBy: { gameDate: "asc" },
    select: {
      gameDate: true,
      minutes: true,
      pts: true,
      reb: true,
      ast: true,
      stl: true,
      blk: true,
      fg3m: true,
      tov: true,
      fgm: true,
      fga: true,
      ftm: true,
      fta: true,
    },
  });
  return buildRollingZSeries({
    playerId,
    fullName,
    logs,
    poolStats,
    config: TEAM_BUILDER_VALUATION_CONFIG,
  });
};

// Cached per player, not per watchlist: five users watching the same star
// share one entry. Same tag/window as the other players caches, so one sync
// invalidation busts every surface.
const cachedSeries = unstable_cache(
  (playerId: number, fullName: string) => fetchSeries({ playerId, fullName }),
  ["watchlist:z-trend"],
  { revalidate: 300, tags: ["players"] },
);

export const getZTrendSeries = ({
  players,
}: {
  players: readonly { playerId: number; fullName: string }[];
}): Promise<ZTrendSeries[]> =>
  Promise.all(players.map((player) => cachedSeries(player.playerId, player.fullName)));
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run typecheck && bun run lint`
Expected: PASS. If `TEAM_BUILDER_VALUATION_CONFIG` does not expose `teams`/`rosterSlots`, read `src/lib/fantasyTeams/insights.ts` and use the fields it actually defines.

---

## Task 13: `WatchlistZChart`

**Files:**

- Create: `src/components/WatchlistZChart/WatchlistZChart.tsx`, `.module.scss`, `.test.tsx`

**Interfaces:**

- Consumes: `ZTrendSeries`, `useTheme` (`@/lib/theme/ThemeProvider`), recharts.
- Produces: `<WatchlistZChart series={ZTrendSeries[]} />`.

- [ ] **Step 1: Load the dataviz skill**

Invoke the `dataviz` skill before writing any chart code, and follow its palette and axis guidance. Use `src/components/PlayerStatChart/PlayerStatChart.tsx` as the in-repo reference for theme-aware chart chrome.

- [ ] **Step 2: Write the component**

Requirements, all of which the tests below or a reviewer will check:

- `"use client"`; recharts `ResponsiveContainer` + `LineChart`.
- One `<Line>` per series, each with its **own `data` prop** (the five players play on different dates), `type="monotone"`, `dot={false}`, `connectNulls={false}`.
- `<XAxis type="number" dataKey="date" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={…}>` formatting unix-ms to a short date. A category axis would misalign players.
- `<YAxis>` labelled "Z-Score"; `<ReferenceLine y={0} />` marking league-average value.
- Colors from the dataviz palette, and each line additionally distinguished by `strokeDasharray` so the chart never conveys series identity by color alone.
- `isAnimationActive={false}` when `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.
- Series with `points.length === 0` render no line; the legend appends "— fewer than 10 games" to that player's entry.
- When `series` is empty or every series is empty, render a `<p>` inviting the user to star players instead of empty axes.

- [ ] **Step 3: Write `WatchlistZChart.test.tsx`**

recharts needs a sized container in a test DOM; follow whatever `PlayerStatChart.test.tsx` already does (it solves this — copy its setup). Assert: the empty state when `series` is `[]`; an accessible name for the chart region; and that a player with no points is labelled "fewer than 10 games".

- [ ] **Step 4: Run the test**

Run: `bun run test src/components/WatchlistZChart/WatchlistZChart.test.tsx`
Expected: PASS.

---

## Task 14: Homepage panels

**Files:**

- Create: `src/components/HomeStarredPanel/HomeStarredPanel.tsx`, `.module.scss`, `.test.tsx`
- Create: `src/components/HomeTeamPanel/HomeTeamPanel.tsx`, `.module.scss`, `.test.tsx`
- Modify: `src/app/page.tsx`, `src/app/page.module.scss`, `src/app/page.test.tsx`

**Interfaces:**

- Consumes: `getWatchlistPlayers`, `getWatchlistCount`, `getZTrendSeries`, `useFantasyTeamsStore`, `PlayerAvatar`, `TeamChip`, `StarButton`, `WatchlistZChart`.
- Produces: `<HomeStarredPanel players count />` (server), `<HomeTeamPanel />` (client).

- [ ] **Step 1: Write `HomeStarredPanel.tsx`**

A `<section aria-labelledby>` titled "Starred Players" rendering a `<ul>` of the five summaries: `PlayerAvatar`, name linking to `/players/{playerId}`, `TeamChip`, position, and a `StarButton` (`isSignedIn` is always true here — the panel only renders for signed-in users). Footer link: `View all ({count})` → `/watchlist`. Empty: "You aren't watching any players yet — star players from the Players page." with a link to `/players`.

- [ ] **Step 2: Write `HomeTeamPanel.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { slotMeta } from "@/lib/fantasyTeams/slots";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";

import styles from "@/components/HomeTeamPanel/HomeTeamPanel.module.scss";

// Teams live in localStorage (lib/fantasyTeams/store.ts), so this panel is a
// client component reading the same store /my-teams uses.
export function HomeTeamPanel() {
  useEffect(() => {
    void useFantasyTeamsStore.persist.rehydrate();
  }, []);
  const teams = useFantasyTeamsStore((state) => state.teams);
  const latest = [...teams].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (latest === undefined) {
    return (
      <section className={styles.panel} aria-labelledby="home-team-title">
        <h2 id="home-team-title" className={styles.title}>
          Your Team
        </h2>
        <p className={styles.empty}>
          No fantasy teams yet — <Link href="/my-teams/create">create your first team</Link>.
        </p>
      </section>
    );
  }

  const filled = latest.slots.filter((slot) => slot.player !== null).length;
  const starters = latest.slots.filter((slot) => slotMeta(slot.type).kind === "starter");

  return (
    <section className={styles.panel} aria-labelledby="home-team-title">
      <h2 id="home-team-title" className={styles.title}>
        Your Team
      </h2>
      <Link href={`/my-teams/${teamNameToSlug(latest.name)}`} className={styles.teamName}>
        {latest.name}
      </Link>
      <p className={styles.meta}>
        {filled}/{latest.slots.length} slots filled
      </p>
      <ul className={styles.slotList}>
        {starters.map((slot) => (
          <li key={slot.id} className={styles.slot}>
            <span className={styles.slotType}>{slotMeta(slot.type).label}</span>
            {slot.player === null ? (
              <span className={styles.empty}>Empty</span>
            ) : (
              <span className={styles.player}>
                <PlayerAvatar
                  fullName={slot.player.fullName}
                  nbaPersonId={slot.player.nbaPersonId}
                  size="sm"
                  teamAbbr={slot.player.teamAbbr}
                />
                <Link href={`/players/${slot.player.playerId}`}>{slot.player.fullName}</Link>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Rewrite `src/app/page.tsx`**

Keep the signed-out branch exactly as it is today (the two sign-in cards). For a signed-in user:

```tsx
const [players, count] = await Promise.all([
  getWatchlistPlayers({ limit: HOMEPAGE_WATCHLIST_LIMIT }),
  getWatchlistCount(),
]);
const series = await getZTrendSeries({ players });
```

Render `<HomeStarredPanel players={players} count={count} />`, `<HomeTeamPanel />`, and a full-width section containing `<WatchlistZChart series={series} />` titled "Z-Score Trend". Remove the now-unused `ComingSoonPanel` import if nothing else on the page uses it. In `page.module.scss`, give the chart section `grid-column: 1 / -1`.

- [ ] **Step 4: Update `src/app/page.test.tsx`**

The file already mocks `@/lib/auth/session`. Add mocks for `@/lib/watchlist/queries` and `@/lib/watchlist/zTrendLoader`, then assert: signed-out still shows both sign-in links; signed-in with two starred players shows their names and a `View all (2)` link to `/watchlist`; signed-in with none shows the "aren't watching any players yet" copy.

- [ ] **Step 5: Full verification**

Run: `bun run system-check`
Expected: PASS (format, lint, typecheck, tests, build). **Do not commit** — report Phase 3 complete.

---

## Self-Review Notes

Checked against the spec section by section:

- §1 data layer → Task 1 (model, migration, RLS, constants).
- §2 server layer → Tasks 2–4 (types, guards, queries, actions with the transactional cap).
- §3 client state → Tasks 5–6 (store, hydrator, StarButton, alert region).
- §4 star surfaces → Tasks 8–9 (PlayersTable extraction covers basic + advanced; fantasy table and detail page separately) plus the panel star in Task 14 and the view star in Task 10.
- §5 starred section → Tasks 7 and 10 (`playerIds` filter, `starredAt` sort, shared view, tab, route, SideNav).
- §6 homepage → Task 14.
- §7 z-score pipeline → Tasks 11–13.
- Testing table → covered by the tests in Tasks 2, 3, 4, 5, 6, 7, 10, 11, 13, 14.

Type consistency: `WatchlistActionResult` / `WatchlistPlayerSummary` / `ZTrendSeries` / `StarButtonProps` are defined once (Tasks 2, 11, 6) and referenced by those exact names everywhere after. `MAX_WATCHLIST` and `HOMEPAGE_WATCHLIST_LIMIT` come only from `lib/watchlist/constants.ts`.
