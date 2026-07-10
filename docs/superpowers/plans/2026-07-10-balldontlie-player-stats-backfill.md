# Balldontlie Player-Stats Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Balldontlie (ALL-STAR tier) adapter that backfills 2025-26 regular-season player stats into the existing Prisma tables, reusing a newly-extracted source-agnostic write path.

**Architecture:** Extract the source-agnostic persistence (`persist.ts`), the `*Input` interfaces, and the pure `parseMinutes`/`parseGameDate` helpers out of `src/lib/nba/` into a neutral `src/lib/stats/` module. Add a new `src/lib/balldontlie/` adapter (constants → client → schemas → endpoints → transform → sync) that targets that shared write path. Season aggregates are derived in memory from the per-game box scores, so no GOAT-tier endpoint is needed. The NBA adapter stays intact.

**Tech Stack:** TypeScript (strict), Bun, Next.js 16, Prisma 7 (`@generated/prisma`), zod 4, Vitest 4.

## Global Constraints

- Bun only for all commands (`bun install`, `bun run test`, `bun run lint`); never npm/yarn.
- Every `package.json` dependency pinned to an exact version (no `^`/`~`). This plan adds **no** new dependencies.
- No `any`; never cast (`as`), never double-cast. Use type guards or `unknown`.
- Prefer `map`/`filter`/`reduce`/`flatMap` over loops. Never use `for`, `for/of`, or `for/in`.
- Optional chaining (`?.`) must always be paired with a `??` fallback.
- Use `!!value` for boolean coercion.
- Functions take a single configurable object param when they'd otherwise have multiple positional args.
- SCSS/CSS rules are irrelevant here (no UI in this plan).
- Tests co-located next to source (`foo.ts` ↔ `foo.test.ts`).
- Commit subjects start with `CV:`; bodies favor bullet points. The pre-commit hook runs pretty-quick + `tsc --noEmit` + `eslint . --max-warnings 0` + `vitest run` — **every commit must pass the full gate**.
- Import alias `@/*` → `src/*`; generated Prisma client at `@generated/prisma`.
- zod validates all untrusted API JSON at the boundary.
- Season constants: `season = "2025-26"`, `seasonType = "Regular Season"`. Balldontlie season param = start year → `"2025"`.

---

### Task 1: Extract source-agnostic write path into `src/lib/stats/`

Pure refactor. Move persistence, the `*Input` shapes, and the two generic parse
helpers out of `nba/` so both adapters can share them. No behavior change — the
existing suite must stay green.

**Files:**

- Create: `src/lib/stats/inputs.ts`
- Create: `src/lib/stats/parse.ts`
- Create: `src/lib/stats/persist.ts`
- Create: `src/lib/stats/persist.test.ts` (moved from `nba/persist.test.ts`)
- Create: `src/lib/stats/parse.test.ts`
- Delete: `src/lib/nba/persist.ts`
- Delete: `src/lib/nba/persist.test.ts`
- Modify: `src/lib/nba/transform.ts` (remove the moved code; import it from `@/lib/stats/*`)
- Modify: `src/lib/nba/transform.test.ts` (drop the `parseMinutes` block; it moved)
- Modify: `src/lib/nba/sync.ts` (import `upsert*` + `SyncSummary` from `@/lib/stats/persist`)
- Modify: `src/lib/nba/sync.test.ts` (repoint the persist spy import)

**Interfaces:**

- Produces: `PlayerInput`, `SeasonStatsInput`, `GameLogInput` (from `@/lib/stats/inputs`); `parseMinutes(value: number | string): number`, `parseGameDate(value: string): Date` (from `@/lib/stats/parse`); `upsertPlayers(players: PlayerInput[]): Promise<number>`, `upsertSeasonStats(rows: SeasonStatsInput[]): Promise<number>`, `upsertGameLogs(rows: GameLogInput[]): Promise<number>`, `interface SyncSummary { players: number; seasonStats: number; gameLogs: number }` (from `@/lib/stats/persist`).

- [ ] **Step 1: Create `src/lib/stats/inputs.ts`**

```ts
export interface PlayerInput {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamId: number | null;
  teamAbbr: string | null;
  position: string | null;
  jerseyNumber: string | null;
}

export interface SeasonStatsInput {
  playerId: number;
  season: string;
  seasonType: string;
  gamesPlayed: number;
  minutes: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
}

export interface GameLogInput {
  playerId: number;
  gameId: string;
  gameDate: Date;
  season: string;
  seasonType: string;
  teamId: number;
  teamAbbr: string;
  matchup: string;
  opponentAbbr: string | null;
  homeAway: "home" | "away";
  winLoss: string | null;
  minutes: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
  plusMinus: number | null;
}
```

- [ ] **Step 2: Create `src/lib/stats/parse.ts`**

```ts
export const parseMinutes = (value: number | string): number => {
  if (typeof value === "number") {
    return value;
  }
  if (value.includes(":")) {
    const [minutes, seconds] = value.split(":");
    const parsedMinutes = Number.parseFloat(minutes);
    const parsedSeconds = Number.parseFloat(seconds);
    if (Number.isNaN(parsedMinutes) || Number.isNaN(parsedSeconds)) {
      return 0;
    }
    return parsedMinutes + parsedSeconds / 60;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const parseGameDate = (value: string): Date => {
  if (!value.includes("T")) {
    return new Date(`${value}T00:00:00Z`);
  }
  // Treat as UTC if no timezone designator is present.
  const hasTimezone = value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value);
  return hasTimezone ? new Date(value) : new Date(`${value}Z`);
};
```

- [ ] **Step 3: Create `src/lib/stats/persist.ts`**

```ts
import { prisma } from "@/lib/prisma";

import { GameLogInput, PlayerInput, SeasonStatsInput } from "./inputs";

export interface SyncSummary {
  players: number;
  seasonStats: number;
  gameLogs: number;
}

export async function upsertPlayers(players: PlayerInput[]): Promise<number> {
  await players.reduce(async (previous, player) => {
    await previous;
    const { id, ...rest } = player;
    await prisma.player.upsert({ where: { id }, create: player, update: rest });
  }, Promise.resolve());
  return players.length;
}

export async function upsertSeasonStats(rows: SeasonStatsInput[]): Promise<number> {
  await rows.reduce(async (previous, row) => {
    await previous;
    await prisma.playerSeasonStats.upsert({
      where: {
        playerId_season_seasonType: {
          playerId: row.playerId,
          season: row.season,
          seasonType: row.seasonType,
        },
      },
      create: row,
      update: row,
    });
  }, Promise.resolve());
  return rows.length;
}

export async function upsertGameLogs(rows: GameLogInput[]): Promise<number> {
  await rows.reduce(async (previous, row) => {
    await previous;
    await prisma.playerGameLog.upsert({
      where: { playerId_gameId: { playerId: row.playerId, gameId: row.gameId } },
      create: row,
      update: row,
    });
  }, Promise.resolve());
  return rows.length;
}
```

- [ ] **Step 4: Create `src/lib/stats/persist.test.ts`** (moved; only the two import lines change)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

import { GameLogInput, PlayerInput, SeasonStatsInput } from "./inputs";
import { upsertGameLogs, upsertPlayers, upsertSeasonStats } from "./persist";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: { upsert: vi.fn() },
    playerSeasonStats: { upsert: vi.fn() },
    playerGameLog: { upsert: vi.fn() },
  },
}));

const player: PlayerInput = {
  id: 1629029,
  firstName: "Luka",
  lastName: "Doncic",
  fullName: "Luka Doncic",
  teamId: 1610612747,
  teamAbbr: "LAL",
  position: "G-F",
  jerseyNumber: "77",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertPlayers", () => {
  it("upserts each player keyed by id and returns the count", async () => {
    const count = await upsertPlayers([player]);
    expect(count).toBe(1);
    expect(prisma.player.upsert).toHaveBeenCalledWith({
      where: { id: 1629029 },
      create: player,
      update: {
        firstName: "Luka",
        lastName: "Doncic",
        fullName: "Luka Doncic",
        teamId: 1610612747,
        teamAbbr: "LAL",
        position: "G-F",
        jerseyNumber: "77",
      },
    });
  });

  it("is idempotent — re-running uses upsert, never create", async () => {
    await upsertPlayers([player]);
    await upsertPlayers([player]);
    expect(prisma.player.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("upsertSeasonStats", () => {
  it("upserts on the composite unique key", async () => {
    const stats: SeasonStatsInput = {
      playerId: 201939,
      season: "2025-26",
      seasonType: "Regular Season",
      gamesPlayed: 70,
      minutes: 2400,
      fgm: 600,
      fga: 1200,
      fg3m: 300,
      fg3a: 700,
      ftm: 200,
      fta: 220,
      oreb: 50,
      dreb: 300,
      reb: 350,
      ast: 450,
      stl: 90,
      blk: 20,
      tov: 200,
      pts: 1700,
    };
    const count = await upsertSeasonStats([stats]);
    expect(count).toBe(1);
    expect(prisma.playerSeasonStats.upsert).toHaveBeenCalledWith({
      where: {
        playerId_season_seasonType: {
          playerId: 201939,
          season: "2025-26",
          seasonType: "Regular Season",
        },
      },
      create: stats,
      update: stats,
    });
  });
});

describe("upsertGameLogs", () => {
  it("upserts on the playerId+gameId unique key", async () => {
    const log: GameLogInput = {
      playerId: 201939,
      gameId: "0022500001",
      gameDate: new Date("2025-10-22T00:00:00Z"),
      season: "2025-26",
      seasonType: "Regular Season",
      teamId: 1610612744,
      teamAbbr: "GSW",
      matchup: "GSW vs. LAL",
      opponentAbbr: "LAL",
      homeAway: "home",
      winLoss: "W",
      minutes: 34,
      fgm: 10,
      fga: 20,
      fg3m: 5,
      fg3a: 11,
      ftm: 4,
      fta: 4,
      oreb: 1,
      dreb: 4,
      reb: 5,
      ast: 8,
      stl: 2,
      blk: 0,
      tov: 3,
      pts: 29,
      plusMinus: 12,
    };
    const count = await upsertGameLogs([log]);
    expect(count).toBe(1);
    expect(prisma.playerGameLog.upsert).toHaveBeenCalledWith({
      where: { playerId_gameId: { playerId: 201939, gameId: "0022500001" } },
      create: log,
      update: log,
    });
  });
});
```

- [ ] **Step 5: Create `src/lib/stats/parse.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { parseGameDate, parseMinutes } from "./parse";

describe("parseMinutes", () => {
  it("passes through numeric minutes", () => {
    expect(parseMinutes(34)).toBe(34);
  });

  it("parses mm:ss strings to decimal minutes", () => {
    expect(parseMinutes("34:30")).toBe(34.5);
  });

  it("parses plain numeric strings", () => {
    expect(parseMinutes("28")).toBe(28);
  });

  it("falls back to 0 for unparseable input", () => {
    expect(parseMinutes("")).toBe(0);
  });
});

describe("parseGameDate", () => {
  it("parses a date-only string as UTC midnight", () => {
    expect(parseGameDate("2025-10-22").toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("treats a tz-less datetime as UTC", () => {
    expect(parseGameDate("2025-10-22T00:00:00").toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("respects an explicit Z designator", () => {
    expect(parseGameDate("2025-10-22T12:00:00Z").toISOString()).toBe("2025-10-22T12:00:00.000Z");
  });
});
```

- [ ] **Step 6: Rewrite `src/lib/nba/transform.ts`** (drop the moved interfaces + helpers; import them)

```ts
import { GameLogInput, PlayerInput, SeasonStatsInput } from "@/lib/stats/inputs";
import { parseGameDate, parseMinutes } from "@/lib/stats/parse";

import { SEASON, SEASON_TYPE } from "./constants";
import { GameLogRow, PlayerIndexRow, SeasonStatsRow } from "./schemas";

const blankToNull = (value: string | null): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

export const parseMatchup = (
  matchup: string,
): { homeAway: "home" | "away"; opponentAbbr: string } => {
  const away = matchup.includes(" @ ");
  const separator = away ? " @ " : " vs. ";
  const opponentAbbr = matchup.split(separator)[1]?.trim() ?? "";
  return { homeAway: away ? "away" : "home", opponentAbbr };
};

export const toPlayerInput = (row: PlayerIndexRow): PlayerInput => ({
  id: row.PERSON_ID,
  firstName: row.PLAYER_FIRST_NAME,
  lastName: row.PLAYER_LAST_NAME,
  fullName: `${row.PLAYER_FIRST_NAME} ${row.PLAYER_LAST_NAME}`,
  teamId: row.TEAM_ID === 0 ? null : row.TEAM_ID,
  teamAbbr: blankToNull(row.TEAM_ABBREVIATION),
  position: blankToNull(row.POSITION),
  jerseyNumber: blankToNull(row.JERSEY_NUMBER),
});

export const toSeasonStatsInput = (row: SeasonStatsRow): SeasonStatsInput => ({
  playerId: row.PLAYER_ID,
  season: SEASON,
  seasonType: SEASON_TYPE,
  gamesPlayed: row.GP,
  minutes: row.MIN,
  fgm: row.FGM,
  fga: row.FGA,
  fg3m: row.FG3M,
  fg3a: row.FG3A,
  ftm: row.FTM,
  fta: row.FTA,
  oreb: row.OREB,
  dreb: row.DREB,
  reb: row.REB,
  ast: row.AST,
  stl: row.STL,
  blk: row.BLK,
  tov: row.TOV,
  pts: row.PTS,
});

export const toGameLogInput = (row: GameLogRow): GameLogInput => {
  const { homeAway, opponentAbbr } = parseMatchup(row.MATCHUP);
  return {
    playerId: row.PLAYER_ID,
    gameId: row.GAME_ID,
    gameDate: parseGameDate(row.GAME_DATE),
    season: SEASON,
    seasonType: SEASON_TYPE,
    teamId: row.TEAM_ID,
    teamAbbr: row.TEAM_ABBREVIATION,
    matchup: row.MATCHUP,
    opponentAbbr: blankToNull(opponentAbbr),
    homeAway,
    winLoss: row.WL,
    minutes: parseMinutes(row.MIN),
    fgm: row.FGM,
    fga: row.FGA,
    fg3m: row.FG3M,
    fg3a: row.FG3A,
    ftm: row.FTM,
    fta: row.FTA,
    oreb: row.OREB,
    dreb: row.DREB,
    reb: row.REB,
    ast: row.AST,
    stl: row.STL,
    blk: row.BLK,
    tov: row.TOV,
    pts: row.PTS,
    plusMinus: row.PLUS_MINUS,
  };
};
```

- [ ] **Step 7: Edit `src/lib/nba/transform.test.ts`** — delete the `parseMinutes` import and its `describe` block (it now lives in `stats/parse.test.ts`). Change the import block at the top from:

```ts
import {
  parseMatchup,
  parseMinutes,
  toGameLogInput,
  toPlayerInput,
  toSeasonStatsInput,
} from "./transform";
```

to:

```ts
import { parseMatchup, toGameLogInput, toPlayerInput, toSeasonStatsInput } from "./transform";
```

Then delete this entire block (lines that were the `parseMinutes` suite):

```ts
describe("parseMinutes", () => {
  it("passes through numeric minutes", () => {
    expect(parseMinutes(34)).toBe(34);
  });

  it("parses mm:ss strings to decimal minutes", () => {
    expect(parseMinutes("34:30")).toBe(34.5);
  });

  it("parses plain numeric strings", () => {
    expect(parseMinutes("28")).toBe(28);
  });

  it("falls back to 0 for unparseable input", () => {
    expect(parseMinutes("")).toBe(0);
  });
});
```

- [ ] **Step 8: Edit `src/lib/nba/sync.ts`** — repoint persistence + `SyncSummary` to the shared module and delete the local `SyncSummary`.

(a) Replace the single persist import line:

```ts
import { upsertGameLogs, upsertPlayers, upsertSeasonStats } from "./persist";
```

with (note it now also imports `SyncSummary` and uses the `@/lib/stats/persist` path; leave the existing `./constants`, `./endpoints`, and `./transform` import lines exactly as they are):

```ts
import { SyncSummary, upsertGameLogs, upsertPlayers, upsertSeasonStats } from "@/lib/stats/persist";
```

(b) Delete the now-duplicate local declaration (the interface `SyncSummary` block); `syncNba`'s return type `Promise<SyncSummary>` now resolves to the imported interface:

```ts
export interface SyncSummary {
  players: number;
  seasonStats: number;
  gameLogs: number;
}
```

- [ ] **Step 9: Edit `src/lib/nba/sync.test.ts`** — repoint the persist spy import (line 4) from:

```ts
import * as persist from "./persist";
```

to:

```ts
import * as persist from "@/lib/stats/persist";
```

- [ ] **Step 10: Delete the moved originals**

```bash
rm src/lib/nba/persist.ts src/lib/nba/persist.test.ts
```

- [ ] **Step 11: Run the full suite — expect all green**

Run: `bun run test`
Expected: PASS. Suites now include `src/lib/stats/parse.test.ts` and `src/lib/stats/persist.test.ts`; `src/lib/nba/persist.test.ts` is gone. `parseGameDate` gains 3 direct tests (net +3 vs. before).

- [ ] **Step 12: Run the full gate**

Run: `bun run system-check`
Expected: prettier:check, typecheck, lint (0 warnings), and vitest all pass.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "CV: extract source-agnostic write path into src/lib/stats

- Move persist.ts, the *Input shapes, and parseMinutes/parseGameDate out of nba/ into shared src/lib/stats/
- Share SyncSummary from stats/persist; re-point nba transform/sync + tests
- No behavior change; existing suite stays green with parseGameDate now directly tested"
```

---

### Task 2: Balldontlie constants + `getApiKey`

**Files:**

- Create: `src/lib/balldontlie/constants.ts`
- Test: `src/lib/balldontlie/constants.test.ts`

**Interfaces:**

- Produces: `BDL_BASE_URL`, `SEASON_YEAR`, `SEASON_LABEL`, `SEASON_TYPE`, `PER_PAGE` (all `string`), `THROTTLE_MS: number`, `getApiKey(): string`.

- [ ] **Step 1: Write the failing test — `src/lib/balldontlie/constants.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";

import { getApiKey } from "./constants";

const original = process.env.BALLDONTLIE_API_KEY;

afterEach(() => {
  if (original === undefined) {
    delete process.env.BALLDONTLIE_API_KEY;
  } else {
    process.env.BALLDONTLIE_API_KEY = original;
  }
});

describe("getApiKey", () => {
  it("returns the key when set", () => {
    process.env.BALLDONTLIE_API_KEY = "abc-123";
    expect(getApiKey()).toBe("abc-123");
  });

  it("throws a clear error when unset", () => {
    delete process.env.BALLDONTLIE_API_KEY;
    expect(() => getApiKey()).toThrow(/BALLDONTLIE_API_KEY/);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `bun run test src/lib/balldontlie/constants.test.ts`
Expected: FAIL — `Cannot find module './constants'`.

- [ ] **Step 3: Implement `src/lib/balldontlie/constants.ts`**

```ts
export const BDL_BASE_URL = "https://api.balldontlie.io/v1";

// Balldontlie's season param is the season's start year: 2025-26 → "2025".
export const SEASON_YEAR = "2025";
export const SEASON_LABEL = "2025-26";
export const SEASON_TYPE = "Regular Season";
export const PER_PAGE = "100";

// ALL-STAR tier allows 60 req/min; ~1.1s between pages keeps us safely under.
export const THROTTLE_MS = 1100;

export const getApiKey = (): string => {
  const key = process.env.BALLDONTLIE_API_KEY ?? "";
  if (key === "") {
    throw new Error("BALLDONTLIE_API_KEY is not set. Add it to .env (see .env.example).");
  }
  return key;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/lib/balldontlie/constants.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/balldontlie/constants.ts src/lib/balldontlie/constants.test.ts
git commit -m "CV: add Balldontlie constants + getApiKey"
```

---

### Task 3: Balldontlie HTTP client (`bdlFetch`)

Mirrors `nbaFetch`'s DI shape but adds the `Authorization` header, array-param
serialization (`seasons[]=2025`), and `Retry-After`-aware 429 handling.

**Files:**

- Create: `src/lib/balldontlie/client.ts`
- Test: `src/lib/balldontlie/client.test.ts`

**Interfaces:**

- Consumes: `BDL_BASE_URL`, `getApiKey` (from `./constants`).
- Produces: `type BdlParamValue = string | string[]`; `interface BdlFetchOptions { endpoint: string; params?: Record<string, BdlParamValue>; apiKey?: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; maxRetries?: number; timeoutMs?: number }`; `bdlFetch(options: BdlFetchOptions): Promise<unknown>`.

- [ ] **Step 1: Write the failing test — `src/lib/balldontlie/client.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";

import { bdlFetch } from "./client";

const jsonResponse = (
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.headers ?? { "content-type": "application/json" },
  });

describe("bdlFetch", () => {
  it("sends the api key header and serializes array params", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }));
    await bdlFetch({
      endpoint: "stats",
      params: { seasons: ["2025"], postseason: "false", per_page: "100" },
      apiKey: "test-key",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = fetchImpl.mock.lastCall?.[0]?.toString() ?? "";
    const init = fetchImpl.mock.lastCall?.[1] ?? {};
    expect(url).toContain("https://api.balldontlie.io/v1/stats?");
    expect(url).toContain("seasons[]=2025");
    expect(url).toContain("postseason=false");
    expect(init).toMatchObject({ headers: { Authorization: "test-key" } });
  });

  it("retries on 429 then resolves, sleeping between attempts", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ data: [1] }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const result = await bdlFetch({ endpoint: "teams", apiKey: "k", fetchImpl, sleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: [1] });
  });

  it("honors a Retry-After header on 429", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await bdlFetch({ endpoint: "teams", apiKey: "k", fetchImpl, sleep });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("retries on a network TypeError", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const result = await bdlFetch({ endpoint: "teams", apiKey: "k", fetchImpl, sleep });
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on 5xx", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, { status: 500 }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(
      bdlFetch({ endpoint: "teams", apiKey: "k", fetchImpl, sleep, maxRetries: 2 }),
    ).rejects.toThrow(/failed \(500\)/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `bun run test src/lib/balldontlie/client.test.ts`
Expected: FAIL — `Cannot find module './client'`.

- [ ] **Step 3: Implement `src/lib/balldontlie/client.ts`**

```ts
import { BDL_BASE_URL, getApiKey } from "./constants";

export type BdlParamValue = string | string[];

export interface BdlFetchOptions {
  endpoint: string;
  params?: Record<string, BdlParamValue>;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  timeoutMs?: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const backoffMs = (attemptNumber: number): number => 2 ** attemptNumber * 500;

const isRetryableError = (error: unknown): boolean =>
  error instanceof Error && (error.name === "AbortError" || error.name === "TypeError");

const buildQuery = (params: Record<string, BdlParamValue>): string =>
  Object.entries(params)
    .flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((entry) => `${encodeURIComponent(key)}[]=${encodeURIComponent(entry)}`)
        : [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`],
    )
    .join("&");

const retryAfterMs = (response: Response, fallback: number): number => {
  const header = response.headers.get("retry-after");
  const seconds = header === null ? Number.NaN : Number.parseInt(header, 10);
  return Number.isNaN(seconds) ? fallback : seconds * 1000;
};

export async function bdlFetch({
  endpoint,
  params = {},
  apiKey,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxRetries = 3,
  timeoutMs = 30000,
}: BdlFetchOptions): Promise<unknown> {
  const key = apiKey ?? getApiKey();
  const query = buildQuery(params);
  const url = query === "" ? `${BDL_BASE_URL}/${endpoint}` : `${BDL_BASE_URL}/${endpoint}?${query}`;

  const attempt = async (retriesLeft: number): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { Authorization: key },
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && retriesLeft > 0) {
          const fallback = backoffMs(maxRetries - retriesLeft);
          await sleep(response.status === 429 ? retryAfterMs(response, fallback) : fallback);
          return attempt(retriesLeft - 1);
        }
        throw new Error(`Balldontlie request failed (${response.status}) for ${endpoint}`);
      }
      return await response.json();
    } catch (error) {
      if (retriesLeft > 0 && isRetryableError(error)) {
        await sleep(backoffMs(maxRetries - retriesLeft));
        return attempt(retriesLeft - 1);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  return attempt(maxRetries);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/lib/balldontlie/client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/balldontlie/client.ts src/lib/balldontlie/client.test.ts
git commit -m "CV: add Balldontlie HTTP client with auth + retry/backoff"
```

---

### Task 4: Balldontlie zod schemas

**Files:**

- Create: `src/lib/balldontlie/schemas.ts`
- Test: `src/lib/balldontlie/schemas.test.ts`

**Interfaces:**

- Produces: `bdlTeamSchema`, `bdlStatSchema`, `bdlPage(item)`; types `BdlTeam = z.infer<typeof bdlTeamSchema>`, `BdlStat = z.infer<typeof bdlStatSchema>`. `BdlStat` has: `id, min (string|number|null), fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, turnover, pts (numbers), plus_minus (number|null), player {id, first_name, last_name, position?, jersey_number?, team_id?}, team {id, abbreviation}, game {id, date, season, home_team_id, visitor_team_id, home_team_score, visitor_team_score, postseason}`.

- [ ] **Step 1: Write the failing test — `src/lib/balldontlie/schemas.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { bdlPage, bdlStatSchema, bdlTeamSchema } from "./schemas";

const team = { id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks", extra: "ignored" };

const statRow = {
  id: 15531179,
  min: "30",
  fgm: 7,
  fga: 18,
  fg_pct: 0.389,
  fg3m: 5,
  fg3a: 9,
  ftm: 4,
  fta: 4,
  oreb: 2,
  dreb: 5,
  reb: 7,
  ast: 1,
  stl: 1,
  blk: 0,
  turnover: 1,
  pf: 3,
  pts: 23,
  plus_minus: 23,
  player: {
    id: 115,
    first_name: "Stephen",
    last_name: "Curry",
    position: "G",
    jersey_number: "30",
    team_id: 10,
  },
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 18422,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 10,
    visitor_team_id: 2,
    home_team_score: 112,
    visitor_team_score: 108,
    postseason: false,
  },
};

describe("bdlTeamSchema", () => {
  it("parses a team and strips unknown keys", () => {
    expect(bdlTeamSchema.parse(team)).toEqual({
      id: 1,
      abbreviation: "ATL",
      full_name: "Atlanta Hawks",
    });
  });
});

describe("bdlStatSchema", () => {
  it("parses a stat row with nested player/team/game", () => {
    const parsed = bdlStatSchema.parse(statRow);
    expect(parsed.player.id).toBe(115);
    expect(parsed.team.abbreviation).toBe("GSW");
    expect(parsed.game.home_team_id).toBe(10);
    expect(parsed.turnover).toBe(1);
    expect(parsed.plus_minus).toBe(23);
  });

  it("accepts null min and null plus_minus", () => {
    const parsed = bdlStatSchema.parse({ ...statRow, min: null, plus_minus: null });
    expect(parsed.min).toBeNull();
    expect(parsed.plus_minus).toBeNull();
  });

  it("rejects a row missing the game object", () => {
    const withoutGame = { ...statRow, game: undefined };
    expect(() => bdlStatSchema.parse(withoutGame)).toThrow();
  });
});

describe("bdlPage", () => {
  it("parses the paginated envelope with a next_cursor", () => {
    const page = bdlPage(bdlTeamSchema).parse({
      data: [team],
      meta: { next_cursor: 25, per_page: 25 },
    });
    expect(page.data).toHaveLength(1);
    expect(page.meta.next_cursor).toBe(25);
  });

  it("allows a missing next_cursor", () => {
    const page = bdlPage(bdlTeamSchema).parse({ data: [], meta: { per_page: 25 } });
    expect(page.meta.next_cursor ?? null).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `bun run test src/lib/balldontlie/schemas.test.ts`
Expected: FAIL — `Cannot find module './schemas'`.

- [ ] **Step 3: Implement `src/lib/balldontlie/schemas.ts`**

```ts
import { z } from "zod";

export const bdlTeamSchema = z.object({
  id: z.number(),
  abbreviation: z.string(),
  full_name: z.string(),
});

export type BdlTeam = z.infer<typeof bdlTeamSchema>;

const bdlNestedPlayerSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  position: z.string().nullable().optional(),
  jersey_number: z.string().nullable().optional(),
  team_id: z.number().nullable().optional(),
});

const bdlNestedTeamSchema = z.object({
  id: z.number(),
  abbreviation: z.string(),
});

const bdlGameSchema = z.object({
  id: z.number(),
  date: z.string(),
  season: z.number(),
  home_team_id: z.number(),
  visitor_team_id: z.number(),
  home_team_score: z.number(),
  visitor_team_score: z.number(),
  postseason: z.boolean(),
});

export const bdlStatSchema = z.object({
  id: z.number(),
  min: z.union([z.string(), z.number()]).nullable(),
  fgm: z.number(),
  fga: z.number(),
  fg3m: z.number(),
  fg3a: z.number(),
  ftm: z.number(),
  fta: z.number(),
  oreb: z.number(),
  dreb: z.number(),
  reb: z.number(),
  ast: z.number(),
  stl: z.number(),
  blk: z.number(),
  turnover: z.number(),
  pts: z.number(),
  plus_minus: z.number().nullable().optional(),
  player: bdlNestedPlayerSchema,
  team: bdlNestedTeamSchema,
  game: bdlGameSchema,
});

export type BdlStat = z.infer<typeof bdlStatSchema>;

export const bdlPage = <T>(item: z.ZodType<T>) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      next_cursor: z.number().nullable().optional(),
      per_page: z.number().optional(),
    }),
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/lib/balldontlie/schemas.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/balldontlie/schemas.ts src/lib/balldontlie/schemas.test.ts
git commit -m "CV: add Balldontlie zod schemas (teams, stats, paginated envelope)"
```

---

### Task 5: Balldontlie endpoints (`fetchTeams`, `fetchAllStats`)

**Files:**

- Create: `src/lib/balldontlie/endpoints.ts`
- Test: `src/lib/balldontlie/endpoints.test.ts`

**Interfaces:**

- Consumes: `bdlFetch` (`./client`); `PER_PAGE`, `SEASON_YEAR`, `THROTTLE_MS` (`./constants`); `bdlPage`, `bdlStatSchema`, `bdlTeamSchema`, `BdlStat`, `BdlTeam` (`./schemas`).
- Produces: `interface BdlClientDeps { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; apiKey?: string }`; `fetchTeams(deps?: BdlClientDeps): Promise<BdlTeam[]>`; `fetchAllStats(deps?: BdlClientDeps): Promise<BdlStat[]>`.

- [ ] **Step 1: Write the failing test — `src/lib/balldontlie/endpoints.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";

import { fetchAllStats, fetchTeams } from "./endpoints";

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const statRow = (id: number, playerId: number) => ({
  id,
  min: "30",
  fgm: 7,
  fga: 18,
  fg3m: 5,
  fg3a: 9,
  ftm: 4,
  fta: 4,
  oreb: 2,
  dreb: 5,
  reb: 7,
  ast: 1,
  stl: 1,
  blk: 0,
  turnover: 1,
  pts: 23,
  plus_minus: 3,
  player: { id: playerId, first_name: "Test", last_name: "Player", team_id: 10 },
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 900 + id,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 10,
    visitor_team_id: 2,
    home_team_score: 112,
    visitor_team_score: 108,
    postseason: false,
  },
});

describe("fetchTeams", () => {
  it("returns the parsed teams array", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks" }],
        meta: {},
      }),
    );
    const teams = await fetchTeams({ apiKey: "k", fetchImpl });
    expect(teams).toEqual([{ id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks" }]);
    expect(fetchImpl.mock.calls[0]?.[0]?.toString() ?? "").toContain("/teams");
  });
});

describe("fetchAllStats", () => {
  it("follows the cursor across pages, throttles, and concatenates", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [statRow(1, 10)], meta: { next_cursor: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ data: [statRow(2, 11)], meta: {} }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    const stats = await fetchAllStats({ apiKey: "k", fetchImpl, sleep });

    expect(stats).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    const firstUrl = fetchImpl.mock.calls[0]?.[0]?.toString() ?? "";
    const secondUrl = fetchImpl.mock.calls[1]?.[0]?.toString() ?? "";
    expect(firstUrl).toContain("seasons[]=2025");
    expect(firstUrl).toContain("postseason=false");
    expect(firstUrl).not.toContain("cursor=");
    expect(secondUrl).toContain("cursor=2");
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `bun run test src/lib/balldontlie/endpoints.test.ts`
Expected: FAIL — `Cannot find module './endpoints'`.

- [ ] **Step 3: Implement `src/lib/balldontlie/endpoints.ts`**

```ts
import { bdlFetch, BdlParamValue } from "./client";
import { PER_PAGE, SEASON_YEAR, THROTTLE_MS } from "./constants";
import { BdlStat, BdlTeam, bdlPage, bdlStatSchema, bdlTeamSchema } from "./schemas";

export interface BdlClientDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  apiKey?: string;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const fetchTeams = async (deps: BdlClientDeps = {}): Promise<BdlTeam[]> => {
  const raw = await bdlFetch({
    endpoint: "teams",
    apiKey: deps.apiKey,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });
  return bdlPage(bdlTeamSchema).parse(raw).data;
};

export const fetchAllStats = async (deps: BdlClientDeps = {}): Promise<BdlStat[]> => {
  const sleep = deps.sleep ?? defaultSleep;
  const pageSchema = bdlPage(bdlStatSchema);

  const loadPage = async (cursor: number | null, acc: BdlStat[]): Promise<BdlStat[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint: "stats",
      params: {
        seasons: [SEASON_YEAR],
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
    await sleep(THROTTLE_MS);
    return loadPage(next, combined);
  };

  return loadPage(null, []);
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/lib/balldontlie/endpoints.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/balldontlie/endpoints.ts src/lib/balldontlie/endpoints.test.ts
git commit -m "CV: add Balldontlie endpoints (fetchTeams + cursor-paginated fetchAllStats)"
```

---

### Task 6: Balldontlie transforms

Map the `/v1/stats` stream to the shared `*Input` shapes: dedupe players, derive
each game log's home/away, opponent, matchup and win/loss, and aggregate season
totals in memory.

**Files:**

- Create: `src/lib/balldontlie/transform.ts`
- Test: `src/lib/balldontlie/transform.test.ts`

**Interfaces:**

- Consumes: `parseGameDate`, `parseMinutes` (`@/lib/stats/parse`); `GameLogInput`, `PlayerInput`, `SeasonStatsInput` (`@/lib/stats/inputs`); `SEASON_LABEL`, `SEASON_TYPE` (`./constants`); `BdlStat` (`./schemas`).
- Produces: `toPlayerInputs(stats: BdlStat[], teamAbbrById: Map<number, string>): PlayerInput[]`; `toGameLogInput(args: { stat: BdlStat; teamAbbrById: Map<number, string> }): GameLogInput`; `aggregateSeasonStats(logs: GameLogInput[]): SeasonStatsInput[]`.

- [ ] **Step 1: Write the failing test — `src/lib/balldontlie/transform.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { GameLogInput } from "@/lib/stats/inputs";

import { aggregateSeasonStats, toGameLogInput, toPlayerInputs } from "./transform";
import { BdlStat } from "./schemas";

const teamAbbrById = new Map<number, string>([
  [10, "GSW"],
  [2, "BOS"],
]);

const homeStat: BdlStat = {
  id: 1,
  min: "34",
  fgm: 10,
  fga: 20,
  fg3m: 5,
  fg3a: 11,
  ftm: 4,
  fta: 4,
  oreb: 1,
  dreb: 4,
  reb: 5,
  ast: 8,
  stl: 2,
  blk: 0,
  turnover: 3,
  pts: 29,
  plus_minus: 12,
  player: {
    id: 115,
    first_name: "Stephen",
    last_name: "Curry",
    position: "G",
    jersey_number: "30",
    team_id: 10,
  },
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 18422,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 10,
    visitor_team_id: 2,
    home_team_score: 112,
    visitor_team_score: 108,
    postseason: false,
  },
};

// Player's team (10) is the visitor and loses → away loss.
const awayStat: BdlStat = {
  ...homeStat,
  id: 2,
  pts: 20,
  plus_minus: -5,
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 18500,
    date: "2025-10-24",
    season: 2025,
    home_team_id: 2,
    visitor_team_id: 10,
    home_team_score: 101,
    visitor_team_score: 99,
    postseason: false,
  },
};

describe("toPlayerInputs", () => {
  it("dedupes players by id and resolves team abbreviation", () => {
    const players = toPlayerInputs([homeStat, { ...homeStat, id: 99 }], teamAbbrById);
    expect(players).toHaveLength(1);
    expect(players[0]).toEqual({
      id: 115,
      firstName: "Stephen",
      lastName: "Curry",
      fullName: "Stephen Curry",
      teamId: 10,
      teamAbbr: "GSW",
      position: "G",
      jerseyNumber: "30",
    });
  });

  it("nulls a missing team and blank identity strings", () => {
    const orphan: BdlStat = {
      ...homeStat,
      player: { id: 7, first_name: "Free", last_name: "Agent", position: "", jersey_number: null },
    };
    const [player] = toPlayerInputs([orphan], teamAbbrById);
    expect(player.teamId).toBeNull();
    expect(player.teamAbbr).toBeNull();
    expect(player.position).toBeNull();
    expect(player.jerseyNumber).toBeNull();
  });
});

describe("toGameLogInput", () => {
  it("derives a home win", () => {
    const log = toGameLogInput({ stat: homeStat, teamAbbrById });
    expect(log).toMatchObject({
      playerId: 115,
      gameId: "18422",
      season: "2025-26",
      seasonType: "Regular Season",
      teamId: 10,
      teamAbbr: "GSW",
      opponentAbbr: "BOS",
      matchup: "GSW vs. BOS",
      homeAway: "home",
      winLoss: "W",
      minutes: 34,
      tov: 3,
      pts: 29,
      plusMinus: 12,
    });
    expect(log.gameDate.toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("derives an away loss", () => {
    const log = toGameLogInput({ stat: awayStat, teamAbbrById });
    expect(log.homeAway).toBe("away");
    expect(log.opponentAbbr).toBe("BOS");
    expect(log.matchup).toBe("GSW @ BOS");
    expect(log.winLoss).toBe("L");
  });
});

describe("aggregateSeasonStats", () => {
  it("sums counting stats and counts games played per player", () => {
    const logs: GameLogInput[] = [homeStat, awayStat].map((stat) =>
      toGameLogInput({ stat, teamAbbrById }),
    );
    const [season] = aggregateSeasonStats(logs);
    expect(season).toMatchObject({
      playerId: 115,
      season: "2025-26",
      seasonType: "Regular Season",
      gamesPlayed: 2,
      pts: 49,
      tov: 6,
      minutes: 68,
    });
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `bun run test src/lib/balldontlie/transform.test.ts`
Expected: FAIL — `Cannot find module './transform'`.

- [ ] **Step 3: Implement `src/lib/balldontlie/transform.ts`**

```ts
import { GameLogInput, PlayerInput, SeasonStatsInput } from "@/lib/stats/inputs";
import { parseGameDate, parseMinutes } from "@/lib/stats/parse";

import { SEASON_LABEL, SEASON_TYPE } from "./constants";
import { BdlStat } from "./schemas";

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

export const toPlayerInputs = (
  stats: BdlStat[],
  teamAbbrById: Map<number, string>,
): PlayerInput[] => {
  const byId = stats.reduce((acc, stat) => {
    const player = stat.player;
    const rawTeamId = player.team_id ?? null;
    const teamId = rawTeamId === 0 ? null : rawTeamId;
    acc.set(player.id, {
      id: player.id,
      firstName: player.first_name,
      lastName: player.last_name,
      fullName: `${player.first_name} ${player.last_name}`,
      teamId,
      teamAbbr: teamId === null ? null : (teamAbbrById.get(teamId) ?? null),
      position: blankToNull(player.position),
      jerseyNumber: blankToNull(player.jersey_number),
    });
    return acc;
  }, new Map<number, PlayerInput>());
  return Array.from(byId.values());
};

export const toGameLogInput = (args: {
  stat: BdlStat;
  teamAbbrById: Map<number, string>;
}): GameLogInput => {
  const { stat, teamAbbrById } = args;
  const { game, team } = stat;
  const homeAway = team.id === game.home_team_id ? "home" : "away";
  const opponentTeamId = homeAway === "home" ? game.visitor_team_id : game.home_team_id;
  const opponentAbbr = teamAbbrById.get(opponentTeamId) ?? null;
  const playerScore = homeAway === "home" ? game.home_team_score : game.visitor_team_score;
  const opponentScore = homeAway === "home" ? game.visitor_team_score : game.home_team_score;
  const winLoss = playerScore > opponentScore ? "W" : playerScore < opponentScore ? "L" : null;
  const separator = homeAway === "away" ? "@" : "vs.";
  const matchup = `${team.abbreviation} ${separator} ${opponentAbbr ?? ""}`.trim();

  return {
    playerId: stat.player.id,
    gameId: String(game.id),
    gameDate: parseGameDate(game.date),
    season: SEASON_LABEL,
    seasonType: SEASON_TYPE,
    teamId: team.id,
    teamAbbr: team.abbreviation,
    matchup,
    opponentAbbr,
    homeAway,
    winLoss,
    minutes: parseMinutes(stat.min ?? 0),
    fgm: stat.fgm,
    fga: stat.fga,
    fg3m: stat.fg3m,
    fg3a: stat.fg3a,
    ftm: stat.ftm,
    fta: stat.fta,
    oreb: stat.oreb,
    dreb: stat.dreb,
    reb: stat.reb,
    ast: stat.ast,
    stl: stat.stl,
    blk: stat.blk,
    tov: stat.turnover,
    pts: stat.pts,
    plusMinus: stat.plus_minus ?? null,
  };
};

export const aggregateSeasonStats = (logs: GameLogInput[]): SeasonStatsInput[] => {
  const byPlayer = logs.reduce((acc, log) => {
    const current = acc.get(log.playerId) ?? {
      playerId: log.playerId,
      season: SEASON_LABEL,
      seasonType: SEASON_TYPE,
      gamesPlayed: 0,
      minutes: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      oreb: 0,
      dreb: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pts: 0,
    };
    acc.set(log.playerId, {
      ...current,
      gamesPlayed: current.gamesPlayed + 1,
      minutes: current.minutes + log.minutes,
      fgm: current.fgm + log.fgm,
      fga: current.fga + log.fga,
      fg3m: current.fg3m + log.fg3m,
      fg3a: current.fg3a + log.fg3a,
      ftm: current.ftm + log.ftm,
      fta: current.fta + log.fta,
      oreb: current.oreb + log.oreb,
      dreb: current.dreb + log.dreb,
      reb: current.reb + log.reb,
      ast: current.ast + log.ast,
      stl: current.stl + log.stl,
      blk: current.blk + log.blk,
      tov: current.tov + log.tov,
      pts: current.pts + log.pts,
    });
    return acc;
  }, new Map<number, SeasonStatsInput>());
  return Array.from(byPlayer.values());
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/lib/balldontlie/transform.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/balldontlie/transform.ts src/lib/balldontlie/transform.test.ts
git commit -m "CV: add Balldontlie transforms (players, game logs, season aggregation)"
```

---

### Task 7: Balldontlie sync orchestration + `sync:bdl` script + `.env.example`

**Files:**

- Create: `src/lib/balldontlie/sync.ts`
- Test: `src/lib/balldontlie/sync.test.ts`
- Modify: `package.json` (add `sync:bdl` script)
- Modify: `.env.example` (document `BALLDONTLIE_API_KEY`)

**Interfaces:**

- Consumes: `SyncSummary`, `upsertGameLogs`, `upsertPlayers`, `upsertSeasonStats` (`@/lib/stats/persist`); `BdlClientDeps`, `fetchAllStats`, `fetchTeams` (`./endpoints`); `aggregateSeasonStats`, `toGameLogInput`, `toPlayerInputs` (`./transform`).
- Produces: `syncBalldontlie(deps?: BdlClientDeps): Promise<SyncSummary>`.

- [ ] **Step 1: Write the failing test — `src/lib/balldontlie/sync.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";

import * as persist from "@/lib/stats/persist";

import * as endpoints from "./endpoints";
import { BdlStat } from "./schemas";
import { syncBalldontlie } from "./sync";

const statRow: BdlStat = {
  id: 1,
  min: "34",
  fgm: 10,
  fga: 20,
  fg3m: 5,
  fg3a: 11,
  ftm: 4,
  fta: 4,
  oreb: 1,
  dreb: 4,
  reb: 5,
  ast: 8,
  stl: 2,
  blk: 0,
  turnover: 3,
  pts: 29,
  plus_minus: 12,
  player: {
    id: 115,
    first_name: "Stephen",
    last_name: "Curry",
    position: "G",
    jersey_number: "30",
    team_id: 10,
  },
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 18422,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 10,
    visitor_team_id: 2,
    home_team_score: 112,
    visitor_team_score: 108,
    postseason: false,
  },
};

describe("syncBalldontlie", () => {
  it("fetches, transforms, persists, and returns counts", async () => {
    vi.spyOn(endpoints, "fetchTeams").mockResolvedValue([
      { id: 10, abbreviation: "GSW", full_name: "Golden State Warriors" },
      { id: 2, abbreviation: "BOS", full_name: "Boston Celtics" },
    ]);
    vi.spyOn(endpoints, "fetchAllStats").mockResolvedValue([statRow]);
    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    const upsertGameLogs = vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(1);
    const upsertSeasonStats = vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(1);

    const summary = await syncBalldontlie({ apiKey: "k" });

    expect(summary).toEqual({ players: 1, seasonStats: 1, gameLogs: 1 });
    expect(upsertPlayers).toHaveBeenCalledWith([
      expect.objectContaining({ id: 115, teamAbbr: "GSW" }),
    ]);
    expect(upsertGameLogs).toHaveBeenCalledWith([
      expect.objectContaining({ gameId: "18422", opponentAbbr: "BOS", homeAway: "home" }),
    ]);
    expect(upsertSeasonStats).toHaveBeenCalledWith([
      expect.objectContaining({ playerId: 115, gamesPlayed: 1, pts: 29 }),
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `bun run test src/lib/balldontlie/sync.test.ts`
Expected: FAIL — `Cannot find module './sync'`.

- [ ] **Step 3: Implement `src/lib/balldontlie/sync.ts`**

```ts
import { SyncSummary, upsertGameLogs, upsertPlayers, upsertSeasonStats } from "@/lib/stats/persist";

import { BdlClientDeps, fetchAllStats, fetchTeams } from "./endpoints";
import { aggregateSeasonStats, toGameLogInput, toPlayerInputs } from "./transform";

// Bun sets `import.meta.main` on the entry module. @types/node's ImportMeta
// doesn't declare it, so augment the global interface (declaration merging,
// same pattern as src/lib/prisma.ts) rather than adding bun-types or casting.
declare global {
  interface ImportMeta {
    readonly main: boolean;
  }
}

export async function syncBalldontlie(deps: BdlClientDeps = {}): Promise<SyncSummary> {
  const teams = await fetchTeams(deps);
  const teamAbbrById = teams.reduce(
    (map, team) => map.set(team.id, team.abbreviation),
    new Map<number, string>(),
  );

  const stats = await fetchAllStats(deps);

  const players = await upsertPlayers(toPlayerInputs(stats, teamAbbrById));

  const gameLogInputs = stats.map((stat) => toGameLogInput({ stat, teamAbbrById }));
  const gameLogs = await upsertGameLogs(gameLogInputs);

  const seasonStats = await upsertSeasonStats(aggregateSeasonStats(gameLogInputs));

  return { players, seasonStats, gameLogs };
}

if (import.meta.main) {
  syncBalldontlie()
    .then((summary) => {
      console.log(
        `Balldontlie sync complete: ${summary.players} players, ${summary.seasonStats} season rows, ${summary.gameLogs} game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Balldontlie sync failed:", error);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/lib/balldontlie/sync.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Add the `sync:bdl` script to `package.json`**

Insert the new script immediately after the existing `"sync:nba"` line so the block reads:

```json
    "sync:nba": "bun run src/lib/nba/sync.ts",
    "sync:bdl": "bun run src/lib/balldontlie/sync.ts",
```

- [ ] **Step 6: Document the key in `.env.example`**

Append to `.env.example`:

```
# Balldontlie API key — required by `bun run sync:bdl`.
# Get one at https://www.balldontlie.io/. Per-game stats need the ALL-STAR tier;
# the free tier has no /v1/stats access.
BALLDONTLIE_API_KEY="YOUR_BALLDONTLIE_API_KEY"
```

- [ ] **Step 7: Run the full gate**

Run: `bun run system-check`
Expected: prettier:check, typecheck, lint (0 warnings), and vitest all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/balldontlie/sync.ts src/lib/balldontlie/sync.test.ts package.json .env.example
git commit -m "CV: add Balldontlie sync orchestration + sync:bdl script

- syncBalldontlie fetches teams + full stats stream, derives players/game logs/season totals, upserts via shared stats/persist
- Add sync:bdl script and document BALLDONTLIE_API_KEY in .env.example"
```

---

## Deferred: live backfill run

Not part of this plan's automated deliverable (the provided key is Free tier). Once
`BALLDONTLIE_API_KEY` has ALL-STAR access, run the live backfill and verify per the
spec §10:

1. Confirm `/v1/stats` returns 200 with the key.
2. **Validate `bdlStatSchema` against the live payload** and fix any field drift
   (the one best-effort area — spec §3.2/§11).
3. `bun run sync:bdl`.
4. Verify row counts (`Player` ~500+, `PlayerGameLog` ~30k, `PlayerSeasonStats` =
   distinct players) and spot-check one known player's season totals.
