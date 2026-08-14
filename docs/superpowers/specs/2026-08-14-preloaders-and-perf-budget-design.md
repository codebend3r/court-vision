# Preloaders and load-time budgets

Date: 2026-08-14. Branch: `preloaders`.

## Problem

Navigations render nothing until the destination page's data resolves. Every
data page is `force-dynamic`, the root layout blocks on profile, watchlist and
league reads, and the players landing view (points sort) fetches every player
with game logs and sorts in JS. Signing in is the worst case: the button stops
saying "Signing in" and the screen sits idle until the dashboard arrives.
Nothing in the repo enforces a ceiling on load times, so regressions land
silently.

## Design

### 1. Route preloaders

- New `Preloader` component (`components/Preloader/`): accessible loading
  skeleton with `role="status"`, a visually hidden label, shimmer animation
  gated behind `prefers-reduced-motion`, tokens from `globals.scss`.
- `app/loading.tsx`: root fallback so every route transition shows a preloader
  the moment navigation starts. Nested routes without their own file bubble to
  this one.
- Route-shaped skeletons where the wait is longest: `app/players/loading.tsx`
  (heading, tabs strip, table rows) and `app/players/[playerId]/loading.tsx`.
- SearchParam-only changes inside `/players` keep the existing transition dim;
  `loading.tsx` only covers segment navigations, which is the intended split.

### 2. First login

- `LoginForm` currently drops its pending state before `router.push`, leaving
  dead air. It now keeps the form disabled and shows a `role="status"` message
  ("Signed in. Loading your dashboard") until the navigation unmounts it. The
  destination then renders the route skeleton from change 1.

### 3. Load-time wins now

- Root layout: `getLeagues` ran as a second await after the profile resolved.
  It guards internally when signed out, so it joins the existing `Promise.all`.
- `withDisplayStats` built one intermediate object per stat key per game
  (about 12x logs x players allocations per cold search). Replaced with a
  single accumulator object per game, same reduce shape, same results.
- The structural fix (pushing the stat sort into SQL) stays deferred; it is a
  separate branch-sized change and is recorded as the next lever.

### 4. Threshold enforcement

- `perf-budget.json` at the repo root declares per-route budgets (TTFB and
  total response ms, p95 over N runs) and marks routes that need a database.
- `scripts/perf-budget.ts` (Bun, offline, free) measures each route against a
  running server and exits 1 on breach. `bun run perf:budget` wires it up.
  Routes flagged `requiresDb` are skipped automatically when the server has no
  `DATABASE_URL`, so the same command works locally and in CI.

### 5. Enforcement skill

- `.claude/skills/perf-budget/SKILL.md`: when to run the check, how to read a
  breach, the fix-first ladder (cache, waterfall, query shape, SQL rewrite),
  and the rule that budgets are never raised to silence a failure without
  saying so out loud.

### 6. CI

- New `perf` job in `.github/workflows/ci.yml`: build, `next start`, then
  Lighthouse CI (`@lhci/cli`, free, no API keys) asserts metric budgets on the
  database-free routes (`/login`, `/signup`, `/design`), followed by the
  perf-budget script for server-timing ceilings on the same routes. Reports
  upload as workflow artifacts. Database-backed routes are enforced locally
  via the same script because CI has no seeded database; a synthetic seed at
  realistic scale is the recorded follow-up if that gap starts to bite.

## Testing

- `Preloader` and both route skeletons get co-located component tests.
- `LoginForm.test.tsx` covers the new redirecting state.
- Budget evaluation logic lives in `lib/perf/budget.ts` with unit tests; the
  script itself stays a thin runner, mirroring `security-scan.ts`.
