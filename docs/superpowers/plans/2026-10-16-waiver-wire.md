# Waiver Wire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/waiver-wire` page for the active imported league that compares the league's free agents with the user's weakest players, in three tabs (Swap board, Head-to-head, Cut line), and keeps the league fresh by syncing when it is stale.

**Architecture:** The server page loads the Fantasy tab's cached pool for the chosen range plus the league's rosters, waivers and injury statuses, and hands them to one client view. The client values the pool once with the existing `useValuation` (league config built by `buildLeagueSeed` + `configFromSeed`, exactly what the Fantasy tab does on first load), then pure functions in `apps/court-vision/src/lib/waiverWire/` slice it into your roster, your weakest three and the free pool, and build each tab's rows. Components stay thin. One sport-agnostic helper, `teamCategoryTotals`, joins `@vision/core` for the head-to-head team deltas.

**Tech Stack:** Next.js App Router (read `node_modules/next/dist/docs/` before Next code), React 19, nuqs (`createLoader` on the server, `useQueryStates` on the client), Prisma 7.10, bun:test with the `vi` shim.

**Spec:** `docs/superpowers/specs/2026-10-16-yahoo-league-import-design.md` ("The Waiver Wire page", the automatic-sync bullet under "Sync", and the Waiver Wire lines of "Testing"). Mockup: `docs/superpowers/specs/2026-10-16-yahoo-league-import-mockup.html`. Depends on plan 1, `docs/superpowers/plans/2026-10-16-yahoo-import.md`, being complete.

## Global Constraints

- Everything in plan 1's Global Constraints applies (house rules, test conventions, copy exactness, commit and push gating, `keycap` mixins, `table-wrapper` + `data-table` + `numeric-cell`, `panel-shell` + `panel-title`, no glows).
- One file: `bun run --cwd apps/court-vision test <path>`; core: `bun run --cwd libs/vision-core test <path>`.
- Ranges are `PlayerGameRange` (`all`, `last5`, `last10`, `last20`, `last40`, `last60`) with `GAME_RANGE_LABELS`, from `@/lib/players/searchParams`. The mockup's day windows are placeholders.
- The pool is `getFantasyPool({ range })` unchanged; the page never blends seasons.
- The score shown is the method from `Profile.preferredFormula` (guarded with `FANTASY_METHODS`), defaulting to `"zscore"`; its field on `FantasyPlayerValues` is `VALUE_KEY_BY_SORT[SORT_KEY_BY_METHOD[method]]`. Category chips and head-to-head winners use the breakdown's `g` when the method is `"gscore"`, else `z`.
- Players in `IL` or `ILPLUS` slots are never "your roster", never "your weakest", never on the cut line.
- A rostered player with no line in the range is never treated as low value.
- Injury status and the waiver tag are text badges (`Q`, `O`, `P`, `INJ`, `W`), never color alone.
- `/waiver-wire` gets no `perf-budget.json` row: the runner only measures 200s with no session, and every signed-in route (`/leagues`, `/my-teams`, `/watchlist`) is absent for the same reason. This departs from the spec's "gets a perf-budget.json entry"; say so in the PR.

## Review Focus

1. **A roster with fewer than three valued players** (opening week, a roster of stashes) must still render: "your weakest" lists what exists, and with none the page says "No one on your roster has stats in this range. Try a longer range." Pinned in Task 2.
2. **`fa` / `mine` in the URL naming someone who is no longer a free agent or no longer yours** (after a sync, or from an old shared link) must fall back to the defaults, not crash or compare the wrong people. Pinned in Task 4.
3. **A player with zero FGA or FTA in the window** must give a percentage of 0 and team totals without `NaN`. Pinned in Tasks 1 and 4.
4. **A free agent valued exactly at your weakest player** is not an upgrade (strictly greater), and a head-to-head category tie counts for neither player. Pinned in Tasks 3 and 4.
5. **A position filter or range that leaves no free agents** must show a sentence, not an empty table. Pinned in Task 10.

---

### Task 1: `teamCategoryTotals` in core

**Files:**

- Create: `libs/vision-core/src/valuation/teamTotals.ts`, `libs/vision-core/src/valuation/teamTotals.test.ts`
- Modify: `libs/vision-core/src/engine.ts` (bind it), `libs/sport-basketball/src/engine.ts` (export it)

**Interfaces:**

- Produces:

  ```ts
  export type TeamCategoryTotal<K extends SportKeys> = {
    key: Category<K>;
    direction: Direction; // from #core/sport/types
    value: number; // counting: Σ per-game; ratio: scale · Σ num/gp ÷ Σ den/gp
  };
  export const teamCategoryTotals: <K extends SportKeys>(args: {
    sport: SportDescriptor<K>;
    lines: readonly ValuationLine<K>[];
  }) => TeamCategoryTotal<K>[]; // in sport.categoryOrder
  ```

  Bound as `teamCategoryTotals({ lines })` from `@vision/sport-basketball/engine`.

- [ ] **Step 1: Write the failing tests** with `makeLine` and `basketballFixture` from `#core/testing/*`:
  - `it("sums per-game counting stats across the roster")`: two lines, 10 pts over 2 games and 30 pts over 3 games → `pts` 15.
  - `it("recomputes ratio categories from summed makes and attempts")`: 5/10 FG over 1 game and 2/10 over 2 games → `fg` = (5 + 1) / (10 + 5) = 0.4.
  - `it("reports zero, not NaN, with no attempts")` (Review Focus 3): every line has `fga: 0` → `fg` 0; an empty roster → every value 0.
  - `it("skips lines with no games")`.
  - `it("carries each category's direction")`: `tov` is `"lower"`.
- [ ] **Step 2: Run** `bun run --cwd libs/vision-core test src/valuation/teamTotals.test.ts` → FAIL.
- [ ] **Step 3: Implement** with `categoryDef` from `#core/valuation/categories`; bind it in `engine.ts` like `buildCategoryBreakdown`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: add \`teamCategoryTotals\` to the valuation engine`.

---

### Task 2: The waiver model

**Files:**

- Create: `apps/court-vision/src/lib/waiverWire/types.ts`, `model.ts`, `model.test.ts`

**Interfaces:**

- Consumes: `FantasyStatLine` (`@/lib/valuation/types`), `FantasyPlayerValues`, `MethodValueKey` (`@vision/core/valuation/types`), `parseEligibleGroups` (`@vision/sport-basketball/engine`), `RosterSlotType`.
- Produces (`types.ts`):
  ```ts
  export type WaiverPosition = "all" | "G" | "F" | "C";
  export type WaiverRosterEntry = {
    playerId: number;
    fullName: string;
    slotType: RosterSlotType;
    injuryStatus: string | null;
  };
  export type WaiverLeagueData = {
    myRoster: WaiverRosterEntry[]; // my team's matched players
    rosteredPlayerIds: number[]; // matched players on every team in the league
    waivers: { playerId: number; injuryStatus: string | null }[];
  };
  export type WaiverOwner = "mine" | "free_agent" | "waivers";
  export type WaiverRow = {
    playerId: number;
    fullName: string;
    teamAbbr: string | null;
    position: string | null;
    nbaPersonId: number | null;
    value: number;
    rank: number; // rank across the whole valued pool, 1-based
    owner: WaiverOwner;
    injuryStatus: string | null;
  };
  export type WaiverModel = {
    roster: WaiverRow[]; // mine, valued, not IL/IL+, value desc
    noStats: WaiverRosterEntry[]; // mine, not IL/IL+, no line in the range
    weakest: WaiverRow[]; // up to three, lowest first
    freePool: WaiverRow[]; // value desc, after the position filter
  };
  ```
- Produces (`model.ts`):

  ```ts
  export const buildWaiverModel: (args: {
    lines: readonly FantasyStatLine[];
    values: readonly FantasyPlayerValues[];
    valueKey: MethodValueKey;
    league: WaiverLeagueData;
    activePlayerIds: ReadonlySet<number>; // Player.isActive
    pos: WaiverPosition;
  }) => WaiverModel;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `it("splits the valued pool into my roster and the free pool")`: rostered-elsewhere players appear in neither; a free agent who is not `isActive` is left out.
  - `it("leaves IL players out of my roster")`: an `IL` and an `ILPLUS` entry with lines are absent from `roster` and `weakest`.
  - `it("lists my players with no line under noStats, never as weakest")`.
  - `it("picks the three lowest-valued players, lowest first")`.
  - `it("copes with fewer than three valued players")` (Review Focus 1): one valued player → `weakest` has one; none → `weakest` and `roster` empty, `noStats` filled.
  - `it("tags waiver players and carries injury status")`: a waiver id gets `owner: "waivers"` and its status; a roster entry's status reaches its row.
  - `it("ranks against the whole valued pool")`: other teams' players count toward `rank`.
  - `it("filters free agents by position group")`: `pos: "C"` keeps `"F-C"` and `"C"`, drops `"G"`; `roster` is never filtered.
  - `it("ranks by the chosen method")`: `valueKey: "g"` orders by `g`.
- [ ] **Step 2: Run** `… test src/lib/waiverWire/model.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Join `values` to `lines` by `playerId`; rank by `valueKey` descending (ties by `playerId` for stability).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: slice the valued pool for the Waiver Wire`.

---

### Task 3: Swap board rows

**Files:**

- Create: `apps/court-vision/src/lib/waiverWire/swapBoard.ts`, `swapBoard.test.ts`

**Interfaces:**

- Consumes: `WaiverModel`, `WaiverRow` (Task 2); `FantasyCategoryBreakdown` (`@vision/core/valuation/breakdown`) bound to basketball.
- Produces:

  ```ts
  export type ScoreKey = "z" | "g";
  export type CategoryChip = { key: Category; text: string; improves: boolean }; // text "+REB" / "−FG%"
  export type SwapRow = WaiverRow & { gain: number; chips: CategoryChip[] };
  export type SwapBoard = { target: WaiverRow | null; rows: SwapRow[] }; // target = weakest[0]
  export const buildSwapBoard: (args: {
    model: WaiverModel;
    breakdownFor: ({
      playerId,
    }: {
      playerId: number;
    }) => FantasyCategoryBreakdown<BasketballKeys>[];
    scoreKey: ScoreKey;
  }) => SwapBoard;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `it("lists only free agents who beat your weakest player, by gain")`.
  - `it("does not count an equal value as an upgrade")` (Review Focus 4).
  - `it("chips the three biggest category differences")`: differences `{ reb: +1.2, fg: −0.9, pts: +0.5, ast: +0.1 }` → `["+REB", "−FG%", "+PTS"]`, labels from the breakdown, `−` is U+2212.
  - `it("scores chips by g for the G-Score method")`.
  - `it("has no target and no rows without a weakest player")`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Gain = free agent value − `target.value`. A chip's difference is the free agent's `scoreKey` minus the target's for that category; `improves` is `difference > 0` (the breakdown is already sign-corrected, so TO needs no special case).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: build the Waiver Wire swap board`.

---

### Task 4: Head-to-head rows

**Files:**

- Create: `apps/court-vision/src/lib/waiverWire/headToHead.ts`, `headToHead.test.ts`

**Interfaces:**

- Consumes: `WaiverModel` (Task 2), `ScoreKey` (Task 3), `teamCategoryTotals` (Task 1), `FantasyStatLine`.
- Produces:

  ```ts
  export type HeadToHeadPair = { fa: WaiverRow; mine: WaiverRow };
  export const resolvePair: (args: {
    model: WaiverModel;
    swapTop: WaiverRow | null;
    fa: number | null;
    mine: number | null;
  }) => HeadToHeadPair | null;
  // fa ∈ model.freePool else swapTop else freePool[0]; mine ∈ model.roster else weakest[0]; null if either is missing
  export type HeadToHeadRow = {
    key: Category;
    label: string;
    kind: CategoryKind;
    faPerGame: number;
    minePerGame: number;
    winner: "fa" | "mine" | "tie";
    teamDelta: number; // your team's per-game total after the swap minus before
    teamDeltaImproves: boolean | null; // null when teamDelta is 0
  };
  export type HeadToHead = { rows: HeadToHeadRow[]; faWins: number; categoryCount: number };
  export const buildHeadToHead: (args: {
    pair: HeadToHeadPair;
    linesById: ReadonlyMap<number, FantasyStatLine>;
    rosterIds: readonly number[]; // model.roster ids
    breakdownFor: ({
      playerId,
    }: {
      playerId: number;
    }) => FantasyCategoryBreakdown<BasketballKeys>[];
    scoreKey: ScoreKey;
  }) => HeadToHead;
  export const headToHeadSummary: ({
    pair,
    result,
  }: {
    pair: HeadToHeadPair;
    result: HeadToHead;
  }) => string;
  // "Wendell Carter Jr. wins 5 of 9": the free agent's full name
  ```

- [ ] **Step 1: Write the failing tests:**
  - `it("falls back when the URL names someone no longer available")` (Review Focus 2): `fa` = a rostered player's id → the swap top; `mine` = a free agent's id → `weakest[0]`; both missing → defaults; empty roster → `null`.
  - `it("picks each category's winner by score, with ties for neither")` (Review Focus 4).
  - `it("reports per-game numbers, percentages as rates")`: `fg` 0.532 vs 0.560.
  - `it("computes the team change from the swap")`: roster of two lines; swapping in a 10-rebound free agent for a 4-rebound player → `reb` delta +6, `teamDeltaImproves: true`; more turnovers → `tov` delta positive with `teamDeltaImproves: false`.
  - `it("keeps team percentages finite with no attempts")` (Review Focus 3).
  - `it("summarizes wins")`: `"Wendell Carter Jr. wins 5 of 9"`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Before = `teamCategoryTotals` over the roster's lines; after = the same with `mine` replaced by `fa`; `teamDeltaImproves` reads the total's `direction`. Rows follow the league's categories in the breakdown's order.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: build the Waiver Wire head-to-head`.

---

### Task 5: Cut line rows

**Files:**

- Create: `apps/court-vision/src/lib/waiverWire/cutLine.ts`, `cutLine.test.ts`

**Interfaces:**

- Consumes: `WaiverModel` (Task 2).
- Produces:

  ```ts
  export type CutScope = "all" | "fa";
  export type CutLineEntry =
    | { kind: "row"; row: WaiverRow; isUpgrade: boolean } // a free agent above the line
    | { kind: "line" }; // drawn under your lowest-valued player
  export type CutLine = { entries: CutLineEntry[]; hiddenAbove: number; hiddenBelow: number };
  export const buildCutLine: (args: {
    model: WaiverModel;
    scope: CutScope;
    showAll: boolean;
  }) => CutLine;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `it("merges your roster and the free pool by value with the line under your worst")`.
  - `it("marks free agents above the line as upgrades")`.
  - `it("shows free agents only, keeping the line in place")`: `scope: "fa"` drops your rows, and the line still sits where your worst player's value falls.
  - `it("windows the list around the line")`: starts 3 rows above the best upgrade and ends 5 rows below the line, with the hidden counts reported; `showAll` returns everything and zero hidden.
  - `it("has no line without a valued roster")`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: build the Waiver Wire cut line`.

---

### Task 6: URL state and the server loader

**Files:**

- Create: `apps/court-vision/src/lib/waiverWire/searchParams.ts`, `searchParams.test.ts`
- Create: `apps/court-vision/src/lib/waiverWire/loader.ts`, `loader.test.ts`

**Interfaces:**

- Consumes: `listParsers` (`@/lib/players/searchParams`), `WaiverLeagueData` (Task 2), `CutScope` (Task 5); `LeagueTeamSlot.injuryStatus` and `LeagueWaiverPlayer.injuryStatus` (added by plan 1 Task 7, written on create and sync by plan 1 Task 9's persist).
- Produces (`searchParams.ts`, imports from `nuqs/server`):
  ```ts
  export const WAIVER_VIEWS = ["swap", "h2h", "cut"] as const;
  export type WaiverView = (typeof WAIVER_VIEWS)[number];
  export const WAIVER_POSITIONS = ["all", "G", "F", "C"] as const;
  export const CUT_SCOPES = ["all", "fa"] as const;
  export const waiverWireParsers = {
    view: parseAsStringLiteral(WAIVER_VIEWS).withDefault("swap"),
    range: listParsers.range.withOptions({ shallow: false }), // new range = new server pool
    pos: parseAsStringLiteral(WAIVER_POSITIONS).withDefault("all"),
    scope: parseAsStringLiteral(CUT_SCOPES).withDefault("all"),
    fa: parseAsInteger,
    mine: parseAsInteger,
  };
  export const loadWaiverWireSearchParams = createLoader(waiverWireParsers);
  ```
- Produces (`loader.ts`): `getWaiverLeagueData({ leagueId, myTeamId }: { leagueId: string; myTeamId: string }): Promise<WaiverLeagueData>`. Uncached, like `getRosteredPlayerIds`: per user, a few hundred rows, must reflect a sync at once.

- [ ] **Step 1: Write the failing tests:**
  - `searchParams.test.ts`: `it("defaults to the swap board over the season")`; `it("drops unknown views and positions")`; `it("reads player ids as integers")` (`fa=abc` → `null`).
  - `loader.test.ts` (mock `@/lib/prisma`): `it("reads my roster, every rostered id and the waivers")`: one `leagueTeamSlot.findMany` scoped by `team: { leagueId }` with `playerId: { not: null }` selecting `playerId`, `slotType`, `injuryStatus`, `teamId`, `player.fullName`; one `leagueWaiverPlayer.findMany` by `leagueId`. `myRoster` holds only `teamId === myTeamId` rows.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: add Waiver Wire URL state and league loader`.

---

### Task 7: The route, its gates and the nav entry

**Files:**

- Create: `apps/court-vision/src/app/waiver-wire/page.tsx`, `page.test.tsx`, `loading.tsx`, `waiverWire.module.scss`
- Create: `apps/court-vision/src/components/MyTeamPicker/MyTeamPicker.tsx`, `.module.scss`, `.test.tsx`
- Modify: `apps/court-vision/src/components/SideNav/SideNav.tsx` (+ test): entry `{ href: "/waiver-wire", label: "Waiver Wire", icon: "waiverWire" }` in "My league" after "My Teams", with a 48-grid stroke icon (two opposed arrows, a swap) in `NAV_ICON_PATHS`
- Modify: `apps/court-vision/src/components/YahooImportForm/YahooImportForm.tsx` (+ test): after import go to `/waiver-wire`; the unmatched-players link reads "Go to the Waiver Wire"

**Interfaces:**

- Consumes: `getProfile`, `getActiveLeague`, `getLeagueTeams` (plan 1 Task 10, for the picker), `setMyTeam` (plan 1 Task 11), `loadWaiverWireSearchParams`, `getWaiverLeagueData`, `getFantasyPool`, `getActiveRosterPlayers`, `buildLeagueSeed`, `configFromSeed`, `FANTASY_METHODS`, `SyncYahooButton`, `formatLeagueMeta`.
- Produces: `WAIVER_WIRE_PAGE_HEADER` (title "Waiver Wire", description "How your league's free agents stack up against your team.") shared by `page.tsx` and `loading.tsx`, like `app/players/header.ts`; `<MyTeamPicker leagueId={string} teams={FantasyTeam[]} />`; the props `WaiverWireView` takes (Task 9).

Gate copy (exact), each below the `PageHeader`:

| State                         | Message                                                                                    | Action                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Signed out                    | `redirect("/login?next=/waiver-wire")`                                                     |                                              |
| No active league              | No league yet. Import your Yahoo league to see who on the wire beats your weakest players. | link "Import from Yahoo" → `/leagues/import` |
| Active league is `manual`     | The Waiver Wire needs a league imported from Yahoo, so it knows every team's roster.       | link "Import from Yahoo"                     |
| Imported, `myTeamId` null     | Which team is yours?                                                                       | `MyTeamPicker`                               |
| `scoringType` is `h2h_points` | The Waiver Wire doesn't support points leagues yet.                                        |                                              |

- [ ] **Step 1: Write the failing tests:**
  - `page.test.tsx` (mock the loaders): one test per gate row; the ready state renders `WaiverWireView` with `range` from the URL, the eyebrow `"<league name> · Yahoo"`, the actions `SyncYahooButton` and "Open in Yahoo" (`externalUrl`, new tab), "Not valued: DD" when `unsupportedCategories` has entries, and "League data from Yahoo Fantasy". It passes `method: "gscore"` when `preferredFormula` is `"gscore"` and `"zscore"` when it is null or unknown.
  - `MyTeamPicker.test.tsx`: a labelled select ("Your team") listing the league's teams and a keycap "Save"; saving calls `setMyTeam({ leagueId, teamId })` and `router.refresh()`; a failure is announced in `role="alert"`.
  - `SideNav.test.tsx`: the entry is present and marked current on `/waiver-wire`.
  - `YahooImportForm.test.tsx`: the two changed expectations.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** The page is `force-dynamic`. In the ready state it loads `getFantasyPool({ range })`, `getWaiverLeagueData`, `getActiveRosterPlayers()` and the profile in one `Promise.all`; the config is `configFromSeed({ seed: buildLeagueSeed({ league, preferredFormula: null, presentKeys: new Set() }) })` so it matches the Fantasy tab's first load for this league. `loading.tsx` renders the shared header and `Preloader` (copy `app/players/loading.tsx`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: add the Waiver Wire route and nav entry`.

---

### Task 8: Sync when stale

**Files:**

- Modify: `apps/court-vision/src/components/SyncYahooButton/SyncYahooButton.tsx`, `SyncYahooButton.test.tsx`

**Interfaces:**

- Consumes: `syncYahooLeague`, `YAHOO_STALE_AFTER_MS` (900 000 ms), `formatSyncedAgo`.
- Produces: `SyncYahooButton` gains `autoSyncWhenStale?: boolean` (default false). The Waiver Wire passes `true`; the Leagues card does not.

- [ ] **Step 1: Write the failing tests** (`setSystemTime` from `bun:test`):
  - `it("syncs once on mount when the last sync is older than 15 minutes")`: `syncedAt` 16 minutes ago → one call, "Syncing…" in the live region, then `router.refresh()`.
  - `it("syncs on mount when the league has never synced")`.
  - `it("does not auto-sync a fresh league")`: 14 minutes ago → no call.
  - `it("does not auto-sync without the flag")`.
  - `it("keeps the stored data and shows the error when the auto-sync fails")`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with one effect that runs once per mount (a ref guards React's dev double-invoke) and goes through the same handler as a click.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: sync a stale league when the Waiver Wire opens`.

---

### Task 9: `WaiverWireView`: valuation, shared controls and tabs

**Files:**

- Create: `apps/court-vision/src/components/WaiverWireView/WaiverWireView.tsx`, `WaiverWireView.module.scss`, `WaiverWireView.test.tsx`, `WaiverWireTabs.tsx`, `WaiverWireTabs.test.tsx`

**Interfaces:**

- Consumes: `useValuation` (`@/components/FantasyValueView/useValuation`), `buildCategoryBreakdown` (`@vision/sport-basketball/engine`), `waiverWireParsers`, `buildWaiverModel`, `buildSwapBoard`, `resolvePair`, `buildHeadToHead`, `buildCutLine`, `GAME_RANGE_LABELS`, `gamesForRange`.
- Produces:

  ```ts
  export type WaiverWireViewProps = {
    lines: FantasyStatLine[];
    league: WaiverLeagueData;
    activePlayerIds: number[];
    config: ValuationConfig;
    methodWeights: MethodWeights;
    method: FantasyMethodKey;
  };
  export function WaiverWireView(props: WaiverWireViewProps): ReactNode;
  export function WaiverWireTabs({
    view,
    onChange,
    panels,
  }: {
    view: WaiverView;
    onChange: ({ view }: { view: WaiverView }) => void;
    panels: Record<WaiverView, ReactNode>;
  }): ReactNode;
  ```

  Panel components (Tasks 10, 11) receive already-built rows plus an `onCompare({ fa }: { fa: number })` callback that sets `view: "h2h"`, `fa`, and clears `mine`.

- [ ] **Step 1: Write the failing tests:**
  - `WaiverWireTabs.test.tsx`: `it("follows the WAI-ARIA tabs pattern")`: a `tablist` labelled "Compare players" holding three `tab` buttons ("Swap board", "Head-to-head", "Cut line"); the selected one has `aria-selected="true"` and `tabIndex 0`, the others `-1`; each `tabpanel` is `aria-labelledby` its tab; only the selected panel renders. `it("moves with the arrow keys, Home and End")`: ArrowRight from the last tab wraps to the first and selects it.
  - `WaiverWireView.test.tsx` (small fixture pool): `it("values the pool once and opens on the swap board")`; `it("changes range through the URL")` (a select labelled "Range" with `GAME_RANGE_LABELS`); `it("filters free agents by position")` (keycap buttons All, G, F, C with `aria-pressed`); `it("opens head-to-head from a free agent")`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `useQueryStates(waiverWireParsers)`; view and filter changes use `history: "replace"`. `breakdownFor` is memoized over the settled `valuation.lines`, `poolStats`, `config` and `methodWeights`, as `FantasyValueView` does for chart rows. The value key is `VALUE_KEY_BY_SORT[SORT_KEY_BY_METHOD[method]]`; the score key is `"g"` for `"gscore"`, else `"z"`. Tabs are keycap buttons (`keycap`, selected `keycap-engaged`) with a visible `:focus-visible` outline.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: add the Waiver Wire view and tabs`.

---

### Task 10: Swap board and Cut line panels

**Files:**

- Create: `apps/court-vision/src/components/WaiverWireView/SwapBoardPanel.tsx`, `SwapBoardPanel.test.tsx`, `CutLinePanel.tsx`, `CutLinePanel.test.tsx`, `WaiverBadges.tsx` (injury and `W` badges), `WaiverBadges.test.tsx`

**Interfaces:**

- Consumes: `SwapBoard`, `CutLine`, `WaiverModel`, `onCompare`.
- Produces: `<SwapBoardPanel board={SwapBoard} model={WaiverModel} onCompare={…} />`, `<CutLinePanel cutLine={CutLine} scope={CutScope} onScope={…} onShowAll={…} onCompare={…} />`, `<WaiverBadges injuryStatus={string | null} owner={WaiverOwner} />`.

Copy (exact): left panel title "Your weakest"; right panel title "Free agents that beat them", count "sorted by gain over <weakest full name>"; toggle "My team + free agents" / "Free agents only"; line label "Cut line · your worst player"; owner cells "You", "Free agent", "Waivers"; "No stats in this range" (a `Disclosure` listing those players); "Show all"; empty messages "No free agent beats your weakest player in this range." and "No one on your roster has stats in this range. Try a longer range."

- [ ] **Step 1: Write the failing tests:**
  - `SwapBoardPanel.test.tsx`: two `panel-shell` sections with the titles above; rows show value, gain (`+1.36`) and chips; a free agent's name is a button calling `onCompare({ fa })`; the swap list shows 25 rows and a "Show all" button when longer; the noStats disclosure; `it("says so when no free agent qualifies")` (Review Focus 5).
  - `CutLinePanel.test.tsx`: rank column, the line rendered as a labelled row (`role="row"` with the label in a cell spanning the table), upgrades marked with visible text ("Upgrade") as well as tint, the toggle as two keycap buttons with `aria-pressed`, hidden counts on "Show all"; `it("says so when the filter leaves no free agents")` (Review Focus 5).
  - `WaiverBadges.test.tsx`: `Q` renders text "Q" with an accessible name "Questionable"; `W` reads "On waivers"; nothing for a healthy free agent.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `table-wrapper` + `data-table` + `numeric-cell`, cell padding `var(--row-y) var(--row-x)`. Your rows carry the accent bar on the leading edge (a border, not a glow).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: add the swap board and cut line panels`.

---

### Task 11: Head-to-head panel

**Files:**

- Create: `apps/court-vision/src/components/WaiverWireView/HeadToHeadPanel.tsx`, `HeadToHeadPanel.module.scss`, `HeadToHeadPanel.test.tsx`

**Interfaces:**

- Consumes: `HeadToHeadPair`, `HeadToHead`, `headToHeadSummary` (Task 4), `ReadoutCard`/`ReadoutRow` (`@vision/ui/components/ReadoutCard/ReadoutCard`).
- Produces: `<HeadToHeadPanel pair={HeadToHeadPair | null} result={HeadToHead | null} freePool={WaiverRow[]} roster={WaiverRow[]} onPick={({ fa, mine }) => void} />`.

- [ ] **Step 1: Write the failing tests:**
  - `it("compares the picked players category by category")`: selects labelled "Free agent" and "Your player"; two readout cards (labels "Free agent" and "Your team", the value as the extruded figure); a table with the free agent's number, a two-sided bar (`aria-hidden="true"`), your player's number, the category label and "Your team after swap"; the winner's cell carries "✓" plus visually hidden "wins"; deltas are signed (`+3.3`, `−.002`) with "better"/"worse" as text, not color alone; the footer reads `headToHeadSummary`.
  - `it("formats percentages as rates and counts to one decimal")`: `.532`, `11.8`.
  - `it("says what is missing when there is no pair")`: "Pick a free agent and one of your players to compare."
  - `it("updates the URL when a select changes")`: `onPick` with the new id.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Large readout numbers take `retro-extrude` (through `ReadoutCard`); nothing else does.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: add the head-to-head panel`.

---

### Task 12: Verification

- [ ] **Step 1: Full checks** from the repo root: `bun run typecheck`, `bun run test`, `bun run lint`, `bun run security:scan`, `bun run build`. All pass.
- [ ] **Step 2: Accessibility pass.** Dispatch the `cv-a11y` agent on `/waiver-wire` (heading order, the tabs pattern, focus, live regions). Fix what it finds.
- [ ] **Step 3: Manual check** with the imported Game of Courts league active: `bun run dev` → `/waiver-wire` opens on the swap board with three weakest players → change range to "Last 10" (server refetch) → filter `C` → click a free agent (head-to-head opens with them against your weakest) → Cut line → "Free agents only" → reload (every choice survives in the URL) → wait or set `syncedAt` older than 15 minutes and reload (it syncs on its own). Then switch the active league to a manual one and to none, and check each gate message.
- [ ] **Step 4: Timing.** With `bun run build && bun run start --port 46644`, load `/waiver-wire` signed in five times; TTFB should sit inside the 1200 ms data budget the other pool-backed routes use. Report the numbers in the PR (no `perf-budget.json` row; see Global Constraints).
- [ ] **Step 5: Commit** any fixes from Steps 2–4 (`CV: polish the Waiver Wire`).
