# /players searchable table — design

Date: 2026-07-10
Status: Approved
Depends on: `docs/superpowers/specs/2026-07-10-player-stats-chart-design.md`
(Player table seeded with all 5,606 players; `/players/[playerId]` detail page)

## 1. Context and goal

The Player table holds every Balldontlie player back to 1946 (all 5,606 have a
last-known team, so "has a team" filters nothing). Goal: a `/players` route
with a searchable, paginated table of players — **search and pagination happen
server-side**, the page size is user-selectable, and the search input debounces
300 ms before updating results.

"Current NBA player" is **derived from game logs**: the default view shows only
players with at least one `PlayerGameLog` row (i.e. they appeared in the synced
2025-26 season); an "include retired" toggle lifts the filter. No schema
change. Consequence: until a real `sync:bdl` backfill completes, the default
view is empty and the toggle shows everyone — acceptable and self-healing.

Per the repo workflow rule, this work happens on the current branch
(`player-stats-chart`); no new branch.

## 2. Scope

**In scope**

- `/players` route (RSC, coexists with `/players/[playerId]`).
- Query layer `src/lib/players/` (param parsing + Prisma search).
- Client controls component (debounced search, page size, pager, retired
  toggle).
- "All players →" link from the home page.
- Co-located unit tests; green `bun run system-check`.

**Out of scope (YAGNI)**

- Column sorting, team/position filters, row virtualization.
- Any `isActive` schema flag or `/v1/players/active` sync (rejected in favor
  of the game-log derivation).
- Scheduled re-syncs.

## 3. URL as state

`/players?q=<search>&page=<n>&size=<n>&retired=1`

- Every view is a shareable URL; back/forward work; the server renders from
  params alone (server-side search + pagination by construction).
- Missing/invalid params fall back to defaults; the client controls write
  params via `router.replace` (no history spam while typing).

## 4. Query layer — `src/lib/players/`

### 4.1 `searchParams.ts` (pure, unit-tested)

`parsePlayersSearchParams(raw: { q?: string; page?: string; size?: string; retired?: string })`
→ `{ q: string; page: number; size: number; includeRetired: boolean }`

- `q`: trimmed, capped at 100 chars, empty → `""`.
- `page`: positive integer, default 1 (non-numeric/`< 1` → 1).
- `size`: one of `10 | 25 | 50 | 100`, default 25 (anything else → 25).
- `retired`: `"1"` → true, else false.

### 4.2 `search.ts`

`searchPlayers({ q, page, size, includeRetired })` →
`{ rows: PlayerRow[]; total: number; page: number }`

- `where`: `AND` of — `gameLogs: { some: {} }` unless `includeRetired`;
  `fullName: { contains: q, mode: "insensitive" }` when `q !== ""`.
- `orderBy: { fullName: "asc" }`, `skip: (page - 1) * size`, `take: size`.
- `total` via `count` with the same `where` (one `$transaction` with the
  `findMany`).
- Out-of-range page clamps: if `skip >= total > 0`, re-query at the last page
  and return that page number (returned `page` is the effective one the
  pager displays).
- `PlayerRow` = `{ id, fullName, teamAbbr, position }`.

## 5. UI

### 5.1 Route — `src/app/players/page.tsx` (RSC, `force-dynamic`)

- Next 16: `searchParams` is a Promise — await it, parse (§4.1), query (§4.2).
- Renders: heading, `<PlayersSearchControls>` (client), server-rendered
  `<table>` (Name linking to `/players/[id]`, Team `teamAbbr ?? "—"`,
  Position `position ?? "—"`), and a summary line
  ("Showing 26–50 of 573" / "No players match \"xyz\"").
- Empty result → single full-width empty-state row.
- SCSS module: grid + gap, tokens from `styles/globals.scss` only, no
  classless divs; table headers muted, row hover surface.

### 5.2 Controls — `src/components/PlayersSearchControls/` (client)

Props: `{ q, page, size, includeRetired, totalPages }` (current effective
values from the server).

- **Search input**: `defaultValue={q}`; on change, a 300 ms `setTimeout`
  (cleared on next keystroke and on unmount) then `router.replace` with the
  new `q` and `page` reset to 1. No navigation when the trimmed value equals
  the current `q`. Empty value drops the param.
- **Page size select** (10/25/50/100): navigates immediately, resets `page`
  to 1.
- **Retired toggle** (checkbox "Include retired players"): navigates
  immediately, resets `page` to 1.
- **Pager**: Prev/Next buttons + "Page N of M"; disabled at bounds; navigates
  immediately preserving `q`/`size`/`retired`.
- All navigation wrapped in `useTransition`; while pending the table region
  gets `aria-busy` and a dimmed style (class on a wrapper the RSC renders).
- Params are built by one helper so `q`/`page`/`size`/`retired`
  serialization lives in a single place; defaults are omitted from the URL.

## 6. Error handling

- Invalid params never error — they normalize to defaults (§4.1).
- Prisma errors surface as Next's default error boundary (no custom page yet).
- Zero total renders the empty state with the pager hidden.

## 7. Testing

- `searchParams.test.ts`: table-driven clamping cases (bad page, bad size,
  overlong q, retired flag).
- `search.test.ts`: mocked Prisma — asserts the exact `where`/`skip`/`take`
  shapes for: default view, with q, includeRetired, and the last-page clamp
  re-query.
- `PlayersSearchControls.test.tsx`: fake timers — one `router.replace` fires
  300 ms after the last keystroke (typing three chars quickly → exactly one
  navigation); size change navigates immediately with `page` reset; unmount
  cancels the pending timer.
- `page.test.tsx`: mocked query layer — renders rows, empty state, and
  summary line.

## 8. Risks

- Default view is empty until a 2025-26 backfill completes (known, § 1).
- `contains` search on 5,606 rows is a trivial seq scan for Postgres; no
  index needed at this scale.
- The search input is deliberately uncontrolled (`defaultValue`) so typing
  never loses focus to re-renders; the accepted tradeoff is that browser
  back/forward updates the table but not the input text.
