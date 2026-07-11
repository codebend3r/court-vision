# Player Stats Chart + Demo Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed Supabase with all Balldontlie players plus realistic generated 2025-26 game logs for five stars, and ship `/players/[playerId]` showing season-to-date average line charts (starting with Anthony Edwards).

**Architecture:** Free-tier Balldontlie endpoints (`/players`, `/games`) provide real ids and schedules; a deterministic PRNG generates box scores that flow through the existing `src/lib/stats/persist.ts` upserts into Supabase. A pure cumulative-series builder feeds a server-component page that renders a client Recharts chart as two stacked single-axis panels with stat-chip toggles.

**Tech Stack:** Bun, Next.js 16 App Router (RSC), Prisma 7 (`@/lib/prisma`, already pointed at Supabase), Zod 4, Recharts 3.9.2, Vitest 4 + Testing Library, SCSS modules.

**Spec:** `docs/superpowers/specs/2026-07-10-player-stats-chart-design.md`

## Global Constraints

- All commands run through Bun (`bun`, `bunx`); never npm/yarn.
- Every `package.json` dependency exact-pinned (no `^`/`~`); the only new dependency is `recharts` `3.9.2`.
- No `any`, no type casts (`as`); use type guards / `unknown`.
- Prefer `reduce`/array methods over loops; never `for/in` / `for/of`.
- Optional chaining always paired with `??`; `!!` for boolean conversion.
- Functions take a single object parameter, not positional args (new code).
- SCSS modules per component; colors/spacing/font sizes from `src/styles/globals.scss` tokens; no plain (class-less) `div`s; grid + `gap` over margins.
- Tests co-located (`foo.ts` ↔ `foo.test.ts`).
- Commit subjects start with `CV:`; body is concise bullets. Commit after every task (pre-commit hook runs prettier + typecheck + lint + vitest).
- Season constants come from `src/lib/balldontlie/constants.ts`: `SEASON_YEAR = "2025"`, `SEASON_LABEL = "2025-26"`, `SEASON_TYPE = "Regular Season"`, `PER_PAGE = "100"`.
- Balldontlie auth: `Authorization: <key>` header (no Bearer), key from `.env` `BALLDONTLIE_API_KEY`. Free tier = 5 req/min; seed throttles at 13 s/request. Endpoint reference: <https://docs.balldontlie.io/#get-all-players>.

---

### Task 1: `fetchAllPlayers` adapter (schema + fetcher + transform)

**Files:**

- Modify: `src/lib/balldontlie/schemas.ts` (add `bdlPlayerSchema`)
- Modify: `src/lib/balldontlie/constants.ts` (add `FREE_TIER_THROTTLE_MS`)
- Modify: `src/lib/balldontlie/endpoints.ts` (add `fetchAllPlayers`)
- Modify: `src/lib/balldontlie/transform.ts` (add `toPlayerInput`)
- Test: `src/lib/balldontlie/endpoints.test.ts`, `src/lib/balldontlie/transform.test.ts` (extend both)

**Interfaces:**

- Consumes: `bdlFetch`, `bdlPage`, `bdlNestedTeamSchema`, `blankToNull`, `PlayerInput` (all existing).
- Produces:
  - `bdlPlayerSchema` / `type BdlPlayer` — `{ id: number; first_name: string; last_name: string; position?: string | null; jersey_number?: string | null; team?: { id: number; abbreviation: string } | null }`
  - `FREE_TIER_THROTTLE_MS = 13000`
  - `fetchAllPlayers(args?: { deps?: BdlClientDeps; throttleMs?: number }): Promise<BdlPlayer[]>`
  - `toPlayerInput(args: { player: BdlPlayer }): PlayerInput`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/balldontlie/endpoints.test.ts` (mirror the existing `fetchAllStats` pagination test style — mocked `fetchImpl` returning `Response`-likes, `sleep: vi.fn()`):

```ts
describe("fetchAllPlayers", () => {
  const playerRow = {
    id: 3547238,
    first_name: "Anthony",
    last_name: "Edwards",
    position: "G",
    jersey_number: "5",
    team: { id: 18, abbreviation: "MIN" },
  };

  it("paginates with cursor until next_cursor is null and honors throttleMs", async () => {
    const pageOne = { data: [playerRow], meta: { next_cursor: 25, per_page: 100 } };
    const pageTwo = { data: [{ ...playerRow, id: 2, team: null }], meta: { next_cursor: null } };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(pageOne)))
      .mockResolvedValueOnce(new Response(JSON.stringify(pageTwo)));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const players = await fetchAllPlayers({
      deps: { fetchImpl, sleep, apiKey: "k" },
      throttleMs: 13000,
    });

    expect(players).toHaveLength(2);
    expect(fetchImpl.mock.calls[0][0]).toContain("/players?per_page=100");
    expect(fetchImpl.mock.calls[1][0]).toContain("cursor=25");
    expect(sleep).toHaveBeenCalledWith(13000);
  });

  it("rejects rows that fail the player schema", async () => {
    const bad = { data: [{ id: "nope" }], meta: { next_cursor: null } };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(bad)));
    await expect(fetchAllPlayers({ deps: { fetchImpl, apiKey: "k" } })).rejects.toThrow();
  });
});
```

Append to `src/lib/balldontlie/transform.test.ts`:

```ts
describe("toPlayerInput", () => {
  it("maps a full player row", () => {
    const input = toPlayerInput({
      player: {
        id: 3547238,
        first_name: "Anthony",
        last_name: "Edwards",
        position: "G",
        jersey_number: "5",
        team: { id: 18, abbreviation: "MIN" },
      },
    });
    expect(input).toEqual({
      id: 3547238,
      firstName: "Anthony",
      lastName: "Edwards",
      fullName: "Anthony Edwards",
      teamId: 18,
      teamAbbr: "MIN",
      position: "G",
      jerseyNumber: "5",
    });
  });

  it("nulls team fields and blanks", () => {
    const input = toPlayerInput({
      player: { id: 1, first_name: "Old", last_name: "Timer", position: "", team: null },
    });
    expect(input).toMatchObject({
      teamId: null,
      teamAbbr: null,
      position: null,
      jerseyNumber: null,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/lib/balldontlie` — expect FAIL (`fetchAllPlayers` / `toPlayerInput` not exported).

- [ ] **Step 3: Implement**

`schemas.ts` — after `bdlNestedTeamSchema`:

```ts
export const bdlPlayerSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  position: z.string().nullable().optional(),
  jersey_number: z.string().nullable().optional(),
  team: bdlNestedTeamSchema.nullable().optional(),
});

export type BdlPlayer = z.infer<typeof bdlPlayerSchema>;
```

`constants.ts` — after `THROTTLE_MS`:

```ts
// Free tier allows 5 req/min; 13s spacing stays safely under.
export const FREE_TIER_THROTTLE_MS = 13000;
```

`endpoints.ts`:

```ts
export const fetchAllPlayers = async (
  args: { deps?: BdlClientDeps; throttleMs?: number } = {},
): Promise<BdlPlayer[]> => {
  const { deps = {}, throttleMs = THROTTLE_MS } = args;
  const sleep = deps.sleep ?? defaultSleep;
  const pageSchema = bdlPage(bdlPlayerSchema);

  const loadPage = async (cursor: number | null, acc: BdlPlayer[]): Promise<BdlPlayer[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint: "players",
      params: { per_page: PER_PAGE, ...cursorParam },
      apiKey: deps.apiKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
    });
    const page = pageSchema.parse(raw);
    const combined = acc.concat(page.data);
    const next = page.meta.next_cursor ?? null;
    if (next === null) {
      return combined;
    }
    await sleep(throttleMs);
    return loadPage(next, combined);
  };

  return loadPage(null, []);
};
```

`transform.ts`:

```ts
export const toPlayerInput = (args: { player: BdlPlayer }): PlayerInput => {
  const { player } = args;
  return {
    id: player.id,
    firstName: player.first_name,
    lastName: player.last_name,
    fullName: `${player.first_name} ${player.last_name}`,
    teamId: player.team?.id ?? null,
    teamAbbr: player.team?.abbreviation ?? null,
    position: blankToNull(player.position),
    jerseyNumber: blankToNull(player.jersey_number),
  };
};
```

- [ ] **Step 4: Run tests to verify they pass** — `bun run test -- src/lib/balldontlie`
- [ ] **Step 5: Commit** — `CV: add fetchAllPlayers adapter (schema, fetcher, transform)`

---

### Task 2: `fetchTeamGames` + `deriveGameContext` refactor

**Files:**

- Modify: `src/lib/balldontlie/schemas.ts` (export `bdlGameSchema` + `BdlGame`)
- Modify: `src/lib/balldontlie/endpoints.ts` (add `fetchTeamGames`)
- Modify: `src/lib/balldontlie/transform.ts` (extract `deriveGameContext`; refactor `toGameLogInput` to use it)
- Test: extend `endpoints.test.ts` + `transform.test.ts`

**Interfaces:**

- Produces:
  - `export const bdlGameSchema` (existing shape, now exported) / `export type BdlGame`
  - `fetchTeamGames(args: { teamId: number; deps?: BdlClientDeps; throttleMs?: number }): Promise<BdlGame[]>` — season `SEASON_YEAR`, `postseason=false`, cursor-paginated like Task 1.
  - `deriveGameContext(args: { game: BdlGame; teamId: number; teamAbbr: string; teamAbbrById: Map<number, string> }): GameContext` where `GameContext = { homeAway: "home" | "away"; opponentAbbr: string | null; winLoss: string | null; matchup: string; gameDate: Date }` (`gameDate` via existing `parseGameDate(game.date)`; `winLoss` `"W"`/`"L"`/`null` on tie; `matchup` `"MIN vs. BOS"` home / `"MIN @ BOS"` away).
- Consumes: Task 1's pagination pattern; existing `toGameLogInput` behavior must not change (its tests keep passing).

- [ ] **Step 1: Write failing tests**

`endpoints.test.ts`:

```ts
describe("fetchTeamGames", () => {
  it("requests the team season schedule and paginates", async () => {
    const game = {
      id: 18422,
      date: "2025-10-22",
      season: 2025,
      home_team_id: 18,
      visitor_team_id: 2,
      home_team_score: 112,
      visitor_team_score: 108,
      postseason: false,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [game], meta: { next_cursor: null } })),
      );
    const games = await fetchTeamGames({ teamId: 18, deps: { fetchImpl, apiKey: "k" } });
    expect(games).toEqual([game]);
    const url = fetchImpl.mock.calls[0][0];
    expect(url).toContain("/games?");
    expect(url).toContain("seasons[]=2025");
    expect(url).toContain("team_ids[]=18");
    expect(url).toContain("postseason=false");
  });
});
```

`transform.test.ts`:

```ts
describe("deriveGameContext", () => {
  const game = {
    id: 1,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 18,
    visitor_team_id: 2,
    home_team_score: 100,
    visitor_team_score: 110,
    postseason: false,
  };
  const teamAbbrById = new Map([
    [18, "MIN"],
    [2, "BOS"],
  ]);

  it("derives home loss", () => {
    const ctx = deriveGameContext({ game, teamId: 18, teamAbbr: "MIN", teamAbbrById });
    expect(ctx).toMatchObject({
      homeAway: "home",
      opponentAbbr: "BOS",
      winLoss: "L",
      matchup: "MIN vs. BOS",
    });
    expect(ctx.gameDate.toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("derives away win", () => {
    const ctx = deriveGameContext({ game, teamId: 2, teamAbbr: "BOS", teamAbbrById });
    expect(ctx).toMatchObject({
      homeAway: "away",
      opponentAbbr: "MIN",
      winLoss: "W",
      matchup: "BOS @ MIN",
    });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bun run test -- src/lib/balldontlie`
- [ ] **Step 3: Implement**

`schemas.ts`: change `const bdlGameSchema` to `export const bdlGameSchema` and add `export type BdlGame = z.infer<typeof bdlGameSchema>;`

`endpoints.ts` (same recursion shape as `fetchAllPlayers`):

```ts
export const fetchTeamGames = async (args: {
  teamId: number;
  deps?: BdlClientDeps;
  throttleMs?: number;
}): Promise<BdlGame[]> => {
  const { teamId, deps = {}, throttleMs = THROTTLE_MS } = args;
  const sleep = deps.sleep ?? defaultSleep;
  const pageSchema = bdlPage(bdlGameSchema);

  const loadPage = async (cursor: number | null, acc: BdlGame[]): Promise<BdlGame[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint: "games",
      params: {
        seasons: [SEASON_YEAR],
        team_ids: [String(teamId)],
        postseason: "false",
        per_page: PER_PAGE,
        ...cursorParam,
      },
      apiKey: deps.apiKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
    });
    const page = pageSchema.parse(raw);
    const combined = acc.concat(page.data);
    const next = page.meta.next_cursor ?? null;
    if (next === null) {
      return combined;
    }
    await sleep(throttleMs);
    return loadPage(next, combined);
  };

  return loadPage(null, []);
};
```

`transform.ts` — extract from `toGameLogInput` (which then delegates):

```ts
export interface GameContext {
  homeAway: "home" | "away";
  opponentAbbr: string | null;
  winLoss: string | null;
  matchup: string;
  gameDate: Date;
}

export const deriveGameContext = (args: {
  game: BdlGame;
  teamId: number;
  teamAbbr: string;
  teamAbbrById: Map<number, string>;
}): GameContext => {
  const { game, teamId, teamAbbr, teamAbbrById } = args;
  const homeAway = teamId === game.home_team_id ? "home" : "away";
  const opponentTeamId = homeAway === "home" ? game.visitor_team_id : game.home_team_id;
  const opponentAbbr = teamAbbrById.get(opponentTeamId) ?? null;
  const teamScore = homeAway === "home" ? game.home_team_score : game.visitor_team_score;
  const opponentScore = homeAway === "home" ? game.visitor_team_score : game.home_team_score;
  const winLoss = teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : null;
  const separator = homeAway === "away" ? "@" : "vs.";
  return {
    homeAway,
    opponentAbbr,
    winLoss,
    matchup: `${teamAbbr} ${separator} ${opponentAbbr ?? ""}`.trim(),
    gameDate: parseGameDate(game.date),
  };
};
```

In `toGameLogInput`, replace the six derivation lines with:

```ts
const context = deriveGameContext({
  game,
  teamId: team.id,
  teamAbbr: team.abbreviation,
  teamAbbrById,
});
```

and spread its fields into the returned object (`...context` replaces `homeAway`, `opponentAbbr`, `winLoss`, `matchup`, `gameDate`).

- [ ] **Step 4: Run tests (all balldontlie tests still green)** — `bun run test -- src/lib/balldontlie`
- [ ] **Step 5: Commit** — `CV: add fetchTeamGames + extract deriveGameContext`

---

### Task 3: Demo profiles, PRNG, game-log generator

**Files:**

- Create: `src/lib/demo/prng.ts`, `src/lib/demo/profiles.ts`, `src/lib/demo/generate.ts`
- Test: `src/lib/demo/generate.test.ts`

**Interfaces:**

- Consumes: `BdlGame`, `deriveGameContext` (Task 2), `GameLogInput`, `SEASON_LABEL`, `SEASON_TYPE`.
- Produces:
  - `createPrng(seed: number): () => number` — mulberry32, floats in [0,1).
  - `gaussian(args: { rng: () => number; mean: number; spread: number }): number` — Box-Muller.
  - `interface MeanSpread { mean: number; spread: number }`
  - `interface DemoProfile { fullName: string; gamesPlayed: number; minutes: MeanSpread; fga: MeanSpread; fg3a: MeanSpread; fta: MeanSpread; fgPct: number; fg3Pct: number; ftPct: number; oreb: MeanSpread; dreb: MeanSpread; ast: MeanSpread; stl: MeanSpread; blk: MeanSpread; tov: MeanSpread }`
  - `DEMO_PROFILES: DemoProfile[]` (five entries below)
  - `generateGameLogs(args: { playerId: number; teamId: number; teamAbbr: string; games: BdlGame[]; profile: DemoProfile; teamAbbrById: Map<number, string> }): GameLogInput[]`

`profiles.ts` data (plausible 2025-26, not official):

```ts
export const DEMO_PROFILES: DemoProfile[] = [
  {
    fullName: "Anthony Edwards",
    gamesPlayed: 79,
    minutes: { mean: 36.3, spread: 3 },
    fga: { mean: 20.3, spread: 4 },
    fg3a: { mean: 10.1, spread: 3 },
    fta: { mean: 6.4, spread: 2.5 },
    fgPct: 0.447,
    fg3Pct: 0.395,
    ftPct: 0.837,
    oreb: { mean: 0.8, spread: 0.9 },
    dreb: { mean: 4.9, spread: 2 },
    ast: { mean: 4.5, spread: 2 },
    stl: { mean: 1.2, spread: 1 },
    blk: { mean: 0.6, spread: 0.7 },
    tov: { mean: 3.3, spread: 1.5 },
  },
  {
    fullName: "Shai Gilgeous-Alexander",
    gamesPlayed: 76,
    minutes: { mean: 34.2, spread: 3 },
    fga: { mean: 21.8, spread: 4 },
    fg3a: { mean: 5.7, spread: 2 },
    fta: { mean: 8.8, spread: 3 },
    fgPct: 0.519,
    fg3Pct: 0.375,
    ftPct: 0.898,
    oreb: { mean: 0.9, spread: 0.9 },
    dreb: { mean: 4.1, spread: 1.8 },
    ast: { mean: 6.4, spread: 2 },
    stl: { mean: 1.7, spread: 1 },
    blk: { mean: 1, spread: 0.9 },
    tov: { mean: 2.4, spread: 1.2 },
  },
  {
    fullName: "Luka Doncic",
    gamesPlayed: 70,
    minutes: { mean: 35.4, spread: 3 },
    fga: { mean: 21, spread: 4 },
    fg3a: { mean: 9.5, spread: 3 },
    fta: { mean: 7.5, spread: 3 },
    fgPct: 0.45,
    fg3Pct: 0.368,
    ftPct: 0.782,
    oreb: { mean: 0.8, spread: 0.9 },
    dreb: { mean: 7.4, spread: 2.5 },
    ast: { mean: 7.7, spread: 2.5 },
    stl: { mean: 1.6, spread: 1 },
    blk: { mean: 0.4, spread: 0.6 },
    tov: { mean: 3.6, spread: 1.5 },
  },
  {
    fullName: "Jayson Tatum",
    gamesPlayed: 74,
    minutes: { mean: 36.4, spread: 3 },
    fga: { mean: 20.5, spread: 4 },
    fg3a: { mean: 9.8, spread: 3 },
    fta: { mean: 6.2, spread: 2.5 },
    fgPct: 0.452,
    fg3Pct: 0.343,
    ftPct: 0.814,
    oreb: { mean: 0.9, spread: 0.9 },
    dreb: { mean: 7.8, spread: 2.5 },
    ast: { mean: 6, spread: 2 },
    stl: { mean: 1.1, spread: 0.9 },
    blk: { mean: 0.5, spread: 0.7 },
    tov: { mean: 2.9, spread: 1.3 },
  },
  {
    fullName: "Giannis Antetokounmpo",
    gamesPlayed: 67,
    minutes: { mean: 34.2, spread: 3 },
    fga: { mean: 19.5, spread: 4 },
    fg3a: { mean: 0.9, spread: 1 },
    fta: { mean: 10.5, spread: 3.5 },
    fgPct: 0.601,
    fg3Pct: 0.222,
    ftPct: 0.617,
    oreb: { mean: 2.2, spread: 1.4 },
    dreb: { mean: 9.7, spread: 3 },
    ast: { mean: 6.5, spread: 2.2 },
    stl: { mean: 0.9, spread: 0.8 },
    blk: { mean: 1.2, spread: 1 },
    tov: { mean: 3.1, spread: 1.4 },
  },
];
```

**Note:** match on `fullName` after Unicode normalization — Balldontlie may spell "Luka Dončić" with diacritics. Resolution (in Task 4) compares `normalizeName(fullName)` where `normalizeName` lowercases and strips diacritics via `name.normalize("NFD").replace(/[̀-ͯ]/g, "")`.

**Generator algorithm** (`generate.ts`):

1. `rng = createPrng(playerId)` — one PRNG per player; **never** `Math.random()`/`Date.now()`.
2. Consider only games with `home_team_score + visitor_team_score > 0` (played), sorted ascending by `date`.
3. DNP selection: `indices.map((i) => ({ i, r: rng() })).sort(...).slice(0, played.length - gamesPlayed)` → `Set` of skipped indices (deterministic; if `played.length <= gamesPlayed`, skip none).
4. Per remaining game, using helpers `nonNegInt(rng, ms) = Math.max(0, Math.round(gaussian(...)))` and `boundedPct(rng, pct) = Math.min(0.95, Math.max(0.1, gaussian({ rng, mean: pct, spread: 0.09 })))`:
   - `minutes = Math.round(Math.min(44, Math.max(20, gaussian(minutes))) * 10) / 10`
   - `fga = nonNegInt(fga)`; `fg3a = Math.min(fga, nonNegInt(fg3a))`; `fta = nonNegInt(fta)`
   - `fg3m = Math.round(fg3a * boundedPct(fg3Pct))`; `fg2m = Math.round((fga - fg3a) * boundedPct(fgPct))`; `fgm = fg2m + fg3m`; `ftm = Math.round(fta * boundedPct(ftPct))`
   - `pts = 2 * (fgm - fg3m) + 3 * fg3m + ftm` (identity holds by construction)
   - `oreb`, `dreb` via `nonNegInt`; `reb = oreb + dreb`; `ast/stl/blk/tov` via `nonNegInt`
   - context from `deriveGameContext({ game, teamId, teamAbbr, teamAbbrById })`; `season: SEASON_LABEL`, `seasonType: SEASON_TYPE`, `gameId: String(game.id)`, `plusMinus: null`.

- [ ] **Step 1: Write failing tests** (`generate.test.ts`) — build 82 fake `BdlGame`s (`Array.from({ length: 82 }, ...)`, dates `2025-10-${...}`-style incrementing ISO dates, alternating home/away, non-zero scores), run `generateGameLogs` with the Edwards profile, assert:
  - determinism: two calls with identical args produce deeply equal arrays;
  - length === `profile.gamesPlayed` (79);
  - every row: `pts === 2 * (fgm - fg3m) + 3 * fg3m + ftm`, `reb === oreb + dreb`, `fgm >= fg3m`, `fga >= fgm`, `fg3a >= fg3m`, `fta >= ftm`, all counts `>= 0`, `season === "2025-26"`;
  - unplayed games (score 0-0) are excluded: append two 0-0 games, expect length unchanged;
  - aggregate plausibility: mean pts across rows within ±20% of 27.6.
- [ ] **Step 2: Run to verify failure** — `bun run test -- src/lib/demo`
- [ ] **Step 3: Implement** `prng.ts` (mulberry32 + gaussian via Box-Muller using two `rng()` draws), `profiles.ts`, `generate.ts` per the algorithm above. Mulberry32:

```ts
export const createPrng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const gaussian = (args: { rng: () => number; mean: number; spread: number }): number => {
  const { rng, mean, spread } = args;
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return mean + spread * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};
```

- [ ] **Step 4: Run tests** — `bun run test -- src/lib/demo`
- [ ] **Step 5: Commit** — `CV: add demo profiles, seeded PRNG, game-log generator`

---

### Task 4: `seed:demo` script

**Files:**

- Create: `src/lib/demo/seed.ts`
- Modify: `package.json` (add `"seed:demo": "bun run src/lib/demo/seed.ts"` to scripts)
- Test: `src/lib/demo/seed.test.ts`

**Interfaces:**

- Consumes: `fetchTeams`, `fetchAllPlayers`, `fetchTeamGames`, `toPlayerInput`, `generateGameLogs`, `DEMO_PROFILES`, `aggregateSeasonStats`, `upsertPlayers`/`upsertGameLogs`/`upsertSeasonStats`, `FREE_TIER_THROTTLE_MS`, `SyncSummary`.
- Produces: `seedDemo(deps?: BdlClientDeps): Promise<SyncSummary>` + `import.meta.main` entry block (copy the `declare global` ImportMeta pattern from `src/lib/balldontlie/sync.ts`).

Flow (all sequential — free-tier throttle):

```ts
export async function seedDemo(deps: BdlClientDeps = {}): Promise<SyncSummary> {
  const teams = await fetchTeams(deps);
  const teamAbbrById = teams.reduce(
    (map, team) => map.set(team.id, team.abbreviation),
    new Map<number, string>(),
  );

  const bdlPlayers = await fetchAllPlayers({ deps, throttleMs: FREE_TIER_THROTTLE_MS });
  const players = await upsertPlayers(bdlPlayers.map((player) => toPlayerInput({ player })));

  const byName = bdlPlayers.reduce(
    (map, player) => map.set(normalizeName(`${player.first_name} ${player.last_name}`), player),
    new Map<number, BdlPlayer>() /* keyed by normalized string — use Map<string, BdlPlayer> */,
  );

  const gameLogInputs = await DEMO_PROFILES.reduce(async (previous, profile) => {
    const acc = await previous;
    const match = byName.get(normalizeName(profile.fullName));
    const team = match?.team ?? null;
    if (!match || team === null) {
      throw new Error(`Demo profile not resolvable: ${profile.fullName}`);
    }
    const games = await fetchTeamGames({
      teamId: team.id,
      deps,
      throttleMs: FREE_TIER_THROTTLE_MS,
    });
    return acc.concat(
      generateGameLogs({
        playerId: match.id,
        teamId: team.id,
        teamAbbr: team.abbreviation,
        games,
        profile,
        teamAbbrById,
      }),
    );
  }, Promise.resolve<GameLogInput[]>([]));

  const gameLogs = await upsertGameLogs(gameLogInputs);
  const seasonStats = await upsertSeasonStats(aggregateSeasonStats(gameLogInputs));
  return { players, seasonStats, gameLogs };
}
```

(`normalizeName` lives in `generate.ts` or a small `names.ts`; export it. The 429 case needs no extra handling — `bdlFetch` already honors `retry-after`.) Progress: `console.log` after the players fetch and per profile, so the ~14-minute run shows life.

- [ ] **Step 1: Write failing test** (`seed.test.ts`, mirror `sync.test.ts` spies): mock `endpoints.fetchTeams` (MIN/OKC/DAL/BOS/MIL rows), `endpoints.fetchAllPlayers` returning five rows whose names match `DEMO_PROFILES` (plus one extra unprofiled player), `endpoints.fetchTeamGames` returning 3 played fake games, spies on the three persist fns. Assert: `upsertPlayers` called with 6 mapped inputs; `fetchTeamGames` called 5 times; summary matches spy returns; and a second test where `fetchAllPlayers` omits Edwards → `await expect(seedDemo(...)).rejects.toThrow("Demo profile not resolvable")`.
- [ ] **Step 2: Run to verify failure** — `bun run test -- src/lib/demo`
- [ ] **Step 3: Implement** `seed.ts` + `package.json` script (keep alphabetical-ish placement near `sync:bdl`).
- [ ] **Step 4: Run tests** — `bun run test -- src/lib/demo`
- [ ] **Step 5: Commit** — `CV: add seed:demo script (all players + generated game logs)`

---

### Task 5: Cumulative series builder

**Files:**

- Create: `src/lib/stats/cumulative.ts`
- Test: `src/lib/stats/cumulative.test.ts`

**Interfaces:**

- Produces:

```ts
export interface CumulativeSourceLog {
  gameDate: Date; matchup: string; winLoss: string | null;
  minutes: number; fgm: number; fga: number; fg3m: number; fg3a: number;
  ftm: number; fta: number; reb: number; ast: number; stl: number;
  blk: number; tov: number; pts: number;
}

export interface CumulativePoint {
  gameIndex: number;          // 1-based
  gameDate: string;           // ISO string (serializable RSC → client)
  matchup: string;
  winLoss: string | null;
  min: number; pts: number; reb: number; ast: number;
  stl: number; blk: number; tov: number;                  // season-to-date means
  fgPct: number | null; fg3Pct: number | null; ftPct: number | null; // 0–100, null if 0 attempts
}

export const buildCumulativeSeries = (args: { logs: CumulativeSourceLog[] }): CumulativePoint[]
```

Implementation: single `reduce` carrying `{ points, totals }`; means = `total / (index + 1)`; percentages = `100 * makes / attempts` with `attempts === 0 ? null : ...`. Caller passes logs already sorted ascending; Prisma `PlayerGameLog` rows satisfy `CumulativeSourceLog` structurally.

- [ ] **Step 1: Write failing test** — two-game golden case with hand-computed expectations (e.g. game 1: 30 pts, 10/20 FG; game 2: 20 pts, 5/10 FG → point 2: `pts 25`, `fgPct 50`), plus: percentages are ratio-of-sums not mean-of-pcts (construct a case where the two differ, e.g. 1/2 then 9/18 → 50, while mean-of-pcts would also be 50 — instead use 1/4 then 9/12: ratio 62.5 vs mean 50; assert 62.5), `fta 0` in both games → `ftPct null` at both points, empty input → `[]`, `gameIndex` 1-based, `gameDate` ISO string.
- [ ] **Step 2: Run to verify failure** — `bun run test -- src/lib/stats`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests.**
- [ ] **Step 5: Commit** — `CV: add cumulative season-average series builder`

---

### Task 6: `PlayerStatChart` component (Recharts)

**Files:**

- Modify: `package.json` (add `"recharts": "3.9.2"` to dependencies — exact pin), run `bun install`
- Create: `src/components/PlayerStatChart/statMeta.ts`
- Create: `src/components/PlayerStatChart/PlayerStatChart.tsx`
- Create: `src/components/PlayerStatChart/PlayerStatChart.module.scss`
- Test: `src/components/PlayerStatChart/PlayerStatChart.test.tsx`

**Interfaces:**

- Consumes: `CumulativePoint` (Task 5).
- Produces: `PlayerStatChart({ series }: { series: CumulativePoint[] })` — client component (`"use client"`).

`statMeta.ts` — colors are the dataviz reference palette dark steps, validated against surface `#151a23` (7-slot counting set passes; floor-band CVD pair `#c98500`/`#008300` mitigated by end-of-line direct labels; 3-slot shooting set passes clean). Color follows the stat — never reassigned when toggles change:

```ts
export type StatKey =
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "min"
  | "tov"
  | "fgPct"
  | "fg3Pct"
  | "ftPct";
export type StatPanel = "counting" | "shooting";

export interface StatMeta {
  key: StatKey;
  label: string;
  panel: StatPanel;
  color: string;
}

export const STAT_META: StatMeta[] = [
  { key: "pts", label: "PTS", panel: "counting", color: "#3987e5" },
  { key: "reb", label: "REB", panel: "counting", color: "#199e70" },
  { key: "ast", label: "AST", panel: "counting", color: "#c98500" },
  { key: "stl", label: "STL", panel: "counting", color: "#008300" },
  { key: "blk", label: "BLK", panel: "counting", color: "#9085e9" },
  { key: "min", label: "MIN", panel: "counting", color: "#e66767" },
  { key: "tov", label: "TOV", panel: "counting", color: "#d55181" },
  { key: "fgPct", label: "FG%", panel: "shooting", color: "#3987e5" },
  { key: "fg3Pct", label: "3P%", panel: "shooting", color: "#199e70" },
  { key: "ftPct", label: "FT%", panel: "shooting", color: "#c98500" },
];

export const DEFAULT_ACTIVE_KEYS: StatKey[] = ["pts", "reb", "ast"];
```

Component structure (`PlayerStatChart.tsx`):

- `useState<StatKey[]>(DEFAULT_ACTIVE_KEYS)`; `toggle = (key) => setActive((current) => current.includes(key) ? current.filter(...) : [...current, key])`.
- Chip row: `STAT_META.map` → `<button type="button" aria-pressed={active.includes(key)} onClick=... className={styles.chip}>` containing `<span className={styles.dot} style={{ backgroundColor: meta.color }} />` + label. Chips are the legend (identity = dot + text label, not color alone).
- Panels: `countingActive = STAT_META.filter((m) => m.panel === "counting" && active.includes(m.key))`, same for shooting. Counting panel always renders (empty-selection shows a muted hint instead of a chart); shooting panel renders only when `!!shootingActive.length`.
- Each panel: `<section className={styles.panel}><h3>…</h3><ResponsiveContainer width="100%" height={320} initialDimension={{ width: 800, height: 320 }}><LineChart data={series} margin={{ top: 8, right: 56, bottom: 8, left: 0 }}>` with:
  - `<CartesianGrid stroke="#232a36" vertical={false} />` (token `--color-border`; hex inline because SVG presentation attrs can't resolve CSS vars reliably — note the token name in a comment)
  - `<XAxis dataKey="gameIndex" tick={{ fill: "#9aa4b2", fontSize: 12 }} stroke="#232a36" />` (`--color-text-muted`)
  - `<YAxis …same ticks…/>` — shooting panel adds `domain={[0, 100]}`
  - `<Tooltip content={<StatTooltip metas={panelMetas} />} cursor={{ stroke: "#9aa4b2", strokeDasharray: "3 3" }} />`
  - per active meta: `<Line key={meta.key} type="monotone" dataKey={meta.key} stroke={meta.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} label={renderEndLabel({ label: meta.label, lastIndex: series.length - 1 })} />`
- `renderEndLabel` — the direct-label mitigation; muted ink (text never wears series color):

```tsx
const renderEndLabel =
  ({ label, lastIndex }: { label: string; lastIndex: number }) =>
  (props: { x?: number | string; y?: number | string; index?: number }): ReactElement | null => {
    const { x, y, index } = props;
    if (index !== lastIndex || typeof x !== "number" || typeof y !== "number") {
      return null;
    }
    return (
      <text x={x + 8} y={y + 4} fill="#9aa4b2" fontSize={12}>
        {label}
      </text>
    );
  };
```

(If Recharts' `label` prop type rejects this signature at typecheck, wrap in `<LabelList content={...} />` inside the `Line` instead — same render function.)

- `StatTooltip` — typed via recharts `TooltipProps<number, string>`; guard the row payload with a type guard (`isCumulativePoint(value: unknown): value is CumulativePoint` checking `"gameIndex" in value` etc. — no casts). Header: `Game {gameIndex} — {formatDate(gameDate)} {matchup} {winLoss ?? ""}`; rows: dot + label + value (`value.toFixed(1)` counting, `` `${value.toFixed(1)}%` `` shooting). Return `null` when `!active || !payload?.length`.
- SCSS module: root `display: grid; gap: var(--space-4)`; chips row `display: flex; flex-wrap: wrap; gap: var(--space-2)`; chip = surface bg (`--color-surface`), border `--color-border`, radius `--radius-sm`, `font-size: var(--font-size-sm)`; `[aria-pressed="true"]` variant uses `--color-accent` border + text; `.dot` 10px round; panel `h3` muted, `font-size: var(--font-size-sm)`. Tokens only — no raw hex in the SCSS.

- [ ] **Step 1: Add the dependency** — edit `package.json` deps (`"recharts": "3.9.2"`), run `bun install`. Expect lockfile update, no errors.
- [ ] **Step 2: Write failing test** (`PlayerStatChart.test.tsx`): build 5 fake `CumulativePoint`s; render; assert (a) 10 chips, `aria-pressed=true` on exactly PTS/REB/AST; (b) `container.querySelectorAll(".recharts-line").length === 3`; (c) `userEvent.click` TOV chip → 4 lines; (d) shooting heading absent, click FG% → "Shooting percentages" heading appears and total lines === 5; (e) click PTS/REB/AST off → counting panel shows the muted empty hint.
- [ ] **Step 3: Run to verify failure** — `bun run test -- src/components/PlayerStatChart`
- [ ] **Step 4: Implement** `statMeta.ts`, component, SCSS per above.
- [ ] **Step 5: Run tests** — `bun run test -- src/components/PlayerStatChart` (jsdom renders lines thanks to `initialDimension`).
- [ ] **Step 6: Commit** — `CV: add PlayerStatChart (two-panel Recharts, stat chips)`

---

### Task 7: Player page, home list, routes doc

**Files:**

- Create: `src/app/players/[playerId]/page.tsx`, `src/app/players/[playerId]/page.module.scss`
- Modify: `src/app/page.tsx` (+ create `src/app/page.module.scss`)
- Modify: `README.md` (routes table)
- Test: `src/app/players/[playerId]/page.test.tsx`

**Interfaces:**

- Consumes: `prisma` singleton, `buildCumulativeSeries`, `PlayerStatChart`.
- Produces: routes `/players/[playerId]` and updated `/`.

`page.tsx` essentials (Next 16: `params` is a Promise; force dynamic so builds don't hit the DB):

```tsx
import { notFound } from "next/navigation";

import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { prisma } from "@/lib/prisma";
import { buildCumulativeSeries } from "@/lib/stats/cumulative";

import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const numericId = Number.parseInt(playerId, 10);
  if (Number.isNaN(numericId)) {
    notFound();
  }
  const player = await prisma.player.findUnique({ where: { id: numericId } });
  if (player === null) {
    notFound();
  }
  const logs = await prisma.playerGameLog.findMany({
    where: { playerId: numericId },
    orderBy: { gameDate: "asc" },
  });
  const series = buildCumulativeSeries({ logs });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{player.fullName}</h1>
        <p className={styles.meta}>
          {[player.teamAbbr, player.position].filter((part) => !!part).join(" · ")} — 2025-26 ·{" "}
          {series.length} games
        </p>
      </header>
      {series.length === 0 ? (
        <p className={styles.empty}>No game logs for this player yet.</p>
      ) : (
        <PlayerStatChart series={series} />
      )}
    </main>
  );
}
```

Home page: async RSC, `export const dynamic = "force-dynamic"`, keeps `<Hello />`, adds a "Players" `<section>`: `prisma.player.findMany({ where: { gameLogs: { some: {} } }, orderBy: { fullName: "asc" } })` → `<ul>` of `<Link href={`/players/${player.id}`}>` rows (name + `teamAbbr ?? "—"`). SCSS: grid + gap, tokens.

README routes table gains:

```
| `/players/[playerId]` | `src/app/players/[playerId]/page.tsx` | Season-to-date average line charts for one player |
```

- [ ] **Step 1: Write failing test** (`page.test.tsx`): `vi.mock("@/lib/prisma", ...)` with `player.findUnique` / `playerGameLog.findMany` mocks. Cases: (a) known id + 2 logs → `render(await PlayerPage({ params: Promise.resolve({ playerId: "3547238" }) }))` shows the player name and chart chips; (b) unknown id (`findUnique` → `null`) → the call rejects (Next's `notFound()` throws — assert `rejects.toThrow()`); (c) non-numeric id rejects without querying; (d) zero logs → empty-state text, no chips.
- [ ] **Step 2: Run to verify failure** — `bun run test -- src/app`
- [ ] **Step 3: Implement** pages + SCSS + README row.
- [ ] **Step 4: Run full gate** — `bun run system-check`. Expected: green.
- [ ] **Step 5: Commit** — `CV: add /players/[playerId] page + home player list`

---

### Task 8: Live seed run + end-to-end verification

**Files:** none created (operational task; scratch verification script in the session scratchpad, not the repo).

- [ ] **Step 1: Run the seed** — `bun run seed:demo` in the background (≈ 60 throttled requests ≈ 14 min + ~5k row-by-row upserts over the pooler). Watch output for the per-profile progress logs.
- [ ] **Step 2: Verify Supabase rows** — scratchpad script via `bun run <scratchpad>/counts.ts` using `prisma`: expect `player.count()` ≈ several thousand, `playerGameLog.count()` = 79+76+70+74+67 = **366**, `playerSeasonStats.count()` = 5. Record Anthony Edwards' id (`player.findFirst({ where: { fullName: "Anthony Edwards" } })`).
- [ ] **Step 3: Verify the page renders real data** — `bun dev` (port 46644), `curl -s http://localhost:46644/players/<edwardsId>` → contains `Anthony Edwards` and chart markup (`recharts` classes); also `curl -s http://localhost:46644/` lists the five players; `/players/999999999` returns 404; then screenshot/eyeball the chart (dataviz step 7: look at it — label collisions, overflow) before calling it done.
- [ ] **Step 4: Idempotency spot-check** — re-run `bun run seed:demo` is NOT required (upserts proven by tests); skip unless Step 2 counts look wrong.
- [ ] **Step 5: Final gate + wrap-up** — `bun run system-check` green; update the seed task in the session task list; report Edwards' URL.

---

## Self-review notes

- Spec §3.1 (all players, cursor, throttle) → Tasks 1, 4. §3.2/3.3 (profiles, invariants) → Task 3. §3.4 (persistence reuse) → Task 4. §4 → Task 5. §5.1/5.2 → Task 7. §5.3 (two panels, chips, palette, end labels) → Task 6. §6 error handling → Tasks 4 (abort on unresolvable profile) & 7 (notFound/empty). §7 testing → Steps in every task. §8 risks → Task 2 fallback unnecessary (games endpoint confirmed free-tier); Recharts pin in Task 6.
- Names cross-checked: `fetchAllPlayers`/`fetchTeamGames`/`toPlayerInput`/`deriveGameContext`/`generateGameLogs`/`DEMO_PROFILES`/`buildCumulativeSeries`/`CumulativePoint`/`STAT_META`/`DEFAULT_ACTIVE_KEYS` used consistently across tasks.
- No placeholders; every code step shows the code or the exact assertions.
