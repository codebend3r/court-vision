---
name: cv-writing-tests
description: Use when adding or changing a test in court-vision, when a new lib module or component needs its co-located test, or when a bun:test run fails in a way that looks like an environment problem rather than a real assertion failure.
---

# Writing tests in court-vision

Runner is `bun:test` with a vitest-compatible `vi` shim. There is no vitest,
no jest, and no `mock.module` anywhere in this repo. 134 test files pass
today; match them rather than inventing a second style.

`CLAUDE.md` already covers co-location, the `bun run test` rule, and the
code style that applies to tests as much as to source. This skill covers
what it does not: the seams, the ordering rules, and the environment traps.

## Always

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
```

- `vi` comes from `bun:test`, not from `vitest`. Never add a vitest import.
- Use `it`, never `test`. The repo has 913 `it` and zero `test`.
- Name the case as a behavior sentence, verb first, no "should":
  `it("refuses the 51st star and reports the cap")`,
  `it("does not count an inactive row toward gamesPlayed")`.
- Test the behavior through the public entry point. Do not export internals
  just to reach them.

## Prefer injection over mocking

The house pattern for `src/lib` is a seam on the options object, not a
module mock. `src/lib/fetchImpl.ts` exists for exactly this:

```ts
const fetchImpl = vi.fn<FetchImpl>().mockResolvedValue(textResponse(body));

const rows = await fetchNbaPlayerIndex({ fetchImpl });

expect(fetchImpl).toHaveBeenCalledWith(NBA_DATA_PY_URL);
```

Type the double with a generic (`vi.fn<FetchImpl>()`). Never cast.
Canonical example: `src/lib/headshots/sources.test.ts`.

Reach for `vi.mock` only at a boundary you cannot inject: `@/lib/prisma`,
`@/lib/auth/session`, `next/navigation`, and server actions imported by a
component.

## The vi.mock ordering rule

**Bun does not hoist `vi.mock`, so the doubles must be declared before the
`vi.mock` call that references them.** This is the reverse of vitest, where
`vi.mock` is hoisted and closing over an outer `const` is the error.

```ts
import { beforeEach, describe, expect, it, vi } from "bun:test";

const starPlayer = vi.fn(); // 1. doubles first
const unstarPlayer = vi.fn();

vi.mock("@/lib/watchlist/actions", () => ({ starPlayer, unstarPlayer })); // 2. register
vi.mock("next/navigation", () => ({ usePathname: () => "/players" }));

import { StarButton } from "@/components/StarButton/StarButton"; // 3. subject
```

Put `vi.mock` above the `const` and the file dies at import with
`ReferenceError: Cannot access '...' before initialization`. Loud and
immediate, so you will not ship it by accident.

The subject import going last is a repo convention, not a requirement.
Bun's module mock updates live bindings, so an already-imported subject
still routes through the double. Follow the convention anyway (all 41
mocking files do) because it makes the intent obvious, but do not
diagnose a failure as an import-order problem. It is not one.

Reset the doubles in `beforeEach` with `.mockReset()`, then re-apply any
default return values.

## Prisma

Mock the delegate methods individually. For interactive transactions, hand
the callback the same delegate shape Prisma would:

```ts
const tx = { leagueWatchlistPlayer: { count, create, deleteMany } };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueWatchlistPlayer: { count, create, deleteMany },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));
```

Canonical example: `src/lib/watchlist/actions.test.ts`.

## Components

Canonical example: `src/components/StarButton/StarButton.test.tsx`.

- `afterEach(cleanup)` in every component file. Not optional.
- **Query by role and accessible name.** `screen.getByRole("button", { name: "Star Jalen Brunson" })`.
  This is how the accessibility rules in `CLAUDE.md` get enforced. Do not
  use `getByTestId`, and do not query by class name.
- `--isolate` gives each _file_ a fresh module registry, not each test.
  Reset zustand stores in `beforeEach`:
  `useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null })`.
- Assert on store state directly when testing optimistic updates:
  `expect(useWatchlistStore.getState().playerIds.has(7)).toBe(true)`.
- Use `userEvent` for interaction and `waitFor` for anything the action
  resolves asynchronously.

### Wrappers

- Reads search params (`nuqs`): pass `withNuqsTestingAdapter` from
  `nuqs/adapters/testing` as the render `wrapper`.
- Consumes theme: wrap in `ThemeProvider` from `@/lib/theme/ThemeProvider`.

## Fixtures and env

- Build stat lines with `makeStatLine` from `@/lib/valuation/fixtures`.
  Do not hand-roll a `FantasyStatLine`.
- Environment: `stubEnv` / `restoreEnv` from `@/lib/testing/env`, called in
  `beforeEach` / `afterEach`. `vi.stubEnv` does not exist in `bun:test`.

## What `bun.setup.ts` already does for you

Do not re-implement or undo any of this in a test file:

- Registers happy-dom on the global at `http://localhost/`, before
  `@testing-library/react` loads.
- Extends `expect` with jest-dom matchers, so `toHaveClass` and
  `toHaveAttribute` work. Types come from `src/lib/testing/matchers.d.ts`.
- Loads `.scss` imports through a proxy that echoes the key back, so
  `styles.foo` is the string `"foo"` and `toHaveClass("foo")` is meaningful.
- **Deletes `ResizeObserver`** so recharts falls back to its
  `initialDimension` prop. Chart assertions are written against that
  fallback size. Restoring `ResizeObserver` collapses every chart to 0x0.

## Verify before claiming

```bash
bun run test src/path/to/thing.test.ts   # the file you touched
bun run test                             # full suite before you call it done
```

Never run bare `bun test`; see `CLAUDE.md` for why.

## When a failure is the environment, not your test

**"Invalid hook call" / "more than one copy of React"** means `node_modules`
is stale or was installed by a different package manager, not that the test
is wrong. Look for a `node_modules/.pnpm` directory or a second
`node_modules/react`. Fix:

```bash
rm -rf node_modules && bun install --frozen-lockfile
```

**"Cannot find module '@happy-dom/global-registrator' from bun.setup.ts"**
is the same root cause. Same fix.

Neither is worth debugging as a test problem. Check the tree first.

## Checklist

- [ ] Test file is co-located (`lib/foo.ts` next to `lib/foo.test.ts`)
- [ ] Imports come from `bun:test`; uses `it`, not `test`
- [ ] Doubles declared _above_ the `vi.mock` calls that reference them
- [ ] Injected a seam where one exists, rather than mocking the module
- [ ] Component file has `afterEach(cleanup)` and resets any zustand store
- [ ] Queries by role and accessible name
- [ ] No `any`, no casts, no `for...of` (`CLAUDE.md` applies to tests too)
- [ ] Every type guard has a test
- [ ] Ran the file, then ran `bun run test`, and read the output
