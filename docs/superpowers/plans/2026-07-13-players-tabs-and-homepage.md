# Players Tabs (Regular / Advanced / Fantasy) + Homepage Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Regular/Advanced/Fantasy Value tabs to `/players` (Advanced computes on-the-fly averages from `PlayerAdvancedGameLog`; Fantasy is a placeholder), and give the homepage three placeholder cards (your team, watched players, stat-need finder).

**Architecture:** A `tab` URL param drives a new `PlayersTabs` nav on `/players`. A sibling data module `lib/players/searchAdvanced.ts` mirrors the existing `lib/players/search.ts` shape but averages nullable per-game advanced metrics instead of summing counting stats. A shared `ComingSoonPanel` component covers the Fantasy tab and homepage empty states. No new Prisma models or migrations — everything is computed from existing tables.

**Tech Stack:** Next.js App Router (server components), Prisma 7 (`@generated/prisma/client`), Vitest + Testing Library, SCSS modules, Bun.

## Global Constraints

- All commands run through Bun (`bun run test`, `bun run lint`, `bun install`) — never npm/yarn.
- Full gate after every task: `bun run lint`, `bunx tsc --noEmit`, `bun run test`.
- Type aliases only, never `interface`. No `any`. No type casts (`as X`), except the pre-existing `as const` idiom on Prisma literal `orderBy` values (matches `lib/players/search.ts`).
- Prefer `reduce`/`map`/`filter` over `for`/`for-in`/`for-of` loops.
- Prefer a single object parameter for multi-argument functions.
- Optional chaining (`?.`) must pair with nullish coalescing (`??`).
- Import via `@/*` aliases only, never `../` relative paths.
- SCSS: CSS Grid first, then flex; container-driven sizing; no bare unstyled `<div>`s; only `styles/globals.scss` design tokens for spacing/color/radius/font-size.
- Commit after every task; subject starts with `CV:` (see repo's `cv-commit-format`-equivalent convention in `CLAUDE.md`).
- Tests are co-located: `foo.ts` ↔ `foo.test.ts`, `Foo.tsx` ↔ `Foo.test.tsx`.

---

## Task 1: Widen the players search-params domain for a `tab` and advanced sort keys

**Files:**

- Modify: `src/lib/players/searchParams.ts`
- Modify: `src/lib/players/searchParams.test.ts`
- Modify: `src/lib/players/search.test.ts` (fixture-only fix, no behavior change)
- Modify: `src/components/PlayersSearchControls/PlayersSearchControls.tsx` (type-only widen)
- Modify: `src/components/PlayersPager/PlayersPager.tsx` (type-only widen)

**Interfaces:**

- Produces: `PlayersTab` (`"regular" | "advanced" | "fantasy"`), `PLAYERS_TABS`, `DEFAULT_TAB`, `isPlayersTab`.
- Produces: `AdvancedMetricKey` (15-member union), `ADVANCED_METRIC_KEYS`.
- Produces: `AdvancedSortKey` (`"firstName" | "lastName" | AdvancedMetricKey`), `ADVANCED_SORT_KEYS`, `DEFAULT_ADVANCED_SORT_KEY` (`"pie"`), `isAdvancedSortKey`, `isAdvancedMetricKey`.
- Produces: `PlayersSearchParams` now has `sort: PlayerSortKey | AdvancedSortKey` and `tab: PlayersTab`.
- Consumed by: Task 2 (`searchAdvanced.ts`), Task 3 (`PlayersTabs`), Task 5 (controls), Task 6 (`page.tsx`).

- [ ] **Step 1: Write the failing tests**

Modify `src/lib/players/searchParams.test.ts` — replace the whole file with:

```ts
import { describe, expect, it } from "vitest";

import {
  buildPlayersHref,
  isAdvancedMetricKey,
  parsePlayersSearchParams,
} from "@/lib/players/searchParams";

describe("parsePlayersSearchParams", () => {
  it("returns defaults for empty input", () => {
    expect(parsePlayersSearchParams({})).toEqual({
      q: "",
      page: 1,
      size: 50,
      sort: "pts",
      dir: "desc",
      range: "all",
      mode: "average",
      minimums: true,
      tab: "regular",
    });
  });

  it.each([
    [{ q: "  curry  " }, { q: "curry" }],
    [{ q: "x".repeat(150) }, { q: "x".repeat(100) }],
    [{ page: "3" }, { page: 3 }],
    [{ page: "0" }, { page: 1 }],
    [{ page: "-2" }, { page: 1 }],
    [{ page: "abc" }, { page: 1 }],
    [{ page: "9".repeat(400) }, { page: 1 }],
    [{ page: "99999999999999999999" }, { page: 1 }],
    [{ size: "50" }, { size: 50 }],
    [{ size: "33" }, { size: 50 }],
    [{ size: "" }, { size: 50 }],
    [{ sort: "lastName" }, { sort: "lastName" }],
    [{ sort: "firstName" }, { sort: "firstName" }],
    [{ sort: "teamAbbr" }, { sort: "pts" }],
    [{ sort: "" }, { sort: "pts" }],
    [{ dir: "desc" }, { dir: "desc" }],
    [{ dir: "asc" }, { dir: "asc" }],
    [{ dir: "up" }, { dir: "desc" }],
    [{ range: "last5" }, { range: "last5" }],
    [{ range: "last20" }, { range: "last20" }],
    [{ range: "10" }, { range: "all" }],
    [{ mode: "total" }, { mode: "total" }],
    [{ mode: "perGame" }, { mode: "average" }],
    [{ minimums: "0" }, { minimums: false }],
    [{ minimums: "1" }, { minimums: true }],
    [{ minimums: "false" }, { minimums: true }],
    [{ tab: "advanced" }, { tab: "advanced" }],
    [{ tab: "fantasy" }, { tab: "fantasy" }],
    [{ tab: "bogus" }, { tab: "regular" }],
    [{ tab: "" }, { tab: "regular" }],
  ])("normalizes %j", (raw, expected) => {
    expect(parsePlayersSearchParams(raw)).toMatchObject(expected);
  });

  it("validates sort against the advanced tab's own key set, defaulting to pie", () => {
    expect(parsePlayersSearchParams({ tab: "advanced", sort: "usagePercentage" })).toMatchObject({
      tab: "advanced",
      sort: "usagePercentage",
    });
    expect(parsePlayersSearchParams({ tab: "advanced", sort: "pts" })).toMatchObject({
      tab: "advanced",
      sort: "pie",
    });
    expect(parsePlayersSearchParams({ tab: "advanced", sort: "firstName" })).toMatchObject({
      tab: "advanced",
      sort: "firstName",
    });
  });

  it("validates sort against the regular tab's own key set, defaulting to pts", () => {
    expect(parsePlayersSearchParams({ tab: "regular", sort: "pie" })).toMatchObject({
      tab: "regular",
      sort: "pts",
    });
    expect(parsePlayersSearchParams({ sort: "pie" })).toMatchObject({
      tab: "regular",
      sort: "pts",
    });
  });
});

describe("buildPlayersHref", () => {
  const defaults = {
    q: "",
    page: 1,
    size: 50,
    sort: "pts",
    dir: "desc",
    range: "all",
    mode: "average",
    minimums: true,
    tab: "regular",
  } as const;

  it("returns the bare path when everything is default", () => {
    expect(buildPlayersHref(defaults)).toBe("/players");
  });

  it("omits default sort and dir but includes non-default values", () => {
    expect(buildPlayersHref({ ...defaults, sort: "lastName" })).toBe("/players?sort=lastName");
    expect(buildPlayersHref({ ...defaults, dir: "desc" })).toBe("/players");
    expect(buildPlayersHref({ ...defaults, dir: "asc" })).toBe("/players?dir=asc");
    expect(buildPlayersHref({ ...defaults, sort: "lastName", dir: "desc" })).toBe(
      "/players?sort=lastName",
    );
  });

  it("combines all non-default params", () => {
    expect(
      buildPlayersHref({
        q: "curry",
        page: 2,
        size: 25,
        sort: "lastName",
        dir: "desc",
        range: "last5",
        mode: "total",
        minimums: false,
        tab: "regular",
      }),
    ).toBe("/players?q=curry&page=2&size=25&sort=lastName&range=last5&mode=total&minimums=0");
  });

  it("includes a non-default tab and adjusts the omitted default sort per tab", () => {
    expect(buildPlayersHref({ ...defaults, tab: "advanced", sort: "pie" })).toBe(
      "/players?tab=advanced",
    );
    expect(buildPlayersHref({ ...defaults, tab: "advanced", sort: "usagePercentage" })).toBe(
      "/players?tab=advanced&sort=usagePercentage",
    );
    expect(buildPlayersHref({ ...defaults, tab: "fantasy" })).toBe("/players?tab=fantasy");
  });
});

describe("isAdvancedMetricKey", () => {
  it("excludes name keys and regular counting-stat keys, includes advanced metric keys", () => {
    expect(isAdvancedMetricKey("firstName")).toBe(false);
    expect(isAdvancedMetricKey("lastName")).toBe(false);
    expect(isAdvancedMetricKey("pts")).toBe(false);
    expect(isAdvancedMetricKey("pie")).toBe(true);
    expect(isAdvancedMetricKey("usagePercentage")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/players/searchParams.test.ts`
Expected: FAIL — `tab`, `isAdvancedMetricKey` etc. don't exist yet; snapshot objects missing `tab`.

- [ ] **Step 3: Implement `searchParams.ts`**

Replace the full contents of `src/lib/players/searchParams.ts` with:

```ts
export const PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_QUERY_LENGTH = 100;

export type PlayerSortKey =
  | "firstName"
  | "lastName"
  | "gamesPlayed"
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "fgm"
  | "fga"
  | "fg3m"
  | "fg3a"
  | "fgPct"
  | "fg3Pct"
  | "ftPct"
  | "tov";
export const PLAYER_SORT_KEYS: readonly PlayerSortKey[] = [
  "firstName",
  "lastName",
  "gamesPlayed",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "fgPct",
  "fg3Pct",
  "ftPct",
  "tov",
];
export type SortDirection = "asc" | "desc";
export type PlayerGameRange = "all" | "last5" | "last10" | "last20" | "last40" | "last60";
export const PLAYER_GAME_RANGES: readonly PlayerGameRange[] = [
  "all",
  "last5",
  "last10",
  "last20",
  "last40",
  "last60",
];
export type PlayerStatMode = "average" | "total";
// The landing view sorts by points, highest first, so the leaderboard shows
// on arrival without query params.
export const DEFAULT_SORT_KEY: PlayerSortKey = "pts";
export const DEFAULT_SORT_DIR: SortDirection = "desc";

// The three /players tabs. Fantasy has no data yet; it renders a
// ComingSoonPanel only.
export type PlayersTab = "regular" | "advanced" | "fantasy";
export const PLAYERS_TABS: readonly PlayersTab[] = ["regular", "advanced", "fantasy"];
export const DEFAULT_TAB: PlayersTab = "regular";

export const isPlayersTab = (value: string | undefined): value is PlayersTab =>
  PLAYERS_TABS.some((tab) => tab === value);

// The 15 nullable per-game metrics Balldontlie's /v1/stats/advanced exposes,
// averaged on the fly from PlayerAdvancedGameLog (see lib/players/searchAdvanced.ts).
export type AdvancedMetricKey =
  | "pie"
  | "pace"
  | "assistPercentage"
  | "assistRatio"
  | "assistToTurnover"
  | "defensiveRating"
  | "defensiveReboundPercentage"
  | "effectiveFieldGoalPercentage"
  | "netRating"
  | "offensiveRating"
  | "offensiveReboundPercentage"
  | "reboundPercentage"
  | "trueShootingPercentage"
  | "turnoverRatio"
  | "usagePercentage";

export const ADVANCED_METRIC_KEYS: readonly AdvancedMetricKey[] = [
  "pie",
  "pace",
  "assistPercentage",
  "assistRatio",
  "assistToTurnover",
  "defensiveRating",
  "defensiveReboundPercentage",
  "effectiveFieldGoalPercentage",
  "netRating",
  "offensiveRating",
  "offensiveReboundPercentage",
  "reboundPercentage",
  "trueShootingPercentage",
  "turnoverRatio",
  "usagePercentage",
];

export type AdvancedSortKey = "firstName" | "lastName" | AdvancedMetricKey;
export const ADVANCED_SORT_KEYS: readonly AdvancedSortKey[] = [
  "firstName",
  "lastName",
  ...ADVANCED_METRIC_KEYS,
];
// PIE is the single-number "estimate" stat, closest to a default leaderboard sort.
export const DEFAULT_ADVANCED_SORT_KEY: AdvancedSortKey = "pie";

export const isAdvancedSortKey = (value: string | undefined): value is AdvancedSortKey =>
  ADVANCED_SORT_KEYS.some((key) => key === value);

export const isAdvancedMetricKey = (
  key: PlayerSortKey | AdvancedSortKey,
): key is AdvancedMetricKey => ADVANCED_METRIC_KEYS.some((metricKey) => metricKey === key);

export type PlayersSearchParams = {
  q: string;
  page: number;
  size: number;
  sort: PlayerSortKey | AdvancedSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
  tab: PlayersTab;
};

const isPlayerSortKey = (value: string | undefined): value is PlayerSortKey =>
  PLAYER_SORT_KEYS.some((key) => key === value);

export const isPlayerGameRange = (value: string | undefined): value is PlayerGameRange =>
  PLAYER_GAME_RANGES.some((range) => range === value);

export const isPlayerStatMode = (value: string | undefined): value is PlayerStatMode =>
  value === "average" || value === "total";

export const parsePlayersSearchParams = (raw: {
  q?: string;
  page?: string;
  size?: string;
  sort?: string;
  dir?: string;
  range?: string;
  mode?: string;
  minimums?: string;
  tab?: string;
}): PlayersSearchParams => {
  const q = (raw.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const parsedPage = Number.parseInt(raw.page ?? "", 10);
  const page = !Number.isSafeInteger(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const parsedSize = Number.parseInt(raw.size ?? "", 10);
  const size = PAGE_SIZES.includes(parsedSize) ? parsedSize : DEFAULT_PAGE_SIZE;
  const tab: PlayersTab = isPlayersTab(raw.tab) ? raw.tab : DEFAULT_TAB;
  const sort: PlayerSortKey | AdvancedSortKey =
    tab === "advanced"
      ? isAdvancedSortKey(raw.sort)
        ? raw.sort
        : DEFAULT_ADVANCED_SORT_KEY
      : isPlayerSortKey(raw.sort)
        ? raw.sort
        : DEFAULT_SORT_KEY;
  const dir: SortDirection = raw.dir === "asc" ? "asc" : DEFAULT_SORT_DIR;
  const range: PlayerGameRange = isPlayerGameRange(raw.range) ? raw.range : "all";
  const mode: PlayerStatMode = isPlayerStatMode(raw.mode) ? raw.mode : "average";
  // NBA qualifying minimums apply by default; only an explicit 0 disables them.
  const minimums = raw.minimums !== "0";
  return { q, page, size, sort, dir, range, mode, minimums, tab };
};

export const buildPlayersHref = (args: PlayersSearchParams): string => {
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
  if (args.tab !== DEFAULT_TAB) {
    params.set("tab", args.tab);
  }
  const defaultSort = args.tab === "advanced" ? DEFAULT_ADVANCED_SORT_KEY : DEFAULT_SORT_KEY;
  if (args.sort !== defaultSort) {
    params.set("sort", args.sort);
  }
  if (args.dir !== DEFAULT_SORT_DIR) {
    params.set("dir", args.dir);
  }
  if (args.range !== "all") {
    params.set("range", args.range);
  }
  if (args.mode !== "average") {
    params.set("mode", args.mode);
  }
  if (!args.minimums) {
    params.set("minimums", "0");
  }
  const query = params.toString();
  return query === "" ? "/players" : `/players?${query}`;
};
```

- [ ] **Step 4: Fix the `PlayersSearchParams` fixture in `search.test.ts`**

Modify `src/lib/players/search.test.ts:19-28` — add the required `tab` field (no other change; `search.ts` itself needs no edits since it only destructures `q`/`page`/`size`/`sort`/`dir`/`range` from `args`):

```ts
const defaultParams: PlayersSearchParams = {
  q: "",
  page: 1,
  size: 25,
  sort: "firstName",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  tab: "regular",
};
```

- [ ] **Step 5: Widen the `sort` prop type in the two consuming components**

Modify `src/components/PlayersSearchControls/PlayersSearchControls.tsx` — update the import and prop type only (no behavior change yet):

```ts
import {
  buildPlayersHref,
  isPlayerGameRange,
  isPlayerStatMode,
  MAX_QUERY_LENGTH,
  type AdvancedSortKey,
  type PlayerSortKey,
  type PlayerGameRange,
  type PlayerStatMode,
  type SortDirection,
} from "@/lib/players/searchParams";
```

```ts
export type PlayersSearchControlsProps = {
  q: string;
  size: number;
  sort: PlayerSortKey | AdvancedSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
};
```

Modify `src/components/PlayersPager/PlayersPager.tsx` — same pattern:

```ts
import {
  buildPlayersHref,
  PAGE_SIZES,
  type AdvancedSortKey,
  type PlayerGameRange,
  type PlayerSortKey,
  type PlayerStatMode,
  type SortDirection,
} from "@/lib/players/searchParams";
```

```ts
export type PlayersPagerProps = {
  q: string;
  page: number;
  size: number;
  totalPages: number;
  sort: PlayerSortKey | AdvancedSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
};
```

- [ ] **Step 6: Run the full test suite and type check**

Run: `bun run test && bunx tsc --noEmit`
Expected: PASS — all existing suites plus the new/updated `searchParams.test.ts` and `search.test.ts` green, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/players/searchParams.ts src/lib/players/searchParams.test.ts \
  src/lib/players/search.test.ts \
  src/components/PlayersSearchControls/PlayersSearchControls.tsx \
  src/components/PlayersPager/PlayersPager.tsx
git commit -m "$(cat <<'EOF'
CV: add tab and advanced sort-key vocabulary to players search params

- New PlayersTab (regular/advanced/fantasy) with URL round-tripping
- New AdvancedSortKey/AdvancedMetricKey covering the 15 BDL advanced metrics
- Widen shared sort prop type in PlayersSearchControls/PlayersPager (type-only)
EOF
)"
```

---

## Task 2: Advanced stats aggregation module

**Files:**

- Create: `src/lib/players/searchAdvanced.ts`
- Create: `src/lib/players/searchAdvanced.test.ts`

**Interfaces:**

- Consumes: `AdvancedMetricKey`, `ADVANCED_METRIC_KEYS`, `isAdvancedMetricKey`, `PlayerGameRange`, `PlayersSearchParams` from `@/lib/players/searchParams` (Task 1); `prisma` from `@/lib/prisma`.
- Produces: `PlayerAdvancedStats`, `AdvancedPlayerRow`, `PlayersAdvancedSearchResult`, `searchPlayersAdvanced(args: PlayersSearchParams): Promise<PlayersAdvancedSearchResult>` — consumed by Task 6 (`page.tsx`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/players/searchAdvanced.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlayersAdvanced } from "@/lib/players/searchAdvanced";
import type { PlayersSearchParams } from "@/lib/players/searchParams";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { prisma } from "@/lib/prisma";

const defaultParams: PlayersSearchParams = {
  q: "",
  page: 1,
  size: 25,
  sort: "pie",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  tab: "advanced",
};

const buildLog = (overrides: { gameDate?: Date; season?: string; pie?: number | null } = {}) => ({
  gameDate: overrides.gameDate ?? new Date("2025-11-01"),
  season: overrides.season ?? "2025-26",
  pie: overrides.pie === undefined ? 15 : overrides.pie,
  pace: 98,
  assistPercentage: 0.2,
  assistRatio: 20,
  assistToTurnover: 2,
  defensiveRating: 110,
  defensiveReboundPercentage: 0.1,
  effectiveFieldGoalPercentage: 0.5,
  netRating: 4,
  offensiveRating: 114,
  offensiveReboundPercentage: 0.05,
  reboundPercentage: 0.08,
  trueShootingPercentage: 0.55,
  turnoverRatio: 12,
  usagePercentage: 0.25,
});

describe("searchPlayersAdvanced", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls findMany with the active-player where clause when sorting by name", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    await searchPlayersAdvanced({ ...defaultParams, sort: "firstName", dir: "asc" });

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gameLogs: { some: {} } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
        skip: 0,
        take: 25,
      }),
    );
  });

  it("adds a fullName search condition when q is provided", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    await searchPlayersAdvanced({ ...defaultParams, sort: "firstName", q: "curry" });

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gameLogs: { some: {} }, fullName: { contains: "curry", mode: "insensitive" } },
      }),
    );
  });

  it("averages non-null metrics over the last-N games and skips null-metric games", async () => {
    const rows = [
      {
        id: 1,
        firstName: "Alpha",
        lastName: "One",
        fullName: "Alpha One",
        teamAbbr: "AAA",
        position: "G",
        nbaPersonId: null,
        seasonStats: [{ season: "2025-26" }],
        advancedGameLogs: [buildLog({ pie: 20 }), buildLog({ pie: null }), buildLog({ pie: 10 })],
      },
    ];
    vi.mocked(prisma.player.findMany).mockResolvedValue(rows);

    const result = await searchPlayersAdvanced({ ...defaultParams, sort: "pie", range: "last5" });

    // (20 + 10) / 2 non-null games = 15; the null game is skipped, not treated as 0.
    expect(result.rows[0].stats.pie).toBe(15);
  });

  it("scopes the all range to the player's latest season", async () => {
    const rows = [
      {
        id: 1,
        firstName: "Beta",
        lastName: "Two",
        fullName: "Beta Two",
        teamAbbr: "BBB",
        position: "F",
        nbaPersonId: null,
        seasonStats: [{ season: "2025-26" }],
        advancedGameLogs: [
          buildLog({ season: "2025-26", pie: 30 }),
          buildLog({ season: "2024-25", pie: 5 }),
        ],
      },
    ];
    vi.mocked(prisma.player.findMany).mockResolvedValue(rows);

    const result = await searchPlayersAdvanced({ ...defaultParams, sort: "pie", range: "all" });

    // Only the 2025-26 log counts; the 2024-25 log is excluded from the average.
    expect(result.rows[0].stats.pie).toBe(30);
  });

  it("sorts by a metric with null values sinking to the bottom regardless of direction", async () => {
    const withData = {
      id: 1,
      firstName: "Gamma",
      lastName: "Three",
      fullName: "Gamma Three",
      teamAbbr: "CCC",
      position: "C",
      nbaPersonId: null,
      seasonStats: [{ season: "2025-26" }],
      advancedGameLogs: [buildLog({ pie: 12 })],
    };
    const noData = {
      id: 2,
      firstName: "Delta",
      lastName: "Four",
      fullName: "Delta Four",
      teamAbbr: "DDD",
      position: "F",
      nbaPersonId: null,
      seasonStats: [{ season: "2025-26" }],
      advancedGameLogs: [],
    };

    vi.mocked(prisma.player.findMany).mockResolvedValue([noData, withData]);
    const ascending = await searchPlayersAdvanced({ ...defaultParams, sort: "pie", dir: "asc" });
    expect(ascending.rows.map((row) => row.id)).toEqual([1, 2]);

    vi.mocked(prisma.player.findMany).mockResolvedValue([noData, withData]);
    const descending = await searchPlayersAdvanced({ ...defaultParams, sort: "pie", dir: "desc" });
    expect(descending.rows.map((row) => row.id)).toEqual([1, 2]);
  });

  it("clamps the page when the requested page exceeds available data", async () => {
    const secondPageRows = [
      {
        id: 2,
        firstName: "Echo",
        lastName: "",
        fullName: "Echo",
        teamAbbr: "EEE",
        position: "SF",
        nbaPersonId: null,
        seasonStats: [{ season: "2025-26" }],
        advancedGameLogs: [],
      },
    ];
    vi.mocked(prisma.player.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(secondPageRows);
    vi.mocked(prisma.player.count).mockResolvedValue(30);

    const result = await searchPlayersAdvanced({
      ...defaultParams,
      sort: "firstName",
      dir: "desc",
      page: 9,
    });

    expect(result).toEqual({
      rows: [expect.objectContaining({ id: 2 })],
      total: 30,
      page: 2,
    });
  });

  it("returns empty rows on page 1 when there are zero matches", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    const result = await searchPlayersAdvanced({ ...defaultParams, sort: "firstName" });

    expect(result).toEqual({ rows: [], total: 0, page: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/lib/players/searchAdvanced.test.ts`
Expected: FAIL with "Cannot find module '@/lib/players/searchAdvanced'".

- [ ] **Step 3: Implement `searchAdvanced.ts`**

Create `src/lib/players/searchAdvanced.ts`:

```ts
import { Prisma } from "@generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  ADVANCED_METRIC_KEYS,
  isAdvancedMetricKey,
  type AdvancedMetricKey,
  type PlayerGameRange,
  type PlayersSearchParams,
} from "@/lib/players/searchParams";

export type PlayerAdvancedStats = Record<AdvancedMetricKey, number | null> & {
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

type AdvancedGameLogRow = Record<AdvancedMetricKey, number | null> & {
  gameDate: Date;
  season: string;
};

type AdvancedPlayerCandidate = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  seasonStats: Array<{ season: string }>;
  advancedGameLogs: AdvancedGameLogRow[];
};

const advancedMetricSelect = {
  pie: true,
  pace: true,
  assistPercentage: true,
  assistRatio: true,
  assistToTurnover: true,
  defensiveRating: true,
  defensiveReboundPercentage: true,
  effectiveFieldGoalPercentage: true,
  netRating: true,
  offensiveRating: true,
  offensiveReboundPercentage: true,
  reboundPercentage: true,
  trueShootingPercentage: true,
  turnoverRatio: true,
  usagePercentage: true,
};

// A full season tops out at 82 regular-season games (postseason is excluded
// from the sync); 100 leaves comfortable margin without an unbounded fetch.
const ADVANCED_GAME_LOG_FETCH_LIMIT = 100;

const advancedRowSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  teamAbbr: true,
  position: true,
  nbaPersonId: true,
  seasonStats: {
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" as const },
    take: 1,
    select: { season: true },
  },
  advancedGameLogs: {
    orderBy: { gameDate: "desc" as const },
    take: ADVANCED_GAME_LOG_FETCH_LIMIT,
    select: {
      gameDate: true,
      season: true,
      ...advancedMetricSelect,
    },
  },
};

const emptyAdvancedStats = (): PlayerAdvancedStats => ({
  pie: null,
  pace: null,
  assistPercentage: null,
  assistRatio: null,
  assistToTurnover: null,
  defensiveRating: null,
  defensiveReboundPercentage: null,
  effectiveFieldGoalPercentage: null,
  netRating: null,
  offensiveRating: null,
  offensiveReboundPercentage: null,
  reboundPercentage: null,
  trueShootingPercentage: null,
  turnoverRatio: null,
  usagePercentage: null,
  gamesWithData: 0,
});

const average = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

const gameCountFor = (range: PlayerGameRange): number | null =>
  range === "all" ? null : Number.parseInt(range.replace("last", ""), 10);

const toAdvancedStats = ({ logs }: { logs: readonly AdvancedGameLogRow[] }): PlayerAdvancedStats =>
  ADVANCED_METRIC_KEYS.reduce<PlayerAdvancedStats>(
    (stats, key) => ({
      ...stats,
      [key]: average(
        logs.map((log) => log[key]).filter((value): value is number => value !== null),
      ),
    }),
    { ...emptyAdvancedStats(), gamesWithData: logs.length },
  );

const toAdvancedPlayerRow = ({
  row,
  range,
}: {
  row: AdvancedPlayerCandidate;
  range: PlayerGameRange;
}): AdvancedPlayerRow => {
  const limit = gameCountFor(range);
  const latestSeason = row.seasonStats[0]?.season ?? null;
  const scoped =
    limit === null
      ? row.advancedGameLogs.filter((log) => log.season === latestSeason)
      : row.advancedGameLogs.slice(0, limit);
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    teamAbbr: row.teamAbbr,
    position: row.position,
    nbaPersonId: row.nbaPersonId,
    stats: toAdvancedStats({ logs: scoped }),
  };
};

export const searchPlayersAdvanced = async (
  args: PlayersSearchParams,
): Promise<PlayersAdvancedSearchResult> => {
  const { q, page, size, sort, dir, range } = args;
  const where: Prisma.PlayerWhereInput = {
    gameLogs: { some: {} },
    ...(q === "" ? {} : { fullName: { contains: q, mode: "insensitive" } }),
  };
  const orderBy: Prisma.PlayerOrderByWithRelationInput[] =
    sort === "lastName"
      ? [{ lastName: dir }, { firstName: dir }, { id: "asc" }]
      : [{ firstName: dir }, { lastName: dir }, { id: "asc" }];

  if (isAdvancedMetricKey(sort)) {
    const candidates = await prisma.player.findMany({ where, select: advancedRowSelect });
    const sortedRows = candidates
      .map((row) => toAdvancedPlayerRow({ row, range }))
      .sort((a, b) => {
        const aValue = a.stats[sort];
        const bValue = b.stats[sort];
        const aIsNull = aValue === null ? 1 : 0;
        const bIsNull = bValue === null ? 1 : 0;
        if (aIsNull !== bIsNull) return aIsNull - bIsNull;
        const difference = (aValue ?? 0) - (bValue ?? 0);
        if (difference !== 0) return dir === "asc" ? difference : -difference;
        return (
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.id - b.id
        );
      });
    const total = sortedRows.length;
    const lastPage = Math.max(1, Math.ceil(total / size));
    const clampedPage = Math.min(page, lastPage);
    return {
      rows: sortedRows.slice((clampedPage - 1) * size, clampedPage * size),
      total,
      page: total === 0 ? 1 : clampedPage,
    };
  }

  const pageQuery = (pageNumber: number) =>
    prisma.player.findMany({
      where,
      select: advancedRowSelect,
      orderBy,
      skip: (pageNumber - 1) * size,
      take: size,
    });

  const [rows, total] = await prisma.$transaction([
    pageQuery(page),
    prisma.player.count({ where }),
  ]);
  if (rows.length > 0 || total === 0) {
    return {
      rows: rows.map((row) => toAdvancedPlayerRow({ row, range })),
      total,
      page: total === 0 ? 1 : page,
    };
  }
  const lastPage = Math.max(1, Math.ceil(total / size));
  const clamped = await pageQuery(lastPage);
  return {
    rows: clamped.map((row) => toAdvancedPlayerRow({ row, range })),
    total,
    page: lastPage,
  };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/players/searchAdvanced.test.ts`
Expected: PASS — all 7 cases green.

- [ ] **Step 5: Run the full gate**

Run: `bun run lint && bunx tsc --noEmit && bun run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/players/searchAdvanced.ts src/lib/players/searchAdvanced.test.ts
git commit -m "$(cat <<'EOF'
CV: add advanced-stats aggregation module

- searchPlayersAdvanced averages PlayerAdvancedGameLog per player on the fly
- Null metrics are skipped (not zeroed) when averaging or sorting
- all range scopes to the player's latest season; lastN ranges are season-agnostic
EOF
)"
```

---

## Task 3: `PlayersTabs` component

**Files:**

- Create: `src/components/PlayersTabs/PlayersTabs.tsx`
- Create: `src/components/PlayersTabs/PlayersTabs.module.scss`
- Create: `src/components/PlayersTabs/PlayersTabs.test.tsx`

**Interfaces:**

- Consumes: `buildPlayersHref`, `DEFAULT_ADVANCED_SORT_KEY`, `DEFAULT_SORT_DIR`, `DEFAULT_SORT_KEY`, `PlayerGameRange`, `PlayersTab` from `@/lib/players/searchParams`.
- Produces: `PlayersTabs({ active, q, size, range }): JSX.Element` — consumed by Task 6 (`page.tsx`).

- [ ] **Step 1: Write the failing test**

Create `src/components/PlayersTabs/PlayersTabs.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlayersTabs } from "@/components/PlayersTabs/PlayersTabs";

afterEach(cleanup);

describe("PlayersTabs", () => {
  it("renders three tab links with tab-scoped hrefs", () => {
    render(<PlayersTabs active="regular" q="" size={50} range="all" />);

    expect(screen.getByRole("link", { name: /Regular Stats/ })).toHaveAttribute("href", "/players");
    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "href",
      "/players?tab=advanced",
    );
    expect(screen.getByRole("link", { name: /Fantasy Value/ })).toHaveAttribute(
      "href",
      "/players?tab=fantasy",
    );
  });

  it("marks the active tab with aria-current", () => {
    render(<PlayersTabs active="advanced" q="" size={50} range="all" />);

    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Regular Stats/ })).not.toHaveAttribute("aria-current");
  });

  it("preserves the search query and game range across tabs", () => {
    render(<PlayersTabs active="regular" q="curry" size={25} range="last20" />);

    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "href",
      "/players?q=curry&size=25&tab=advanced&range=last20",
    );
  });

  it("shows a Soon badge on the Fantasy Value tab", () => {
    render(<PlayersTabs active="regular" q="" size={50} range="all" />);

    expect(screen.getByText("Soon")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/PlayersTabs/PlayersTabs.test.tsx`
Expected: FAIL with "Cannot find module '@/components/PlayersTabs/PlayersTabs'".

- [ ] **Step 3: Implement the component**

Create `src/components/PlayersTabs/PlayersTabs.tsx`:

```tsx
import Link from "next/link";

import {
  buildPlayersHref,
  DEFAULT_ADVANCED_SORT_KEY,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_KEY,
  type PlayerGameRange,
  type PlayersTab,
} from "@/lib/players/searchParams";

import styles from "@/components/PlayersTabs/PlayersTabs.module.scss";

const TAB_ENTRIES: ReadonlyArray<{ tab: PlayersTab; label: string }> = [
  { tab: "regular", label: "Regular Stats" },
  { tab: "advanced", label: "Advanced Stats" },
  { tab: "fantasy", label: "Fantasy Value" },
];

export type PlayersTabsProps = {
  active: PlayersTab;
  q: string;
  size: number;
  range: PlayerGameRange;
};

export function PlayersTabs({ active, q, size, range }: PlayersTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Player stat views">
      <ul className={styles.list}>
        {TAB_ENTRIES.map((entry) => {
          const isActive = entry.tab === active;
          const href = buildPlayersHref({
            q,
            page: 1,
            size,
            sort: entry.tab === "advanced" ? DEFAULT_ADVANCED_SORT_KEY : DEFAULT_SORT_KEY,
            dir: DEFAULT_SORT_DIR,
            range,
            mode: "average",
            minimums: true,
            tab: entry.tab,
          });
          return (
            <li key={entry.tab} className={styles.item}>
              <Link
                href={href}
                className={styles.link}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive ? "true" : undefined}
              >
                {entry.label}
                {entry.tab === "fantasy" && <span className={styles.badge}>Soon</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

Create `src/components/PlayersTabs/PlayersTabs.module.scss`:

```scss
@use "@/styles/mixins" as *;

.tabs {
  display: grid;
}

.list {
  display: flex;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid var(--color-border);
}

.item {
  display: grid;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);

  &:hover {
    color: var(--color-text);
    text-decoration: none;
  }

  &[data-active="true"] {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }
}

.badge {
  @include micro-label;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-highlight) 18%, transparent);
  color: var(--color-highlight);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/components/PlayersTabs/PlayersTabs.test.tsx`
Expected: PASS — all 4 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayersTabs
git commit -m "$(cat <<'EOF'
CV: add PlayersTabs nav for the players page

- Regular/Advanced/Fantasy tab links, active state via aria-current
- Preserves search query and game range across tabs, resets page/sort/mode
EOF
)"
```

---

## Task 4: `ComingSoonPanel` component

**Files:**

- Create: `src/components/ComingSoonPanel/ComingSoonPanel.tsx`
- Create: `src/components/ComingSoonPanel/ComingSoonPanel.module.scss`
- Create: `src/components/ComingSoonPanel/ComingSoonPanel.test.tsx`

**Interfaces:**

- Produces: `ComingSoonPanel({ title, description }): JSX.Element` — consumed by Task 6 (Fantasy tab) and Task 7 (homepage).

- [ ] **Step 1: Write the failing test**

Create `src/components/ComingSoonPanel/ComingSoonPanel.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ComingSoonPanel } from "@/components/ComingSoonPanel/ComingSoonPanel";

afterEach(cleanup);

describe("ComingSoonPanel", () => {
  it("renders the title, description, and a coming soon badge", () => {
    render(<ComingSoonPanel title="Fantasy Value" description="A blended score is on the way." />);

    expect(screen.getByRole("heading", { name: "Fantasy Value" })).toBeInTheDocument();
    expect(screen.getByText("A blended score is on the way.")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/ComingSoonPanel/ComingSoonPanel.test.tsx`
Expected: FAIL with "Cannot find module '@/components/ComingSoonPanel/ComingSoonPanel'".

- [ ] **Step 3: Implement the component**

Create `src/components/ComingSoonPanel/ComingSoonPanel.tsx`:

```tsx
import styles from "@/components/ComingSoonPanel/ComingSoonPanel.module.scss";

export type ComingSoonPanelProps = {
  title: string;
  description: string;
};

export function ComingSoonPanel({ title, description }: ComingSoonPanelProps) {
  return (
    <section className={styles.panel} aria-label={title}>
      <span className={styles.badge}>Coming soon</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </section>
  );
}
```

Create `src/components/ComingSoonPanel/ComingSoonPanel.module.scss`:

```scss
@use "@/styles/mixins" as *;

.panel {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  padding: var(--space-6);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.badge {
  @include micro-label;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-highlight) 18%, transparent);
  color: var(--color-highlight);
}

.title {
  margin: 0;
  font-size: var(--font-size-lg);
}

.description {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/components/ComingSoonPanel/ComingSoonPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ComingSoonPanel
git commit -m "CV: add shared ComingSoonPanel for unbuilt features"
```

---

## Task 5: Tab-aware `PlayersSearchControls` and `PlayersPager`

**Files:**

- Modify: `src/components/PlayersSearchControls/PlayersSearchControls.tsx`
- Modify: `src/components/PlayersSearchControls/PlayersSearchControls.test.tsx`
- Modify: `src/components/PlayersPager/PlayersPager.tsx`
- Modify: `src/components/PlayersPager/PlayersPager.test.tsx`

**Interfaces:**

- Produces: both components gain an optional `tab?: PlayersTab` prop (default `"regular"`), threaded into every `buildPlayersHref` call; `PlayersSearchControls` hides the Stats select and Qualifying-minimums switch when `tab === "advanced"`.

- [ ] **Step 1: Write the failing tests**

Modify `src/components/PlayersSearchControls/PlayersSearchControls.test.tsx` — add at the end of the `describe("PlayersSearchControls", ...)` block, just before the closing `});`:

```tsx
it("shows the stat display select and minimums switch on the regular tab", () => {
  render(<PlayersSearchControls {...defaultProps} tab="regular" />);

  expect(screen.getByLabelText("Stat display")).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Qualifying minimums" })).toBeInTheDocument();
});

it("hides the stat display select and qualifying minimums switch on the advanced tab", () => {
  render(<PlayersSearchControls {...defaultProps} tab="advanced" />);

  expect(screen.queryByLabelText("Stat display")).not.toBeInTheDocument();
  expect(screen.queryByRole("switch", { name: "Qualifying minimums" })).not.toBeInTheDocument();
});

it("includes the tab in the search navigation href", () => {
  render(<PlayersSearchControls {...defaultProps} tab="advanced" sort="pie" />);

  const input = screen.getByLabelText("Search players");
  fireEvent.change(input, { target: { value: "cur" } });
  advance(300);

  expect(replace).toHaveBeenLastCalledWith("/players?q=cur&tab=advanced");
});
```

Modify `src/components/PlayersPager/PlayersPager.test.tsx` — add at the end of the `describe("PlayersPager", ...)` block, just before the closing `});`:

```tsx
it("includes the tab when navigating to another page", () => {
  render(<PlayersPager {...defaultProps} tab="advanced" sort="pie" totalPages={3} />);

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  expect(replace).toHaveBeenCalledWith("/players?page=2&tab=advanced");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/PlayersSearchControls src/components/PlayersPager`
Expected: FAIL — `tab` prop not recognized/rendered yet; hide-logic doesn't exist.

- [ ] **Step 3: Implement `tab`-awareness in `PlayersSearchControls`**

Modify `src/components/PlayersSearchControls/PlayersSearchControls.tsx`:

Add `type PlayersTab` to the import (already imports from the same module):

```ts
import {
  buildPlayersHref,
  isPlayerGameRange,
  isPlayerStatMode,
  MAX_QUERY_LENGTH,
  type AdvancedSortKey,
  type PlayerSortKey,
  type PlayerGameRange,
  type PlayerStatMode,
  type PlayersTab,
  type SortDirection,
} from "@/lib/players/searchParams";
```

Add `tab` to the props type:

```ts
export type PlayersSearchControlsProps = {
  q: string;
  size: number;
  sort: PlayerSortKey | AdvancedSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
  tab?: PlayersTab;
};
```

Update the function signature to destructure `tab` with a default, and thread it into every `buildPlayersHref` call:

```ts
export function PlayersSearchControls({
  q,
  size,
  sort,
  dir,
  range,
  mode,
  minimums,
  tab = "regular",
}: PlayersSearchControlsProps) {
```

In `onSearchChange`, `onRangeChange`, `onModeChange`, and `onMinimumsChange`, add `tab,` to each `buildPlayersHref({...})` call object (alongside the existing `q`/`page`/`size`/`sort`/`dir`/`range`/`mode`/`minimums` fields).

Wrap the Stats select and the minimums switch in a `tab === "regular"` guard:

```tsx
{
  tab === "regular" && (
    <label className={styles.filterLabel}>
      Stats
      <select
        value={mode}
        onChange={onModeChange}
        aria-label="Stat display"
        className={styles.select}
      >
        <option value="average">Averages</option>
        <option value="total">Totals</option>
      </select>
    </label>
  );
}
{
  tab === "regular" && (
    <span className={styles.minimums}>
      <Switch label="Qualifying minimums" checked={minimums} onChange={onMinimumsChange} />
      <InfoTip label="About qualifying minimums">
        <span className={styles.infoIntro}>
          NBA percentage leaders must clear a minimum of made shots to qualify. With this on,
          players below the cutoff drop to the bottom of the sort.
        </span>
        <dl className={styles.infoList}>
          <dt>FG%</dt>
          <dd>300 made field goals</dd>
          <dt>3P%</dt>
          <dd>82 made threes</dd>
          <dt>FT%</dt>
          <dd>125 made free throws</dd>
        </dl>
      </InfoTip>
    </span>
  );
}
```

- [ ] **Step 4: Implement `tab`-awareness in `PlayersPager`**

Modify `src/components/PlayersPager/PlayersPager.tsx`:

```ts
import {
  buildPlayersHref,
  PAGE_SIZES,
  type AdvancedSortKey,
  type PlayerGameRange,
  type PlayerSortKey,
  type PlayerStatMode,
  type PlayersTab,
  type SortDirection,
} from "@/lib/players/searchParams";
```

```ts
export type PlayersPagerProps = {
  q: string;
  page: number;
  size: number;
  totalPages: number;
  sort: PlayerSortKey | AdvancedSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
  tab?: PlayersTab;
};

export function PlayersPager({
  q,
  page,
  size,
  totalPages,
  sort,
  dir,
  range,
  mode,
  minimums,
  tab = "regular",
}: PlayersPagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goTo = ({ nextPage, nextSize }: { nextPage: number; nextSize?: number }) => {
    startTransition(() => {
      router.replace(
        buildPlayersHref({
          q,
          page: nextPage,
          size: nextSize ?? size,
          sort,
          dir,
          range,
          mode,
          minimums,
          tab,
        }),
      );
    });
  };
```

(The rest of `PlayersPager.tsx` — `onSizeChange` and the returned JSX — is unchanged.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test src/components/PlayersSearchControls src/components/PlayersPager`
Expected: PASS — existing tests plus the 4 new cases green (existing tests still pass because `tab` defaults to `"regular"`, matching prior behavior exactly).

- [ ] **Step 6: Run the full gate**

Run: `bun run lint && bunx tsc --noEmit && bun run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/PlayersSearchControls src/components/PlayersPager
git commit -m "$(cat <<'EOF'
CV: make players search controls and pager tab-aware

- Both accept an optional tab prop (default regular), threaded into hrefs
- PlayersSearchControls hides the Stats/Totals toggle and qualifying-minimums
  switch on the Advanced tab (both are meaningless for rate stats)
EOF
)"
```

---

## Task 6: Wire tabs into `/players`

**Files:**

- Modify: `src/app/players/page.tsx`
- Modify: `src/app/players/page.test.tsx`

**Interfaces:**

- Consumes: `PlayersTabs` (Task 3), `ComingSoonPanel` (Task 4), `searchPlayersAdvanced`/`AdvancedPlayerRow` (Task 2), tab-aware `PlayersSearchControls`/`PlayersPager` (Task 5).

- [ ] **Step 1: Write the failing tests**

Modify `src/app/players/page.test.tsx` — add these imports near the top (after the existing `vi.mock("@/lib/players/search", ...)` block) and a new `describe` block at the end of the file:

```tsx
vi.mock("@/lib/players/searchAdvanced", () => ({
  searchPlayersAdvanced: vi.fn(),
}));
```

```ts
import { searchPlayersAdvanced } from "@/lib/players/searchAdvanced";
```

(Place the mock call directly under the existing `vi.mock("@/lib/players/search", ...)` call, and the import directly under the existing `import { searchPlayers } from "@/lib/players/search";` line.)

Append at the end of the file, after the closing `});` of the existing `describe("PlayersPage", ...)` block:

```tsx
describe("PlayersPage tabs", () => {
  it("renders the tab navigation with Regular Stats active by default", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({ rows: [], total: 0, page: 1 });

    render(await PlayersPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Regular Stats/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the advanced stats table when tab=advanced", async () => {
    vi.mocked(searchPlayersAdvanced).mockResolvedValue({
      rows: [
        {
          id: 1,
          firstName: "Stephen",
          lastName: "Curry",
          fullName: "Stephen Curry",
          teamAbbr: "GSW",
          position: "G",
          nbaPersonId: null,
          stats: {
            pie: 15.234,
            pace: 98.6,
            assistPercentage: 0.412,
            assistRatio: 30.1,
            assistToTurnover: 2.5,
            defensiveRating: 108.2,
            defensiveReboundPercentage: 0.1,
            effectiveFieldGoalPercentage: 0.588,
            netRating: 6.4,
            offensiveRating: 114.6,
            offensiveReboundPercentage: 0.02,
            reboundPercentage: 0.06,
            trueShootingPercentage: 0.634,
            turnoverRatio: 12.3,
            usagePercentage: 0.301,
            gamesWithData: 10,
          },
        },
      ],
      total: 1,
      page: 1,
    });

    render(await PlayersPage({ searchParams: Promise.resolve({ tab: "advanced" }) }));

    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("columnheader", { name: "PIE" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "TS%" })).toBeInTheDocument();
    expect(screen.getByText("15.2")).toBeInTheDocument();
    expect(screen.getByText(".634")).toBeInTheDocument();
    expect(screen.queryByLabelText("Stat display")).not.toBeInTheDocument();
  });

  it("renders a coming-soon panel for the fantasy tab with no controls or table", async () => {
    render(await PlayersPage({ searchParams: Promise.resolve({ tab: "fantasy" }) }));

    expect(screen.getByRole("link", { name: /Fantasy Value/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search players")).not.toBeInTheDocument();
    expect(searchPlayers).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/app/players/page.test.tsx`
Expected: FAIL — no `PlayersTabs` rendered yet, `tab=advanced`/`tab=fantasy` still render the regular table.

- [ ] **Step 3: Implement the page**

Replace the full contents of `src/app/players/page.tsx` with:

```tsx
import Link from "next/link";

import { ComingSoonPanel } from "@/components/ComingSoonPanel/ComingSoonPanel";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayersPager } from "@/components/PlayersPager/PlayersPager";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { PlayersTabs } from "@/components/PlayersTabs/PlayersTabs";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { searchPlayers, type PlayerStats } from "@/lib/players/search";
import { searchPlayersAdvanced } from "@/lib/players/searchAdvanced";
import {
  buildPlayersHref,
  parsePlayersSearchParams,
  type AdvancedMetricKey,
  type AdvancedSortKey,
  type PlayerSortKey,
  type SortDirection,
} from "@/lib/players/searchParams";

import styles from "@/app/players/page.module.scss";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const formatPerGame = (total: number, gamesPlayed: number): string =>
  gamesPlayed > 0 ? (total / gamesPlayed).toFixed(1) : "—";

const formatPercentage = (made: number, attempted: number): string =>
  attempted > 0 ? (made / attempted).toFixed(3).replace(/^0/, "") : "—";

// Each numeric column pairs its sort key with how to read the value, so the
// header link and the body cell always agree on which column is highlighted.
type StatColumn = {
  label: string;
  sortKey: PlayerSortKey;
  value: (args: { stats: PlayerStats; formatCountingStat: (value: number) => string }) => string;
};

const STAT_COLUMNS: readonly StatColumn[] = [
  { label: "GP", sortKey: "gamesPlayed", value: ({ stats }) => String(stats.gamesPlayed) },
  {
    label: "PTS",
    sortKey: "pts",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.pts),
  },
  {
    label: "REB",
    sortKey: "reb",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.reb),
  },
  {
    label: "AST",
    sortKey: "ast",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.ast),
  },
  {
    label: "STL",
    sortKey: "stl",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.stl),
  },
  {
    label: "BLK",
    sortKey: "blk",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.blk),
  },
  {
    label: "FGM",
    sortKey: "fgm",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.fgm),
  },
  {
    label: "FGA",
    sortKey: "fga",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.fga),
  },
  {
    label: "3PM",
    sortKey: "fg3m",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.fg3m),
  },
  {
    label: "3PA",
    sortKey: "fg3a",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.fg3a),
  },
  { label: "FG%", sortKey: "fgPct", value: ({ stats }) => formatPercentage(stats.fgm, stats.fga) },
  {
    label: "3P%",
    sortKey: "fg3Pct",
    value: ({ stats }) => formatPercentage(stats.fg3m, stats.fg3a),
  },
  { label: "FT%", sortKey: "ftPct", value: ({ stats }) => formatPercentage(stats.ftm, stats.fta) },
  {
    label: "TOV",
    sortKey: "tov",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.tov),
  },
];

// TS%/eFG%/usage-style metrics are fractions (display like FG%); the rest are
// rating/ratio-style numbers (display to one decimal).
const PERCENTAGE_METRIC_KEYS: readonly AdvancedMetricKey[] = [
  "assistPercentage",
  "defensiveReboundPercentage",
  "effectiveFieldGoalPercentage",
  "offensiveReboundPercentage",
  "reboundPercentage",
  "trueShootingPercentage",
  "usagePercentage",
];

const formatAdvancedMetric = ({
  metricKey,
  value,
}: {
  metricKey: AdvancedMetricKey;
  value: number | null;
}): string => {
  if (value === null) return "—";
  return PERCENTAGE_METRIC_KEYS.includes(metricKey)
    ? value.toFixed(3).replace(/^0/, "")
    : value.toFixed(1);
};

type AdvancedStatColumn = {
  label: string;
  sortKey: AdvancedMetricKey;
};

const ADVANCED_STAT_COLUMNS: readonly AdvancedStatColumn[] = [
  { label: "PIE", sortKey: "pie" },
  { label: "Pace", sortKey: "pace" },
  { label: "AST%", sortKey: "assistPercentage" },
  { label: "AST Ratio", sortKey: "assistRatio" },
  { label: "AST/TO", sortKey: "assistToTurnover" },
  { label: "DRTG", sortKey: "defensiveRating" },
  { label: "DREB%", sortKey: "defensiveReboundPercentage" },
  { label: "EFG%", sortKey: "effectiveFieldGoalPercentage" },
  { label: "Net Rtg", sortKey: "netRating" },
  { label: "ORTG", sortKey: "offensiveRating" },
  { label: "OREB%", sortKey: "offensiveReboundPercentage" },
  { label: "REB%", sortKey: "reboundPercentage" },
  { label: "TS%", sortKey: "trueShootingPercentage" },
  { label: "TOV Ratio", sortKey: "turnoverRatio" },
  { label: "USG%", sortKey: "usagePercentage" },
];

const renderSummary = ({
  total,
  q,
  rangeStart,
  rangeEnd,
}: {
  total: number;
  q: string;
  rangeStart: number;
  rangeEnd: number;
}): string =>
  total === 0
    ? q === ""
      ? "No players yet — the season data hasn't been synced."
      : `No players match "${q}".`
    : `Showing ${rangeStart}–${rangeEnd} of ${total}`;

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
    sort: firstValue(raw.sort),
    dir: firstValue(raw.dir),
    range: firstValue(raw.range),
    mode: firstValue(raw.mode),
    minimums: firstValue(raw.minimums),
    tab: firstValue(raw.tab),
  });

  const tabsNav = (
    <PlayersTabs active={params.tab} q={params.q} size={params.size} range={params.range} />
  );

  if (params.tab === "fantasy") {
    return (
      <main className={styles.page}>
        <h1>Players</h1>
        {tabsNav}
        <ComingSoonPanel
          title="Fantasy Value"
          description="A blended fantasy score across scoring, efficiency, and role is on the way."
        />
      </main>
    );
  }

  const nextDir = ({ sortKey }: { sortKey: PlayerSortKey | AdvancedSortKey }): SortDirection =>
    params.sort === sortKey ? (params.dir === "desc" ? "asc" : "desc") : "desc";

  // Rank only means something when the rows are ordered by a stat.
  const isStatSort = params.sort !== "firstName" && params.sort !== "lastName";

  const renderSortableHeader = ({
    label,
    sortKey,
  }: {
    label: string;
    sortKey: PlayerSortKey | AdvancedSortKey;
  }) => {
    const isActive = params.sort === sortKey;
    return (
      <th
        key={sortKey}
        aria-sort={isActive ? (params.dir === "asc" ? "ascending" : "descending") : undefined}
        data-sort-active={isActive || undefined}
      >
        <Link
          href={buildPlayersHref({ ...params, page: 1, sort: sortKey, dir: nextDir({ sortKey }) })}
          className={styles.sortLink}
          data-active={isActive ? "true" : "false"}
        >
          {label}
          {isActive && <span aria-hidden="true">{params.dir === "asc" ? "▲" : "▼"}</span>}
        </Link>
      </th>
    );
  };

  if (params.tab === "advanced") {
    const { rows, total, page } = await searchPlayersAdvanced(params);
    const totalPages = Math.max(1, Math.ceil(total / params.size));
    const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
    const rangeEnd = Math.min(total, page * params.size);

    return (
      <main className={styles.page}>
        <h1>Players</h1>
        {tabsNav}
        <PlayersSearchControls
          q={params.q}
          size={params.size}
          sort={params.sort}
          dir={params.dir}
          range={params.range}
          mode={params.mode}
          minimums={params.minimums}
          tab={params.tab}
        />
        <p className={styles.summary}>
          {renderSummary({ total, q: params.q, rangeStart, rangeEnd })}
        </p>
        {total > 0 && (
          <>
            <PlayersPager
              q={params.q}
              page={page}
              size={params.size}
              totalPages={totalPages}
              sort={params.sort}
              dir={params.dir}
              range={params.range}
              mode={params.mode}
              minimums={params.minimums}
              tab={params.tab}
            />
            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {isStatSort && (
                      <th className={styles.numeric} title="Rank in the current sort">
                        #
                      </th>
                    )}
                    {renderSortableHeader({ label: "First name", sortKey: "firstName" })}
                    {renderSortableHeader({ label: "Last name", sortKey: "lastName" })}
                    <th>Team</th>
                    <th>Position</th>
                    {ADVANCED_STAT_COLUMNS.map((column) =>
                      renderSortableHeader({ label: column.label, sortKey: column.sortKey }),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      {isStatSort && (
                        <td className={`${styles.numeric} ${styles.rank}`}>
                          {(page - 1) * params.size + index + 1}
                        </td>
                      )}
                      <td data-sort-active={params.sort === "firstName" || undefined}>
                        <span className={styles.nameCell}>
                          <PlayerAvatar
                            fullName={row.fullName}
                            nbaPersonId={row.nbaPersonId}
                            size="sm"
                            teamAbbr={row.teamAbbr}
                          />
                          <Link href={`/players/${row.id}`}>{row.firstName}</Link>
                        </span>
                      </td>
                      <td data-sort-active={params.sort === "lastName" || undefined}>
                        <Link href={`/players/${row.id}`}>{row.lastName}</Link>
                      </td>
                      <td>
                        {row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}
                      </td>
                      <td>{row.position ?? "—"}</td>
                      {ADVANCED_STAT_COLUMNS.map((column) => (
                        <td
                          key={column.sortKey}
                          className={styles.numeric}
                          data-sort-active={params.sort === column.sortKey || undefined}
                        >
                          {formatAdvancedMetric({
                            metricKey: column.sortKey,
                            value: row.stats[column.sortKey],
                          })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PlayersPager
              q={params.q}
              page={page}
              size={params.size}
              totalPages={totalPages}
              sort={params.sort}
              dir={params.dir}
              range={params.range}
              mode={params.mode}
              minimums={params.minimums}
              tab={params.tab}
            />
          </>
        )}
      </main>
    );
  }

  const { rows, total, page } = await searchPlayers(params);
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);

  return (
    <main className={styles.page}>
      <h1>Players</h1>
      {tabsNav}
      <PlayersSearchControls
        q={params.q}
        size={params.size}
        sort={params.sort}
        dir={params.dir}
        range={params.range}
        mode={params.mode}
        minimums={params.minimums}
        tab={params.tab}
      />
      <p className={styles.summary}>
        {renderSummary({ total, q: params.q, rangeStart, rangeEnd })}
      </p>
      {total > 0 && (
        <>
          <PlayersPager
            q={params.q}
            page={page}
            size={params.size}
            totalPages={totalPages}
            sort={params.sort}
            dir={params.dir}
            range={params.range}
            mode={params.mode}
            minimums={params.minimums}
            tab={params.tab}
          />
          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {isStatSort && (
                    <th className={styles.numeric} title="Rank in the current sort">
                      #
                    </th>
                  )}
                  {renderSortableHeader({ label: "First name", sortKey: "firstName" })}
                  {renderSortableHeader({ label: "Last name", sortKey: "lastName" })}
                  <th>Team</th>
                  <th>Position</th>
                  {STAT_COLUMNS.map((column) =>
                    renderSortableHeader({ label: column.label, sortKey: column.sortKey }),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const stats = row.stats ?? row.seasonStats?.[0];
                  const formatCountingStat = (value: number) =>
                    params.mode === "total"
                      ? String(value)
                      : formatPerGame(value, stats?.gamesPlayed ?? 0);
                  return (
                    <tr key={row.id}>
                      {isStatSort && (
                        <td className={`${styles.numeric} ${styles.rank}`}>
                          {(page - 1) * params.size + index + 1}
                        </td>
                      )}
                      <td data-sort-active={params.sort === "firstName" || undefined}>
                        <span className={styles.nameCell}>
                          <PlayerAvatar
                            fullName={row.fullName}
                            nbaPersonId={row.nbaPersonId}
                            size="sm"
                            teamAbbr={row.teamAbbr}
                          />
                          <Link href={`/players/${row.id}`}>{row.firstName}</Link>
                        </span>
                      </td>
                      <td data-sort-active={params.sort === "lastName" || undefined}>
                        <Link href={`/players/${row.id}`}>{row.lastName}</Link>
                      </td>
                      <td>
                        {row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}
                      </td>
                      <td>{row.position ?? "—"}</td>
                      {STAT_COLUMNS.map((column) => (
                        <td
                          key={column.sortKey}
                          className={styles.numeric}
                          data-sort-active={params.sort === column.sortKey || undefined}
                        >
                          {stats ? column.value({ stats, formatCountingStat }) : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PlayersPager
            q={params.q}
            page={page}
            size={params.size}
            totalPages={totalPages}
            sort={params.sort}
            dir={params.dir}
            range={params.range}
            mode={params.mode}
            minimums={params.minimums}
            tab={params.tab}
          />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/app/players/page.test.tsx`
Expected: PASS — all existing cases plus the 3 new tab cases green.

- [ ] **Step 5: Run the full gate**

Run: `bun run lint && bunx tsc --noEmit && bun run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/players/page.tsx src/app/players/page.test.tsx
git commit -m "$(cat <<'EOF'
CV: wire Regular/Advanced/Fantasy tabs into /players

- Advanced tab renders all 15 BDL metrics via searchPlayersAdvanced
- Fantasy tab renders ComingSoonPanel only, no controls or data fetch
- Shared renderSummary/renderSortableHeader helpers reused across tabs
EOF
)"
```

---

## Task 7: Homepage placeholders

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.scss`
- Modify: `src/app/page.test.tsx`

**Interfaces:**

- Consumes: `getProfile()` from `@/lib/auth/session` (existing), `ComingSoonPanel` (Task 4).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/app/page.test.tsx` with:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));

import Home from "@/app/page";

afterEach(cleanup);

beforeEach(() => getProfile.mockReset());

describe("Home", () => {
  it("shows sign-in prompts for Your Team and Watched Players when signed out", async () => {
    getProfile.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("heading", { name: "Your Team" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Watched Players" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign in" })).toHaveLength(2);
  });

  it("shows coming-soon empty states for Your Team and Watched Players when signed in", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    render(await Home());

    expect(screen.getByText("You haven't built a fantasy team yet.")).toBeInTheDocument();
    expect(screen.getByText("You aren't watching any players yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("always shows the stat trends placeholder regardless of auth state", async () => {
    getProfile.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("heading", { name: "Stat Trends to Watch" })).toBeInTheDocument();
    expect(screen.getByText(/Short on rebounds/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/app/page.test.tsx`
Expected: FAIL — current `Home` renders "Coming soon"/"Court Vision is under construction." only, is not async, and doesn't call `getProfile`.

- [ ] **Step 3: Implement the homepage**

Replace the full contents of `src/app/page.tsx` with:

```tsx
import Link from "next/link";

import { ComingSoonPanel } from "@/components/ComingSoonPanel/ComingSoonPanel";
import { getProfile } from "@/lib/auth/session";

import styles from "@/app/page.module.scss";

export default async function Home() {
  const profile = await getProfile();
  const isSignedIn = !!profile;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Court Vision</h1>
      <p className={styles.subtitle}>Your fantasy command center — here's what's coming.</p>
      <div className={styles.grid}>
        {isSignedIn ? (
          <ComingSoonPanel title="Your Team" description="You haven't built a fantasy team yet." />
        ) : (
          <section className={styles.signInCard} aria-labelledby="home-team-title">
            <h2 id="home-team-title" className={styles.cardTitle}>
              Your Team
            </h2>
            <p className={styles.cardBody}>
              <Link href="/login">Sign in</Link> to start building your team.
            </p>
          </section>
        )}
        {isSignedIn ? (
          <ComingSoonPanel
            title="Watched Players"
            description="You aren't watching any players yet."
          />
        ) : (
          <section className={styles.signInCard} aria-labelledby="home-watchlist-title">
            <h2 id="home-watchlist-title" className={styles.cardTitle}>
              Watched Players
            </h2>
            <p className={styles.cardBody}>
              <Link href="/login">Sign in</Link> to watch players.
            </p>
          </section>
        )}
        <ComingSoonPanel
          title="Stat Trends to Watch"
          description="Short on rebounds? We'll surface players trending up in the stats your team needs."
        />
      </div>
    </main>
  );
}
```

Replace the full contents of `src/app/page.module.scss` with:

```scss
.page {
  display: grid;
  gap: var(--space-6);
  padding: var(--space-8);
}

.title {
  margin: 0;
  font-size: var(--font-size-xl);
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-4);
}

.signInCard {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.cardTitle {
  margin: 0;
  font-size: var(--font-size-lg);
}

.cardBody {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/app/page.test.tsx`
Expected: PASS — all 3 cases green.

- [ ] **Step 5: Run the full gate**

Run: `bun run lint && bunx tsc --noEmit && bun run test`
Expected: PASS — full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/page.module.scss src/app/page.test.tsx
git commit -m "$(cat <<'EOF'
CV: replace blank homepage with three placeholder cards

- Your Team / Watched Players: sign-in CTA when signed out, coming-soon
  empty state when signed in (via existing getProfile())
- Stat Trends to Watch: always-on explainer for the future stat-need finder
EOF
)"
```

---

## Post-plan verification

After Task 7, run the full gate once more from the repo root to confirm nothing regressed across tasks:

```bash
bun run lint
bunx tsc --noEmit
bun run test
```

Then manually smoke-test in the browser (`bun dev`):

- `/players` — Regular tab unchanged; Advanced tab loads, sorts by each column, range selector works, Stats/minimums controls are absent; Fantasy tab shows the coming-soon panel with no controls.
- `/` — signed out shows two sign-in CTAs + one stat-trends panel; signed in (existing test account) shows three coming-soon panels.
