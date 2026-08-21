---
name: perf-budget
description: Use when a court-vision page feels slow, when a branch touches pages, layouts, data fetching, or perf-budget.json, when the CI perf job fails, or when asked whether load times are inside the acceptable threshold. Covers running the budget check, reading a breach, the fix ladder, and the rule that budgets never get raised to silence a failure.
---

# Load-time budgets in court-vision

`perf-budget.json` at the repo root is the acceptable-threshold contract:
per-route TTFB and total-response ceilings in milliseconds, enforced at a
percentile over several runs. `bun run perf:budget` measures a running server
against it and exits 1 on a breach. It is a local and pre-release check: CI's
perf gate is Lighthouse alone (see below). Everything is offline and free; no
API keys, no tokens.

## 1. Run the check

Production timings are the ones the budgets are calibrated for:

```bash
bun run build
bun run start --port 46644 &   # or leave `bun dev` up for a rough read
bun run perf:budget
```

- Routes flagged `requiresDb` are skipped automatically when `DATABASE_URL`
  is unset, and can be force-skipped with `--skip-db`. A run where every route
  skipped says so and asserts nothing; it is not a pass.
- `--base-url=http://localhost:3000` points the check elsewhere.
- Dev-server numbers run hot (compilation, no minification). A dev-mode
  breach is a hint, not a verdict; confirm against `next start` before acting.

## 2. Read a breach

Each FAIL line prints the measured percentile against its ceiling, e.g.
`TTFB p95 1900ms exceeds the 1200ms budget`. TTFB breaches are server work
(queries, waterfalls, uncached fetches). Total-minus-TTFB is payload size.
Lighthouse failures in CI (FCP, LCP, TBT, CLS) are client-side: bundle
weight, hydration, layout shift.

## 3. Fix ladder, in order

Work down; stop at the first rung that clears the budget:

1. **Caching.** Is the expensive read behind `unstable_cache` with the
   `players` tag pattern (see `lib/players/searchCached.ts`)? Data that only
   changes on sync should never be recomputed per request.
2. **Waterfalls.** Sequential awaits that could run together. The root layout
   runs profile, watchlist, and leagues in one `Promise.all`; new layout or
   page reads should join that shape, not chain after it.
3. **Query shape.** Over-fetching in Prisma: selecting relations the page
   never renders, or fetching all rows to sort in JS. The known debt here is
   `lib/players/search.ts` stat sorts (fetch-all-and-sort); the structural
   fix is pushing the sort into SQL, which is branch-sized work, so raise it
   as its own task rather than bolting it onto an unrelated fix.
4. **Client payload.** Heavy client components (recharts is the big one) on
   routes that breach Lighthouse budgets; split or defer them.

## 4. Rules

- **Never raise a budget to make a failing check pass.** A ceiling change is
  a product decision: it needs its own commit, a one-line justification in
  the body, and must be called out plainly in the report or PR. Same for
  deleting a route entry or flipping `warmupRuns`/`percentile`.
- **New page, new entry.** Any new route under `src/app` gets a row in
  `perf-budget.json` in the same change. Signed-out-reachable routes get
  shell budgets (600/1500); database-backed routes get data budgets
  (1200/2500) unless there is a reason to differ.
- **Preloaders are not a fix.** `loading.tsx` buys perceived speed; the
  budget still has to pass on real timings.

## Gotchas

- The measured p95 over 5 runs is the max sample; one hiccup fails the run.
  Re-run once before digging in. Two failures are real.
- The script needs the server already running; it does not boot one. A
  connection error means no server, not a breach.
- `bun run perf:budget -- --skip-db` (note the `--`) is how flags pass
  through the package script.
- Budget math lives in `lib/perf/budget.ts` with unit tests; the runner is
  `scripts/perf-budget.ts`, outside `src/` so the security scan's env-read
  rule does not apply to its `DATABASE_URL` sniff. Change the math in the
  lib, never inline in the runner, and do not move the runner back into
  `src/`.
- CI runs Lighthouse only (`lighthouserc.json`), auditing the database-free
  routes. `perf:budget` is deliberately NOT in CI: without a `DATABASE_URL` it
  skips its database-backed routes and measures the same three routes
  Lighthouse already covers, with a weaker signal, so it would read as coverage
  while asserting nothing new. Re-adding it to CI only makes sense alongside a
  seeded database. The only seed path today is `seed:demo`, which needs a live
  Balldontlie key and free-tier throttling; an offline fixture seed is the
  prerequisite. Database-backed routes are the local run's job until then.

## Checklist

- [ ] Ran against `next start`, not just dev
- [ ] Breach classified (server TTFB vs payload vs client metrics)
- [ ] Fix ladder walked in order; stopped at the cheapest effective rung
- [ ] `perf-budget.json` untouched, or the change is justified out loud
- [ ] New routes added to `perf-budget.json` in the same change
