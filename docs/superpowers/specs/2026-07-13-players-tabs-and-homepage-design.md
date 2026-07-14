# Players tabs (Regular / Advanced / Fantasy) + homepage placeholders — Design

Date: 2026-07-13
Branch: `advanced-stats-tab`

## Goal

1. `/players` gains three tabs: **Regular** (existing table, unchanged), **Advanced**
   (new — averages built from `PlayerAdvancedGameLog`), and **Fantasy Value**
   (placeholder, marked "coming soon").
2. The homepage (`/`) gets three placeholder cards: your team, your watched
   players, and a stat-need finder ("if you're short on rebounds, we'll surface
   players trending up in REB").

Both surfaces reuse a shared `ComingSoonPanel` treatment so unbuilt features
read consistently across the app.

## Scope

**In:**

- `tab` URL param on `/players` (`regular` | `advanced` | `fantasy`).
- `PlayersTabs` nav component.
- Advanced-stats aggregation (`lib/players/searchAdvanced.ts`) and table UI,
  full range parity with Regular (last 5/10/20/40/60/all games), always
  averaged (no totals toggle, no qualifying-minimums switch — neither is
  meaningful for rate stats).
- Fantasy Value tab: `ComingSoonPanel`, no data, no controls.
- Homepage: three placeholder cards, auth-aware copy via existing `getProfile()`.
- `ComingSoonPanel` shared component.

**Out:**

- Any real fantasy-value scoring/model.
- Any real "team", "watchlist", or "stat trend" persistence/backend — these
  stay pure UI placeholders with no data wiring.
- Changing Regular tab's behavior, columns, or URL params.
- New Prisma models or migrations (advanced aggregation is computed on the fly
  from the existing `PlayerAdvancedGameLog` table added in PR #8).

## Design

### 1. `tab` param (`lib/players/searchParams.ts`)

```ts
export type PlayersTab = "regular" | "advanced" | "fantasy";
export const PLAYERS_TABS: readonly PlayersTab[] = ["regular", "advanced", "fantasy"];
export const DEFAULT_TAB: PlayersTab = "regular";
```

- `parsePlayersSearchParams` gains `tab`, defaulting to `"regular"` on any
  unrecognized value.
- `buildPlayersHref` gains `tab`, omitted from the query string when it's the
  default (matches existing omit-if-default convention for `sort`/`dir`/etc.).
- `sort` stays a single string field; each tab validates it against its own
  key set (`PLAYER_SORT_KEYS` for regular, new `ADVANCED_SORT_KEYS` for
  advanced) and falls back to that tab's default (`pts` / `pie`) if invalid —
  this is what makes switching tabs reset an incompatible sort instead of
  erroring.
- New `AdvancedSortKey` type: `"firstName" | "lastName" | "pie" | "pace" |
"assistPercentage" | "assistRatio" | "assistToTurnover" | "defensiveRating" |
"defensiveReboundPercentage" | "effectiveFieldGoalPercentage" | "netRating" |
"offensiveRating" | "offensiveReboundPercentage" | "reboundPercentage" |
"trueShootingPercentage" | "turnoverRatio" | "usagePercentage"`.

### 2. `PlayersTabs` component (`components/PlayersTabs/`)

Server component, three `<Link>`s built with `buildPlayersHref`. Switching
tabs:

- Keeps `q` and `range`.
- Resets `page` to 1.
- Resets `sort`/`dir` to the target tab's default (`pts`/`desc` for regular,
  `pie`/`desc` for advanced; irrelevant for fantasy).
- Drops `mode`/`minimums` when landing on `advanced` or `fantasy` (they only
  apply to regular).

Active tab styled via `aria-current="page"`, matching `SideNav`'s existing
pattern.

### 3. Advanced aggregation (`lib/players/searchAdvanced.ts`)

New module, sibling to `search.ts` rather than a branch inside it — the
averaging math is different enough (nullable-aware mean vs. integer sum) that
sharing one file would mean threading a `tab` flag through most of its
functions.

```ts
export type PlayerAdvancedStats = {
  pie: number | null;
  pace: number | null;
  assistPercentage: number | null;
  assistRatio: number | null;
  assistToTurnover: number | null;
  defensiveRating: number | null;
  defensiveReboundPercentage: number | null;
  effectiveFieldGoalPercentage: number | null;
  netRating: number | null;
  offensiveRating: number | null;
  offensiveReboundPercentage: number | null;
  reboundPercentage: number | null;
  trueShootingPercentage: number | null;
  turnoverRatio: number | null;
  usagePercentage: number | null;
  gamesWithData: number;
};

export type AdvancedPlayerRow = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  stats: PlayerAdvancedStats;
};

export type PlayersAdvancedSearchResult = {
  rows: AdvancedPlayerRow[];
  total: number;
  page: number;
};

export const searchPlayersAdvanced = async (
  args: PlayersSearchParams,
): Promise<PlayersAdvancedSearchResult> => {
  /* ... */
};
```

- `where`: same population filter as `searchPlayers` (`gameLogs: { some: {} }`
  - optional name search) — keeps row counts identical across tabs so paging
    doesn't shift when switching.
- Select: `seasonStats` (`season` only, `take: 1`, `orderBy: season desc`) to
  anchor the "all" range to the player's latest season, plus
  `advancedGameLogs` (`take: 100`, `orderBy: gameDate desc`, all 15 metric
  fields) — 100 comfortably covers a full season (82 games) with margin.
- Averaging (`toAdvancedStats({ logs, range, latestSeason })`):
  - `range !== "all"`: take the first N logs (already ordered desc) per the
    range's game count.
  - `range === "all"`: filter fetched logs to `season === latestSeason` first.
  - For each of the 15 metrics: average over logs where that field is
    non-null; `null` if zero non-null logs (mirrors `"—"` display already
    used for missing regular stats). Track `gamesWithData` (max non-null count
    across metrics) for potential display/debugging, not used in sorting.
- Sorting: same two-path shape as `searchPlayers` —
  - Sort by `firstName`/`lastName`: paginate directly in Prisma
    (`skip`/`take`), compute stats only for the returned page.
  - Sort by a metric: fetch all candidates, compute stats for all, sort by
    the metric (nulls sort last regardless of direction — a player with no
    data for a metric isn't a "0"), paginate in memory. Ties break by
    lastName/firstName/id, matching `searchPlayers`.
- No minimums logic — the param is accepted (for round-tripping back to
  Regular) but has no effect here.

### 4. Advanced table (`app/players/page.tsx`)

- `page.tsx` branches on `params.tab`:
  - `regular`: existing code, unchanged.
  - `advanced`: calls `searchPlayersAdvanced`, renders a new
    `ADVANCED_STAT_COLUMNS` table (same `<table>`/`tableScroller` structure,
    sortable headers via the same `buildPlayersHref` pattern but pointed at
    `AdvancedSortKey`s).
  - `fantasy`: renders `ComingSoonPanel` only — no controls, no table, no
    data fetch.
- Column formatting: percentage-shaped metrics (`effectiveFieldGoalPercentage`,
  `trueShootingPercentage`, `assistPercentage`, `defensiveReboundPercentage`,
  `offensiveReboundPercentage`, `reboundPercentage`, `usagePercentage`) render
  as `.412`-style (matching existing FG%/3P%/FT% formatting); rate/count-shaped
  metrics (`pie`, `pace`, `assistRatio`, `assistToTurnover`, `defensiveRating`,
  `netRating`, `offensiveRating`, `turnoverRatio`) render to 1 decimal. `null`
  renders as `"—"`.
- `PlayersSearchControls`/`PlayersPager` gain a `tab` prop: on `advanced` they
  omit the mode select and minimums switch; on `fantasy` neither component
  renders.

### 5. `ComingSoonPanel` (`components/ComingSoonPanel/`)

Small presentational component: title, one-line description, "Coming soon"
badge. Used by the Fantasy Value tab and all three homepage cards.

```ts
type ComingSoonPanelProps = {
  title: string;
  description: string;
};
```

### 6. Homepage (`app/page.tsx`)

Becomes an async server component:

```ts
export default async function Home() {
  const profile = await getProfile();
  // ...
}
```

Three cards in a CSS-grid row (`display: grid`, `gap` token, container-driven
per project convention — no margin-based spacing):

1. **Your Team** — signed-out: "Sign in to start building your team" + link to
   `/login`. Signed-in: "You haven't built a team yet" + `ComingSoonPanel`.
2. **Watched Players** — same split; signed-in empty copy: "You aren't
   watching any players yet."
3. **Stat Trends to Watch** — not user-specific; explains the future feature
   ("Short on rebounds? We'll surface players trending up in REB.") wrapped in
   `ComingSoonPanel` regardless of auth state.

Each card shares one `HomeCard` layout (icon slot, title, body) so the grid
reads as one system. `HomeCard` and the grid live in
`app/page.tsx`/`page.module.scss` (not extracted to `components/` — homepage
is the only consumer today).

## Testing

- `searchParams.test.ts`: `tab` parses/defaults/round-trips; invalid `sort`
  for a given tab falls back to that tab's default.
- `searchAdvanced.test.ts`: null-skipping average per metric; `all` range
  scopes to latest season; `lastN` ranges take the right slice; sort-by-metric
  nulls-last; sort-by-name pagination fast path; population matches
  `searchPlayers`' `where`.
- `PlayersTabs.test.tsx`: three links render with correct hrefs; active tab
  gets `aria-current`.
- `ComingSoonPanel.test.tsx`: renders title/description/badge.
- `page.test.tsx` (players): each tab renders its expected content
  (table vs. `ComingSoonPanel`); controls hide mode/minimums on advanced,
  hide entirely on fantasy.
- `page.test.tsx` (home): three cards render; signed-out vs. signed-in copy
  via mocked `getProfile`.

Full gate: `bun run lint`, `tsc --noEmit`, `bun run test`.
