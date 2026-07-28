# Historical Season Backfill (2016-17) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Balldontlie backfill window from 2020-21 back to 2016-17, storing game logs, advanced logs and aggregated season stats for the four new seasons.

**Architecture:** Three source edits — null-tolerant stat parsing in the Zod schema, `?? 0` coalescing in the transform, and moving the `BACKFILL_START_YEAR` constant — followed by a two-step data run (`sync:bdl 2016 2017 2018 2019`, then `sync:players`). No schema migration; `SEASON_OPTIONS` widens automatically off the moved constant.

**Tech Stack:** Bun, TypeScript, Zod 4, Prisma 7 → Supabase Postgres, bun:test.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-historical-season-backfill-design.md`.
- Run tests with `bun run test` only — never bare `bun test` (see CLAUDE.md).
- Import via `@/*` aliases, never parent-relative `../`.
- Type aliases only, no `interface`; no `any`; no type casts.
- Prefer `?.` always paired with `??`.
- Do not commit, push, branch, or open a PR until CJ says so.
- Current branch is `backfill-seasons`.

---

### Task 1: Null-tolerant stat parsing

**Files:**

- Modify: `src/lib/balldontlie/schemas.ts` (`bdlStatSchema`)
- Modify: `src/lib/balldontlie/transform.ts` (`toGameLogInput`)
- Test: `src/lib/balldontlie/schemas.test.ts`, `src/lib/balldontlie/transform.test.ts`

**Interfaces:**

- Produces: `BdlStat` with `fgm | fga | fg3m | fg3a | ftm | fta | oreb | dreb | reb | ast | stl | blk | turnover | pts` typed `number | null`. `GameLogInput` is unchanged — all fields stay `number`, because the transform coalesces.

- [ ] **Step 1: Write the failing tests**

In `schemas.test.ts`, after the existing `bdlStatSchema` describe block:

```ts
const inactiveStatRow = {
  ...statRow,
  id: 13541,
  min: null,
  fgm: null,
  fga: null,
  fg3m: null,
  fg3a: null,
  ftm: null,
  fta: null,
  oreb: null,
  dreb: null,
  reb: null,
  ast: null,
  stl: null,
  blk: null,
  turnover: null,
  pts: null,
  plus_minus: null,
};

describe("bdlStatSchema inactive rows", () => {
  it("parses a row where every counting stat is null", () => {
    const parsed = bdlStatSchema.parse(inactiveStatRow);

    expect(parsed.pts).toBeNull();
    expect(parsed.reb).toBeNull();
    expect(parsed.turnover).toBeNull();
  });

  it("still rejects a row missing the nested game", () => {
    const { game: _game, ...withoutGame } = inactiveStatRow;

    expect(() => bdlStatSchema.parse(withoutGame)).toThrow();
  });

  it("parses a full page containing an inactive row", () => {
    const page = bdlPaginatedPage(bdlStatSchema).parse({
      data: [statRow, inactiveStatRow],
      meta: { next_cursor: null, per_page: 100 },
    });

    expect(page.data).toHaveLength(2);
  });
});
```

In `transform.test.ts`:

```ts
const inactiveStat: BdlStat = {
  ...homeStat,
  id: 99,
  min: null,
  fgm: null,
  fga: null,
  fg3m: null,
  fg3a: null,
  ftm: null,
  fta: null,
  oreb: null,
  dreb: null,
  reb: null,
  ast: null,
  stl: null,
  blk: null,
  turnover: null,
  pts: null,
  plus_minus: null,
};

describe("toGameLogInput inactive rows", () => {
  it("coalesces every null counting stat to 0", () => {
    const log = toGameLogInput({ stat: inactiveStat, teamAbbrById });

    expect(log.minutes).toBe(0);
    expect(log.fgm).toBe(0);
    expect(log.fg3a).toBe(0);
    expect(log.oreb).toBe(0);
    expect(log.reb).toBe(0);
    expect(log.stl).toBe(0);
    expect(log.tov).toBe(0);
    expect(log.pts).toBe(0);
    expect(log.plusMinus).toBeNull();
  });

  it("does not count an inactive row toward gamesPlayed", () => {
    const played = toGameLogInput({ stat: homeStat, teamAbbrById });
    const inactive = toGameLogInput({ stat: inactiveStat, teamAbbrById });

    const [season] = aggregateSeasonStats([played, inactive]);

    expect(season.gamesPlayed).toBe(1);
    expect(season.pts).toBe(29);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/balldontlie`
Expected: FAIL — Zod rejects `null` for `fgm` etc.; TypeScript rejects `null` in the `BdlStat` literal.

- [ ] **Step 3: Make the fourteen counting stats nullable**

In `schemas.ts`, `bdlStatSchema` — change each of these from `z.number()` to `z.number().nullable()`: `fgm`, `fga`, `fg3m`, `fg3a`, `ftm`, `fta`, `oreb`, `dreb`, `reb`, `ast`, `stl`, `blk`, `turnover`, `pts`. Leave `id`, `min`, `plus_minus`, `player`, `team`, `game` as they are. Add above the schema:

```ts
// Counting stats are nullable: from 2018-19 back, `/v1/stats` returns rows for
// inactive roster players with every stat null (and 1996-97 back, whole
// categories the league did not yet track). Zod validates a page at a time, so
// a required number here would reject the page and abort the season. The
// transform coalesces to 0, matching how 2022-23+ DNP rows already land.
```

- [ ] **Step 4: Coalesce in the transform**

In `transform.ts`, `toGameLogInput` — append `?? 0` to each stat field:

```ts
    minutes: parseMinutes(stat.min ?? 0),
    fgm: stat.fgm ?? 0,
    fga: stat.fga ?? 0,
    fg3m: stat.fg3m ?? 0,
    fg3a: stat.fg3a ?? 0,
    ftm: stat.ftm ?? 0,
    fta: stat.fta ?? 0,
    oreb: stat.oreb ?? 0,
    dreb: stat.dreb ?? 0,
    reb: stat.reb ?? 0,
    ast: stat.ast ?? 0,
    stl: stat.stl ?? 0,
    blk: stat.blk ?? 0,
    tov: stat.turnover ?? 0,
    pts: stat.pts ?? 0,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test src/lib/balldontlie`
Expected: PASS, including the pre-existing `sync.test.ts` unchanged.

---

### Task 2: Move the backfill floor to 2016

**Files:**

- Modify: `src/lib/balldontlie/constants.ts:15-16`
- Test: `src/lib/balldontlie/constants.test.ts`, `src/lib/stats/searchParams.test.ts`

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: `BACKFILL_START_YEAR = 2016`; `BACKFILL_SEASON_YEARS` = ten strings `"2016"`…`"2025"`; `SEASON_OPTIONS` = ten labels newest-first, `"2025-26"`…`"2016-17"`.

- [ ] **Step 1: Update the failing tests**

In `constants.test.ts`, replace the `BACKFILL_SEASON_YEARS` assertion:

```ts
describe("BACKFILL_SEASON_YEARS", () => {
  it("spans 2016 through the current season year, oldest first", () => {
    expect(BACKFILL_SEASON_YEARS).toEqual([
      "2016",
      "2017",
      "2018",
      "2019",
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
    ]);
  });
});
```

In `searchParams.test.ts`, replace the "rejects seasons outside the backfill window" test and extend the accepted-season test:

```ts
it("parses every known season label and the career sentinel", async () => {
  expect((await loadStatFilters({ season: "2025-26" })).season).toBe("2025-26");
  expect((await loadStatFilters({ season: "2020-21" })).season).toBe("2020-21");
  expect((await loadStatFilters({ season: "2016-17" })).season).toBe("2016-17");
  expect((await loadStatFilters({ season: "career" })).season).toBe("career");
});

it("rejects seasons outside the backfill window", async () => {
  expect((await loadStatFilters({ season: "2015-16" })).season).toBeNull();
  expect((await loadStatFilters({ season: "bogus" })).season).toBeNull();
});
```

Also update the existing `SEASON_OPTIONS` describe block so the expected length is 10 and the oldest entry is `"2016-17"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/balldontlie/constants.test.ts src/lib/stats/searchParams.test.ts`
Expected: FAIL — arrays still start at 2020.

- [ ] **Step 3: Move the constant**

In `constants.ts`:

```ts
// Historical backfill window: 2016-17 through the current season, oldest
// first so player rows finish reflecting the most recent team/position.
// 2016 is the floor by choice, not by API limit — Balldontlie serves box
// scores to 1946-47 and advanced stats to 1996-97.
export const BACKFILL_START_YEAR = 2016;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test`
Expected: PASS across the whole suite.

---

### Task 3: Correct the throttle comment

**Files:**

- Modify: `src/lib/balldontlie/constants.ts:22-23`

No test — comment only. `THROTTLE_MS` keeps its value of 1100; only the wrong justification changes.

- [ ] **Step 1: Replace the comment**

```ts
// The key's live headers report x-ratelimit-limit: 600 (10 req/s). 1100ms is a
// deliberately conservative ~55 req/min — well under the ceiling, not at it.
// bdlFetch already honours Retry-After on 429 if that ever changes.
export const THROTTLE_MS = 1100;
```

- [ ] **Step 2: Verify nothing broke**

Run: `bun run test src/lib/balldontlie/constants.test.ts`
Expected: PASS.

---

### Task 4: Full verification gate

- [ ] **Step 1: Run the whole check suite**

Run: `bun run system-check`
Expected: `format:check`, `lint`, `typecheck`, `test`, `build` all pass.

---

### Task 5: Run the backfill

Data run, not a code change. Both commands must run as a pair.

- [ ] **Step 1: Sync the four historical seasons**

```bash
bun run sync:bdl 2016 2017 2018 2019
```

Expected: ~15 min per season, ~1–1.5 hours total. Per-season log lines report page counts and upsert totals. On failure mid-season, re-run that year alone — `upsertGameLogs` deletes and re-inserts scoped to `(season, seasonType)` in one transaction, so a repeat is idempotent.

- [ ] **Step 2: Restore current player teams**

```bash
bun run sync:players
```

Expected: ~12 min (throttled at `FREE_TIER_THROTTLE_MS`). **Required** — `sync:bdl` upserts players from each season's stats and would otherwise leave `Player.teamAbbr` showing 2019 teams, breaking `/teams` and the team builder.

- [ ] **Step 3: Verify row counts**

```sql
select season, count(*) from "PlayerGameLog" group by 1 order by 1;
select season, count(*) from "PlayerAdvancedGameLog" group by 1 order by 1;
select season, count(*) from "PlayerSeasonStats" group by 1 order by 1;
```

Expected: ten seasons, 2016-17 → 2025-26, in all three tables.

- [ ] **Step 4: Verify player teams survived**

```sql
select "fullName", "teamAbbr" from "Player" where id = 3547238;
```

Expected: Anthony Edwards, `MIN` — not his 2019 team.

- [ ] **Step 5: Spot-check a 2016-17 line**

```sql
select "gamesPlayed", pts, reb, ast from "PlayerSeasonStats"
where season = '2016-17' and "playerId" = 115;
```

Expected: Stephen Curry 2016-17 — 79 games, 1999 pts, 353 reb, 523 ast (Basketball-Reference). Small deviations are acceptable if BDL's game coverage differs; a wildly low `gamesPlayed` would indicate DNP coalescing went wrong.

- [ ] **Step 6: Check the UI**

Run `bun dev`, open `/players`, confirm the season dropdown offers 2016-17 and a player active that season renders a chart.
