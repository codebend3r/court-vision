# Starred players (watchlist)

Let a signed-in user star any player, capped at **50**. Starred players get
their own section — a `/watchlist` route _and_ a `starred` tab on `/players` —
and the homepage's three placeholder panels are replaced by the five most
recently starred players, the user's newest fantasy team, and a line chart
tracking those same five players' rolling z-scores across the season.

"Starred" and "watchlist" are the same thing: **starred** is the user-facing
word (button labels, headings), **watchlist** is the code/table word.

## Decisions

| Question            | Decision                                                                         |
| ------------------- | -------------------------------------------------------------------------------- |
| Storage             | Supabase/Prisma, auth-required. Not localStorage.                                |
| Star surfaces       | All three `/players` tabs, player detail, the starred views, the homepage panel. |
| Starred section     | Both: `/watchlist` route **and** `/players?tab=starred`, sharing one component.  |
| 51st star           | Blocked server-side, explained in a live region. No FIFO eviction.               |
| Client state        | Zustand store + optimistic server action. Not `revalidatePath`.                  |
| Z-score chart       | Rolling 10-game z-score over the season, fixed season-wide yardstick.            |
| Homepage team panel | Name + slots filled + starters.                                                  |

## Approaches considered

- **A. Server action + `revalidatePath` (rejected).** One source of truth, least
  code — but `/players` is `force-dynamic`, so every star click re-runs the
  stats query and re-renders a 50-row table. Visibly laggy on the highest
  traffic surface.
- **B. `useOptimistic` per row (rejected).** Idiomatic React 19, but star state
  is per-component: the table row, homepage panel, and watchlist page can
  disagree until a refresh, and the 50-count needs a shared source anyway.
- **C. Zustand store + optimistic server action (chosen).** The server seeds a
  store once per navigation; `StarButton` flips it instantly and reconciles
  against the action's result. No table re-render, one shared count, and every
  surface agrees in the same session. Matches the repo rule that global state
  is zustand. Cost: the store must re-hydrate from the server on each
  navigation, which the layout already does for free.

## 1. Data layer

```prisma
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

- Composite primary key rather than a `cuid` id: `(profileId, playerId)` is the
  natural key, so double-starring is impossible by construction.
- `Profile` and `Player` gain `watchlist WatchlistPlayer[]` back-relations.
- The index serves the only ordered read there is — newest-starred-first.
- `onDelete: Cascade` on both sides: deleting a profile or a player must not
  strand rows.

### RLS

Enable RLS with **owner-only** policies (`auth.uid() = profile_id` for select,
insert, delete). Unlike the stats tables, this one is **not** anon-readable —
a watchlist is personal. Prisma connects as the Postgres role and bypasses RLS;
the policies exist to close the anon-key path.

### Constants

`src/lib/watchlist/constants.ts` exports `MAX_WATCHLIST = 50` and
`HOMEPAGE_WATCHLIST_LIMIT = 5`. Both the server action and the UI copy read
from these; the number 50 appears in exactly one place.

## 2. Server layer — `src/lib/watchlist/`

### `queries.ts`

- `getWatchlistPlayerIds(): Promise<number[]>` — newest-starred first. Returns
  `[]` when signed out; never throws.
- `getWatchlistPlayers({ limit }): Promise<WatchlistPlayerSummary[]>` — identity
  fields for the homepage panel (`playerId`, `fullName`, `teamAbbr`,
  `position`, `nbaPersonId`, `starredAt`).
- `getWatchlistCount(): Promise<number>` — for the "42 / 50 starred" counter.

Not cached. The reads are tiny (≤50 rows), per-user, and must reflect a write
immediately; `unstable_cache` here would need a per-user key and buy nothing.

### `actions.ts` (`"use server"`)

`starPlayer({ playerId })` and `unstarPlayer({ playerId })` return a
discriminated result rather than throwing across the RSC boundary, so the
client can render the right message for each failure:

```ts
export type WatchlistActionResult =
  | { status: "ok"; count: number }
  | { status: "unauthenticated" }
  | { status: "limit"; count: number }
  | { status: "error" };
```

- The cap is enforced **inside `prisma.$transaction`** — count, then create —
  so a stale client cannot exceed 50.
- `starPlayer` on an already-starred player is a no-op returning `ok` (the
  composite key makes this safe), so a double click can't produce an error.
- `count` comes back on success so the store's counter stays exact without a
  second round trip.

### `guards.ts`

`isWatchlistActionResult` type guard with unit tests, per CLAUDE.md.

## 3. Client state

### `lib/watchlist/store.ts`

Zustand, **not persisted** — the database is the source of truth, and a stale
localStorage copy would contradict it after a sign-out or a second device.

```ts
type WatchlistState = {
  playerIds: ReadonlySet<number>;
  lastError: WatchlistError | null; // "limit" | "unauthenticated" | "error"
  hydrate: (args: { playerIds: number[] }) => void;
  add: (args: { playerId: number }) => void;
  remove: (args: { playerId: number }) => void;
  clearError: () => void;
};
```

Selectors `useIsStarred({ playerId })` and `useWatchlistCount()` keep components
from subscribing to the whole set.

### `WatchlistHydrator`

A client component rendered in `layout.tsx`, which already `await`s
`getUser()`. One `number[]` prop, hydrated in an effect — every surface is
seeded from a single query per navigation.

### `StarButton`

- A real `<button type="button" aria-pressed={isStarred}>` with
  `aria-label={isStarred ? "Unstar {name}" : "Star {name}"}`.
- Lucide `Star`, **filled vs. outline** — the state never rests on color alone.
- Optimistic: flip the store, call the action, roll back and set `lastError` if
  the result isn't `ok`.
- **Signed out** it renders as a `<Link href="/login?next={current}">` (through
  the existing `safeNextPath`) labelled "Sign in to star {name}" — informative
  rather than a disabled dead end.
- `size` variant (`sm` in tables, `md` on the detail page).

### `WatchlistAlert`

One `role="alert"` live region in the layout, driven by `store.lastError`, so
"Watchlist full (50/50) — unstar someone first." is announced once instead of
once per row. Clears on the next successful action.

## 4. Star surfaces

`src/app/players/page.tsx` is ~480 lines and renders two near-identical tables
inline. Adding a star column to both in place makes that worse, so this extracts
**`components/PlayersTable/PlayersTable.tsx`** covering the basic and advanced
variants. This is a targeted improvement to the code being touched, not a
general refactor — nothing else in `/players` is restructured.

| Surface               | Placement                                                |
| --------------------- | -------------------------------------------------------- |
| Basic + Advanced tabs | Leading column, visually-hidden "Watchlist" `<th>`       |
| Fantasy Value tab     | Same column in `FantasyValueTable` (already client-side) |
| Player detail         | Beside the `<h1>`, `md` size                             |
| Starred views         | Same button, acting as unstar                            |
| Homepage panel        | Same button, acting as unstar                            |

Because all of them read one store, a star clicked in the table updates the
homepage panel in the same session with no refetch.

## 5. The starred section

Both entry points render one shared server component, `StarredPlayersView`:

```
getWatchlistPlayerIds()            // ordered, newest first
  └─ searchPlayers({ ...params, playerIds })   // new optional filter
     └─ <PlayersTable />           // the same table the basic tab uses
```

- `PLAYERS_TABS` gains `"starred"`, so `/players?tab=starred` slots into the
  existing tab nav (`isPlayersTab`'s test updates alongside).
- `/watchlist` is a route with a `SideNav` entry ("Starred", short label `S`),
  an `<h1>Starred Players</h1>`, and a **"42 / 50 starred"** counter.
- `searchPlayers` gains an optional `playerIds?: number[]` filter — a
  `where: { id: { in: playerIds } }` clause. Passing `[]` short-circuits to an
  empty result without a query.
- **Default sort is `starredAt` desc**, resolved in memory against the id order
  (the set is capped at 50, so no join-order query is needed). Every existing
  sort key keeps working.
- Empty: "No starred players yet — star players from the Players page."
  Signed out: the sign-in prompt.

## 6. Homepage

The three `ComingSoonPanel`s are replaced. Signed-out visitors keep today's
sign-in cards.

- **Starred Players** — the five most recent, server-rendered from
  `getWatchlistPlayers({ limit: HOMEPAGE_WATCHLIST_LIMIT })`: avatar, name, team
  chip, position, unstar. "View all (42)" links to `/watchlist`. Deliberately
  the most prominent panel in the grid.
- **Your Team** — a client component reading the fantasy-teams zustand store
  (teams are localStorage), newest by `createdAt`: name linking to the editor,
  "9/13 slots filled", and the starter slots with avatars. Bench and IL are
  left to `/my-teams`. Empty: "create your first team".
- **Z-Score Trend** — full grid width, below the other two. It charts the same
  five most-recently-starred players the panel above lists, not all 50.

## 7. Rolling z-score pipeline

### `lib/watchlist/zTrend.ts` (pure)

`buildRollingZSeries({ logs, poolStats, config, windowSize })` →
`{ playerId, points: { date: number; z: number }[] }`.

- **Fixed yardstick.** Pool μ/σ is computed once from
  `getFantasyPool({ range: "all" })` via `computePoolStats`, using the neutral
  config `lib/fantasyTeams/insights.ts` already defines (all categories,
  per-game, unweighted, 12 teams × 13 slots). Holding it fixed for the season
  means a rising line is the player improving, not the yardstick moving.
- **Window.** Season logs ascending; from the 10th game onward, aggregate the
  trailing 10 through the existing `aggregateWindowLogs` and score with
  `scoreZScore`. `date` is the unix-ms timestamp of the window's last game.
- **Fewer than 10 games** produces no points. The chart states this in the
  legend rather than drawing a misleading stub.

### `lib/watchlist/zTrendLoader.ts`

`unstable_cache` per `playerId`, `revalidate: 300`, tag `"players"` — the same
regime as `valuation/loader.ts` and `players/searchCached.ts`, so one sync
invalidation busts every surface. Five cache lookups per homepage render.

### `components/WatchlistZChart`

- Recharts `LineChart`, one `Line` per player with its **own `data` array** and
  a **numeric (unix-ms) `XAxis`** with a date tick formatter — the five players
  play on different dates, so a category axis would misalign them.
- `ReferenceLine` at y = 0 (league-average value).
- Theme-aware chrome via `useTheme`, following `PlayerStatChart`.
- Animation disabled under `prefers-reduced-motion`.
- Empty state when nothing is starred: the panel invites starring rather than
  rendering empty axes.
- The `dataviz` skill is loaded before the chart is written.

## Testing

Co-located per CLAUDE.md.

| Unit                          | Covers                                                                    |
| ----------------------------- | ------------------------------------------------------------------------- |
| `guards.test.ts`              | `isWatchlistActionResult` — every branch                                  |
| `store.test.ts`               | hydrate / add / remove / error lifecycle                                  |
| `actions.test.ts`             | 50-cap transaction, signed-out, duplicate star (mocked prisma)            |
| `zTrend.test.ts`              | window math, <10 games, fixed-pool scoring (uses `valuation/fixtures.ts`) |
| `StarButton.test.tsx`         | `aria-pressed`, optimistic flip, rollback, signed-out link                |
| `search.test.ts`              | the `playerIds` filter, including `[]`                                    |
| `page.test.tsx` (home)        | all three panels, signed-in and signed-out                                |
| `StarredPlayersView.test.tsx` | `starredAt` ordering, empty state                                         |

## Implementation phases

The plan splits into three reviewable phases with a checkpoint after each:

1. **Core** — Prisma model, migration, RLS, queries, actions, guards, store,
   hydrator, `StarButton`, `WatchlistAlert`.
2. **Views** — `PlayersTable` extraction, star columns on all three tabs and the
   detail page, `searchPlayers` filter, `StarredPlayersView`, `/watchlist`
   route, `starred` tab, SideNav entry.
3. **Homepage** — starred panel, latest-team panel, z-score pipeline and chart.

## Out of scope

- Migrating fantasy teams from localStorage to the database.
- Sharing or exporting a watchlist.
- Notifications or alerts on starred players.
- Starring while signed out, with a merge on sign-in.
- Reordering or grouping within the watchlist (it is ordered by star time).
