# NBA Player Stats Fetch Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch 2025–26 Regular Season NBA player stats (identity, season aggregates, per-game logs) from `stats.nba.com`, validate them with zod, and persist them via Prisma — code-only, verified by mocked-response unit tests, no live DB run.

**Architecture:** A `src/lib/nba/` module pipeline — `client` (HTTP + retry) → `parse` (column→object) → `schemas` (zod validation) → `endpoints` (3 typed league-wide calls) → `transform` (raw rows → Prisma inputs) → `persist` (idempotent upserts) → `sync` (orchestration, Bun-run). Three Prisma models (`Player`, `PlayerSeasonStats`, `PlayerGameLog`) store raw counting components; percentages are derived later.

**Tech Stack:** TypeScript (strict, no `any`/casts), zod 4.4.3, Prisma 7 (postgres), Vitest 4 (mocked `fetch` + mocked Prisma client), Bun.

**Spec:** `docs/superpowers/specs/2026-06-12-nba-player-stats-fetch-design.md`

---

## Conventions for every task

- **TDD:** write the failing test first, run it red, implement minimal code, run it green, commit.
- **Run tests:** `bun run test` (single file: `bun run test src/lib/nba/<file>.test.ts`).
- **No `any`, no casts** (CLAUDE.md). Untrusted JSON enters as `unknown` and is narrowed by zod.
- **Arrays:** use `map`/`reduce` — no `for`/`for..of`/`for..in` loops.
- **Optional chaining** always paired with `??`. Boolean coercion via `!!`.
- **Commits:** subject starts with `CV:`. Commit after each task. The pre-commit hook runs lint-staged + typecheck + test; let it run.

## File map (created in this plan)

| File                                                  | Responsibility                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `prisma/schema.prisma` (modify)                       | Add `Player`, `PlayerSeasonStats`, `PlayerGameLog` models                  |
| `prisma/migrations/20260612000000_init/migration.sql` | Initial migration SQL (generated, **not applied**)                         |
| `prisma/migrations/migration_lock.toml`               | Prisma migration provider lock                                             |
| `src/lib/nba/constants.ts`                            | Season/league constants, base URL, headers, result-set names, month ranges |
| `src/lib/nba/parse.ts` (+`.test.ts`)                  | Validate NBA envelope; zip headers→rows; select a result set               |
| `src/lib/nba/schemas.ts` (+`.test.ts`)                | zod schemas + inferred row types                                           |
| `src/lib/nba/client.ts` (+`.test.ts`)                 | `nbaFetch`: headers, timeout, retry/backoff (DI for fetch+sleep)           |
| `src/lib/nba/endpoints.ts` (+`.test.ts`)              | `fetchPlayerIndex`, `fetchSeasonStats`, `fetchPlayerGameLogs`              |
| `src/lib/nba/transform.ts` (+`.test.ts`)              | Raw rows → Prisma input shapes; matchup/minutes/date parsing               |
| `src/lib/nba/persist.ts` (+`.test.ts`)                | Idempotent upserts (Prisma client mocked in tests)                         |
| `src/lib/nba/sync.ts` (+`.test.ts`)                   | Orchestration + `import.meta.main` CLI guard                               |
| `package.json` (modify)                               | Add `zod` dep (exact) + `sync:nba` script                                  |

---

## Task 1: Dependency, Prisma models, generated client, migration

**Files:**

- Modify: `package.json` (add `zod` to `dependencies`)
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/migration_lock.toml`
- Create: `prisma/migrations/20260612000000_init/migration.sql`

- [ ] **Step 1: Add zod (exact-pinned)**

Run: `bun add zod@4.4.3`

Verify `package.json` shows `"zod": "4.4.3"` under `dependencies` with no `^`/`~`.

- [ ] **Step 2: Add the three models to `prisma/schema.prisma`**

Append below the existing `datasource db { ... }` block (keep the generator/datasource as-is):

```prisma
model Player {
  id           Int      @id
  firstName    String
  lastName     String
  fullName     String
  teamId       Int?
  teamAbbr     String?
  position     String?
  jerseyNumber String?
  seasonStats  PlayerSeasonStats[]
  gameLogs     PlayerGameLog[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model PlayerSeasonStats {
  id          String   @id @default(cuid())
  player      Player   @relation(fields: [playerId], references: [id])
  playerId    Int
  season      String
  seasonType  String
  gamesPlayed Int
  minutes     Float
  fgm         Int
  fga         Int
  fg3m        Int
  fg3a        Int
  ftm         Int
  fta         Int
  oreb        Int
  dreb        Int
  reb         Int
  ast         Int
  stl         Int
  blk         Int
  tov         Int
  pts         Int
  updatedAt   DateTime @updatedAt

  @@unique([playerId, season, seasonType])
}

model PlayerGameLog {
  id           String   @id @default(cuid())
  player       Player   @relation(fields: [playerId], references: [id])
  playerId     Int
  gameId       String
  gameDate     DateTime
  season       String
  seasonType   String
  teamId       Int
  teamAbbr     String
  matchup      String
  opponentAbbr String?
  homeAway     String
  winLoss      String?
  minutes      Float
  fgm          Int
  fga          Int
  fg3m         Int
  fg3a         Int
  ftm          Int
  fta          Int
  oreb         Int
  dreb         Int
  reb          Int
  ast          Int
  stl          Int
  blk          Int
  tov          Int
  pts          Int
  plusMinus    Int?

  @@unique([playerId, gameId])
  @@index([gameDate])
  @@index([playerId, gameDate])
}
```

- [ ] **Step 3: Regenerate the Prisma client (no DB needed)**

Run: `bun run db:generate`
Expected: succeeds; `generated/prisma/models.ts` now references `Player`, `PlayerSeasonStats`, `PlayerGameLog`.

- [ ] **Step 4: Generate the initial migration SQL (no DB)**

Run:

```bash
mkdir -p prisma/migrations/20260612000000_init
printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml
bunx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/20260612000000_init/migration.sql
```

Expected: `migration.sql` contains `CREATE TABLE "Player" ...`, `CREATE TABLE "PlayerSeasonStats" ...`, `CREATE TABLE "PlayerGameLog" ...` plus the unique/index statements. **Do not run `migrate deploy`/`migrate dev`.** (`.prettierignore` already excludes `prisma/migrations/`.)

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS (the generated client compiles).

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock prisma/schema.prisma prisma/migrations
git commit -m "CV: add NBA player stat Prisma models + zod dep"
```

---

## Task 2: Constants

**Files:**

- Create: `src/lib/nba/constants.ts`

No test (constant declarations only; they are exercised by later tests).

- [ ] **Step 1: Write `src/lib/nba/constants.ts`**

```typescript
export const NBA_BASE_URL = "https://stats.nba.com/stats";
export const SEASON = "2025-26";
export const SEASON_TYPE = "Regular Season";
export const LEAGUE_ID = "00";

export const NBA_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
  Connection: "keep-alive",
};

export const RESULT_SET_NAMES = {
  playerIndex: "PlayerIndex",
  seasonStats: "LeagueDashPlayerStats",
  gameLogs: "PlayerGameLogs",
} as const;

// 2025–26 regular season spans Oct 2025 → Apr 2026. The game-log endpoint is
// chunked by month (NBA DateFrom/DateTo format is MM/DD/YYYY) for resilience.
export const REGULAR_SEASON_DATE_RANGES: ReadonlyArray<{ dateFrom: string; dateTo: string }> = [
  { dateFrom: "10/01/2025", dateTo: "10/31/2025" },
  { dateFrom: "11/01/2025", dateTo: "11/30/2025" },
  { dateFrom: "12/01/2025", dateTo: "12/31/2025" },
  { dateFrom: "01/01/2026", dateTo: "01/31/2026" },
  { dateFrom: "02/01/2026", dateTo: "02/28/2026" },
  { dateFrom: "03/01/2026", dateTo: "03/31/2026" },
  { dateFrom: "04/01/2026", dateTo: "04/30/2026" },
];
```

- [ ] **Step 2: Typecheck + commit**

```bash
bun run typecheck
git add src/lib/nba/constants.ts
git commit -m "CV: add NBA fetch constants"
```

---

## Task 3: Parse (envelope validation + column→object)

**Files:**

- Create: `src/lib/nba/parse.ts`
- Test: `src/lib/nba/parse.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";

import { parseNbaResponse, rowsToObjects, selectResultSet } from "./parse";

const sample = {
  resource: "playerindex",
  parameters: {},
  resultSets: [
    {
      name: "PlayerIndex",
      headers: ["PERSON_ID", "PLAYER_LAST_NAME"],
      rowSet: [
        [1629029, "Doncic"],
        [201939, "Curry"],
      ],
    },
  ],
};

describe("parseNbaResponse", () => {
  it("accepts a valid NBA envelope", () => {
    const parsed = parseNbaResponse(sample);
    expect(parsed.resultSets[0].name).toBe("PlayerIndex");
  });

  it("rejects a malformed envelope", () => {
    expect(() => parseNbaResponse({ nope: true })).toThrow();
  });
});

describe("selectResultSet", () => {
  it("returns the result set matching the name", () => {
    const parsed = parseNbaResponse(sample);
    expect(selectResultSet(parsed, "PlayerIndex").rowSet).toHaveLength(2);
  });

  it("throws when the named result set is absent", () => {
    const parsed = parseNbaResponse(sample);
    expect(() => selectResultSet(parsed, "Missing")).toThrow(/Missing/);
  });
});

describe("rowsToObjects", () => {
  it("zips headers onto each row", () => {
    const parsed = parseNbaResponse(sample);
    const objects = rowsToObjects(selectResultSet(parsed, "PlayerIndex"));
    expect(objects).toEqual([
      { PERSON_ID: 1629029, PLAYER_LAST_NAME: "Doncic" },
      { PERSON_ID: 201939, PLAYER_LAST_NAME: "Curry" },
    ]);
  });

  it("returns an empty array for an empty rowSet", () => {
    expect(rowsToObjects({ name: "x", headers: ["A"], rowSet: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/nba/parse.test.ts`
Expected: FAIL (module `./parse` not found).

- [ ] **Step 3: Write `src/lib/nba/parse.ts`**

```typescript
import { z } from "zod";

const nbaResultSetSchema = z.object({
  name: z.string(),
  headers: z.array(z.string()),
  rowSet: z.array(z.array(z.unknown())),
});

const nbaResponseSchema = z.object({
  resultSets: z.array(nbaResultSetSchema),
});

export type NbaResultSet = z.infer<typeof nbaResultSetSchema>;
export type NbaResponse = z.infer<typeof nbaResponseSchema>;

export function parseNbaResponse(raw: unknown): NbaResponse {
  return nbaResponseSchema.parse(raw);
}

export function selectResultSet(response: NbaResponse, name: string): NbaResultSet {
  const match = response.resultSets.find((set) => set.name === name);
  if (!match) {
    throw new Error(`NBA result set not found: ${name}`);
  }
  return match;
}

export function rowsToObjects(resultSet: NbaResultSet): Record<string, unknown>[] {
  return resultSet.rowSet.map((row) =>
    Object.fromEntries(resultSet.headers.map((header, index) => [header, row[index]])),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/nba/parse.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nba/parse.ts src/lib/nba/parse.test.ts
git commit -m "CV: add NBA response parser"
```

---

## Task 4: Schemas (zod row schemas + inferred types)

**Files:**

- Create: `src/lib/nba/schemas.ts`
- Test: `src/lib/nba/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";

import { gameLogRowSchema, playerIndexRowSchema, seasonStatsRowSchema } from "./schemas";

describe("playerIndexRowSchema", () => {
  it("parses a valid identity row", () => {
    const row = playerIndexRowSchema.parse({
      PERSON_ID: 1629029,
      PLAYER_FIRST_NAME: "Luka",
      PLAYER_LAST_NAME: "Doncic",
      TEAM_ID: 1610612747,
      TEAM_ABBREVIATION: "LAL",
      POSITION: "G-F",
      JERSEY_NUMBER: "77",
    });
    expect(row.PERSON_ID).toBe(1629029);
  });

  it("allows null team/jersey for free agents", () => {
    const row = playerIndexRowSchema.parse({
      PERSON_ID: 1,
      PLAYER_FIRST_NAME: "Free",
      PLAYER_LAST_NAME: "Agent",
      TEAM_ID: 0,
      TEAM_ABBREVIATION: null,
      POSITION: "",
      JERSEY_NUMBER: null,
    });
    expect(row.TEAM_ABBREVIATION).toBeNull();
  });

  it("rejects a row missing PERSON_ID", () => {
    expect(() => playerIndexRowSchema.parse({ PLAYER_FIRST_NAME: "x" })).toThrow();
  });
});

describe("seasonStatsRowSchema", () => {
  it("parses a totals row", () => {
    const row = seasonStatsRowSchema.parse({
      PLAYER_ID: 201939,
      GP: 70,
      MIN: 2400,
      FGM: 600,
      FGA: 1200,
      FG3M: 300,
      FG3A: 700,
      FTM: 200,
      FTA: 220,
      OREB: 50,
      DREB: 300,
      REB: 350,
      AST: 450,
      STL: 90,
      BLK: 20,
      TOV: 200,
      PTS: 1700,
    });
    expect(row.PTS).toBe(1700);
  });
});

describe("gameLogRowSchema", () => {
  it("parses a game-log row with numeric minutes", () => {
    const row = gameLogRowSchema.parse({
      PLAYER_ID: 201939,
      GAME_ID: "0022500001",
      GAME_DATE: "2025-10-22T00:00:00",
      TEAM_ID: 1610612744,
      TEAM_ABBREVIATION: "GSW",
      MATCHUP: "GSW vs. LAL",
      WL: "W",
      MIN: 34,
      FGM: 10,
      FGA: 20,
      FG3M: 5,
      FG3A: 11,
      FTM: 4,
      FTA: 4,
      OREB: 1,
      DREB: 4,
      REB: 5,
      AST: 8,
      STL: 2,
      BLK: 0,
      TOV: 3,
      PTS: 29,
      PLUS_MINUS: 12,
    });
    expect(row.MIN).toBe(34);
  });

  it("accepts string minutes and null plus-minus", () => {
    const row = gameLogRowSchema.parse({
      PLAYER_ID: 1,
      GAME_ID: "0022500002",
      GAME_DATE: "2025-10-23",
      TEAM_ID: 1,
      TEAM_ABBREVIATION: "BOS",
      MATCHUP: "BOS @ NYK",
      WL: null,
      MIN: "34:30",
      FGM: 0,
      FGA: 0,
      FG3M: 0,
      FG3A: 0,
      FTM: 0,
      FTA: 0,
      OREB: 0,
      DREB: 0,
      REB: 0,
      AST: 0,
      STL: 0,
      BLK: 0,
      TOV: 0,
      PTS: 0,
      PLUS_MINUS: null,
    });
    expect(row.MIN).toBe("34:30");
    expect(row.PLUS_MINUS).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/nba/schemas.test.ts`
Expected: FAIL (module `./schemas` not found).

- [ ] **Step 3: Write `src/lib/nba/schemas.ts`**

```typescript
import { z } from "zod";

export const playerIndexRowSchema = z.object({
  PERSON_ID: z.number(),
  PLAYER_FIRST_NAME: z.string(),
  PLAYER_LAST_NAME: z.string(),
  TEAM_ID: z.number(),
  TEAM_ABBREVIATION: z.string().nullable(),
  POSITION: z.string().nullable(),
  JERSEY_NUMBER: z.string().nullable(),
});

export const seasonStatsRowSchema = z.object({
  PLAYER_ID: z.number(),
  GP: z.number(),
  MIN: z.number(),
  FGM: z.number(),
  FGA: z.number(),
  FG3M: z.number(),
  FG3A: z.number(),
  FTM: z.number(),
  FTA: z.number(),
  OREB: z.number(),
  DREB: z.number(),
  REB: z.number(),
  AST: z.number(),
  STL: z.number(),
  BLK: z.number(),
  TOV: z.number(),
  PTS: z.number(),
});

export const gameLogRowSchema = z.object({
  PLAYER_ID: z.number(),
  GAME_ID: z.string(),
  GAME_DATE: z.string(),
  TEAM_ID: z.number(),
  TEAM_ABBREVIATION: z.string(),
  MATCHUP: z.string(),
  WL: z.string().nullable(),
  MIN: z.union([z.number(), z.string()]),
  FGM: z.number(),
  FGA: z.number(),
  FG3M: z.number(),
  FG3A: z.number(),
  FTM: z.number(),
  FTA: z.number(),
  OREB: z.number(),
  DREB: z.number(),
  REB: z.number(),
  AST: z.number(),
  STL: z.number(),
  BLK: z.number(),
  TOV: z.number(),
  PTS: z.number(),
  PLUS_MINUS: z.number().nullable(),
});

export type PlayerIndexRow = z.infer<typeof playerIndexRowSchema>;
export type SeasonStatsRow = z.infer<typeof seasonStatsRowSchema>;
export type GameLogRow = z.infer<typeof gameLogRowSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/nba/schemas.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nba/schemas.ts src/lib/nba/schemas.test.ts
git commit -m "CV: add zod schemas for NBA rows"
```

---

## Task 5: Client (`nbaFetch` with retry/backoff + timeout)

**Files:**

- Create: `src/lib/nba/client.ts`
- Test: `src/lib/nba/client.test.ts`

`nbaFetch` injects `fetchImpl` and `sleep` so tests are deterministic (no real network, no real timers).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";

import { nbaFetch } from "./client";

const noopSleep = async (): Promise<void> => {};

const okResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const errorResponse = (status: number): Response =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

describe("nbaFetch", () => {
  it("requests the right URL with NBA headers and returns parsed JSON", async () => {
    const fetchImpl = vi.fn(async () => okResponse({ resultSets: [] }));
    const result = await nbaFetch({
      endpoint: "playerindex",
      params: { Season: "2025-26", LeagueID: "00" },
      fetchImpl,
      sleep: noopSleep,
    });

    expect(result).toEqual({ resultSets: [] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("/playerindex?");
    expect(url).toContain("Season=2025-26");
    expect(init).toMatchObject({
      headers: expect.objectContaining({ "x-nba-stats-token": "true" }),
    });
  });

  it("retries on 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse({ ok: 1 }));
    const result = await nbaFetch({
      endpoint: "x",
      params: {},
      fetchImpl,
      sleep: noopSleep,
    });
    expect(result).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on 500", async () => {
    const fetchImpl = vi.fn(async () => errorResponse(500));
    await expect(
      nbaFetch({ endpoint: "x", params: {}, fetchImpl, sleep: noopSleep, maxRetries: 2 }),
    ).rejects.toThrow(/500/);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("retries a timeout (AbortError) then rethrows", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchImpl = vi.fn(async () => {
      throw abort;
    });
    await expect(
      nbaFetch({ endpoint: "x", params: {}, fetchImpl, sleep: noopSleep, maxRetries: 1 }),
    ).rejects.toThrow(/aborted/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/nba/client.test.ts`
Expected: FAIL (module `./client` not found).

- [ ] **Step 3: Write `src/lib/nba/client.ts`**

```typescript
import { NBA_BASE_URL, NBA_HEADERS } from "./constants";

export interface NbaFetchOptions {
  endpoint: string;
  params: Record<string, string>;
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

export async function nbaFetch({
  endpoint,
  params,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxRetries = 3,
  timeoutMs = 30000,
}: NbaFetchOptions): Promise<unknown> {
  const url = `${NBA_BASE_URL}/${endpoint}?${new URLSearchParams(params).toString()}`;

  const attempt = async (retriesLeft: number): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { headers: NBA_HEADERS, signal: controller.signal });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && retriesLeft > 0) {
          await sleep(backoffMs(maxRetries - retriesLeft));
          return attempt(retriesLeft - 1);
        }
        throw new Error(`NBA request failed (${response.status}) for ${endpoint}`);
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

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/nba/client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nba/client.ts src/lib/nba/client.test.ts
git commit -m "CV: add NBA HTTP client with retry/backoff"
```

---

## Task 6: Endpoints (3 typed league-wide calls)

**Files:**

- Create: `src/lib/nba/endpoints.ts`
- Test: `src/lib/nba/endpoints.test.ts`

Each endpoint builds its param set, calls `nbaFetch`, parses + validates, returns typed rows. `NbaClientDeps` is threaded through for test injection.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";

import { fetchPlayerGameLogs, fetchPlayerIndex, fetchSeasonStats } from "./endpoints";

const noopSleep = async (): Promise<void> => {};
const okResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const wrap = (name: string, headers: string[], rowSet: unknown[][]): unknown => ({
  resultSets: [{ name, headers, rowSet }],
});

describe("fetchPlayerIndex", () => {
  it("sends season/league params and returns validated rows", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse(
        wrap(
          "PlayerIndex",
          [
            "PERSON_ID",
            "PLAYER_FIRST_NAME",
            "PLAYER_LAST_NAME",
            "TEAM_ID",
            "TEAM_ABBREVIATION",
            "POSITION",
            "JERSEY_NUMBER",
          ],
          [[1629029, "Luka", "Doncic", 1610612747, "LAL", "G-F", "77"]],
        ),
      ),
    );
    const rows = await fetchPlayerIndex({ fetchImpl, sleep: noopSleep });
    expect(rows).toHaveLength(1);
    expect(rows[0].PLAYER_LAST_NAME).toBe("Doncic");
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain("/playerindex?");
    expect(url).toContain("Season=2025-26");
    expect(url).toContain("LeagueID=00");
  });
});

describe("fetchSeasonStats", () => {
  it("sends Regular Season + Totals params", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse(
        wrap(
          "LeagueDashPlayerStats",
          [
            "PLAYER_ID",
            "GP",
            "MIN",
            "FGM",
            "FGA",
            "FG3M",
            "FG3A",
            "FTM",
            "FTA",
            "OREB",
            "DREB",
            "REB",
            "AST",
            "STL",
            "BLK",
            "TOV",
            "PTS",
          ],
          [[201939, 70, 2400, 600, 1200, 300, 700, 200, 220, 50, 300, 350, 450, 90, 20, 200, 1700]],
        ),
      ),
    );
    const rows = await fetchSeasonStats({ fetchImpl, sleep: noopSleep });
    expect(rows[0].PTS).toBe(1700);
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain("/leaguedashplayerstats?");
    expect(url).toContain("SeasonType=Regular+Season");
    expect(url).toContain("PerMode=Totals");
  });
});

describe("fetchPlayerGameLogs", () => {
  it("passes the date window through", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse(
        wrap(
          "PlayerGameLogs",
          [
            "PLAYER_ID",
            "GAME_ID",
            "GAME_DATE",
            "TEAM_ID",
            "TEAM_ABBREVIATION",
            "MATCHUP",
            "WL",
            "MIN",
            "FGM",
            "FGA",
            "FG3M",
            "FG3A",
            "FTM",
            "FTA",
            "OREB",
            "DREB",
            "REB",
            "AST",
            "STL",
            "BLK",
            "TOV",
            "PTS",
            "PLUS_MINUS",
          ],
          [
            [
              201939,
              "0022500001",
              "2025-10-22T00:00:00",
              1610612744,
              "GSW",
              "GSW vs. LAL",
              "W",
              34,
              10,
              20,
              5,
              11,
              4,
              4,
              1,
              4,
              5,
              8,
              2,
              0,
              3,
              29,
              12,
            ],
          ],
        ),
      ),
    );
    const rows = await fetchPlayerGameLogs({
      dateFrom: "10/01/2025",
      dateTo: "10/31/2025",
      fetchImpl,
      sleep: noopSleep,
    });
    expect(rows[0].GAME_ID).toBe("0022500001");
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain("/playergamelogs?");
    expect(url).toContain("DateFrom=10%2F01%2F2025");
    expect(url).toContain("DateTo=10%2F31%2F2025");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/nba/endpoints.test.ts`
Expected: FAIL (module `./endpoints` not found).

- [ ] **Step 3: Write `src/lib/nba/endpoints.ts`**

```typescript
import { z } from "zod";

import { nbaFetch } from "./client";
import { LEAGUE_ID, RESULT_SET_NAMES, SEASON, SEASON_TYPE } from "./constants";
import { parseNbaResponse, rowsToObjects, selectResultSet } from "./parse";
import {
  GameLogRow,
  PlayerIndexRow,
  SeasonStatsRow,
  gameLogRowSchema,
  playerIndexRowSchema,
  seasonStatsRowSchema,
} from "./schemas";

export interface NbaClientDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const PLAYER_INDEX_PARAMS: Record<string, string> = {
  College: "",
  Country: "",
  DraftPick: "",
  DraftRound: "",
  DraftYear: "",
  Height: "",
  Historical: "0",
  LeagueID: LEAGUE_ID,
  Season: SEASON,
  SeasonType: SEASON_TYPE,
  TeamID: "",
  Weight: "",
};

const SEASON_STATS_PARAMS: Record<string, string> = {
  College: "",
  Conference: "",
  Country: "",
  DateFrom: "",
  DateTo: "",
  Division: "",
  DraftPick: "",
  DraftYear: "",
  GameScope: "",
  GameSegment: "",
  Height: "",
  LastNGames: "0",
  LeagueID: LEAGUE_ID,
  Location: "",
  MeasureType: "Base",
  Month: "0",
  OpponentTeamID: "0",
  Outcome: "",
  PORound: "0",
  PaceAdjust: "N",
  PerMode: "Totals",
  Period: "0",
  PlayerExperience: "",
  PlayerPosition: "",
  PlusMinus: "N",
  Rank: "N",
  Season: SEASON,
  SeasonSegment: "",
  SeasonType: SEASON_TYPE,
  ShotClockRange: "",
  StarterBench: "",
  TeamID: "0",
  VsConference: "",
  VsDivision: "",
  Weight: "",
};

const gameLogParams = (dateFrom: string, dateTo: string): Record<string, string> => ({
  DateFrom: dateFrom,
  DateTo: dateTo,
  GameSegment: "",
  LastNGames: "0",
  LeagueID: LEAGUE_ID,
  Location: "",
  MeasureType: "Base",
  Month: "0",
  OppTeamID: "0",
  Outcome: "",
  PORound: "0",
  PerMode: "Totals",
  Period: "0",
  PlayerID: "",
  Season: SEASON,
  SeasonSegment: "",
  SeasonType: SEASON_TYPE,
  ShotClockRange: "",
  TeamID: "",
  VsConference: "",
  VsDivision: "",
});

const fetchRows = async <T>(args: {
  endpoint: string;
  params: Record<string, string>;
  resultSetName: string;
  rowSchema: z.ZodType<T>;
  deps: NbaClientDeps;
}): Promise<T[]> => {
  const raw = await nbaFetch({
    endpoint: args.endpoint,
    params: args.params,
    fetchImpl: args.deps.fetchImpl,
    sleep: args.deps.sleep,
  });
  const response = parseNbaResponse(raw);
  const resultSet = selectResultSet(response, args.resultSetName);
  const objects = rowsToObjects(resultSet);
  return z.array(args.rowSchema).parse(objects);
};

export const fetchPlayerIndex = (deps: NbaClientDeps = {}): Promise<PlayerIndexRow[]> =>
  fetchRows({
    endpoint: "playerindex",
    params: PLAYER_INDEX_PARAMS,
    resultSetName: RESULT_SET_NAMES.playerIndex,
    rowSchema: playerIndexRowSchema,
    deps,
  });

export const fetchSeasonStats = (deps: NbaClientDeps = {}): Promise<SeasonStatsRow[]> =>
  fetchRows({
    endpoint: "leaguedashplayerstats",
    params: SEASON_STATS_PARAMS,
    resultSetName: RESULT_SET_NAMES.seasonStats,
    rowSchema: seasonStatsRowSchema,
    deps,
  });

export const fetchPlayerGameLogs = (
  args: { dateFrom: string; dateTo: string } & NbaClientDeps,
): Promise<GameLogRow[]> =>
  fetchRows({
    endpoint: "playergamelogs",
    params: gameLogParams(args.dateFrom, args.dateTo),
    resultSetName: RESULT_SET_NAMES.gameLogs,
    rowSchema: gameLogRowSchema,
    deps: { fetchImpl: args.fetchImpl, sleep: args.sleep },
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/nba/endpoints.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nba/endpoints.ts src/lib/nba/endpoints.test.ts
git commit -m "CV: add typed NBA endpoint fetchers"
```

---

## Task 7: Transform (raw rows → Prisma input shapes)

**Files:**

- Create: `src/lib/nba/transform.ts`
- Test: `src/lib/nba/transform.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";

import {
  parseMatchup,
  parseMinutes,
  toGameLogInput,
  toPlayerInput,
  toSeasonStatsInput,
} from "./transform";

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

describe("parseMatchup", () => {
  it("detects a home game", () => {
    expect(parseMatchup("GSW vs. LAL")).toEqual({ homeAway: "home", opponentAbbr: "LAL" });
  });

  it("detects an away game", () => {
    expect(parseMatchup("BOS @ NYK")).toEqual({ homeAway: "away", opponentAbbr: "NYK" });
  });
});

describe("toPlayerInput", () => {
  it("maps identity fields and builds fullName", () => {
    expect(
      toPlayerInput({
        PERSON_ID: 1629029,
        PLAYER_FIRST_NAME: "Luka",
        PLAYER_LAST_NAME: "Doncic",
        TEAM_ID: 1610612747,
        TEAM_ABBREVIATION: "LAL",
        POSITION: "G-F",
        JERSEY_NUMBER: "77",
      }),
    ).toEqual({
      id: 1629029,
      firstName: "Luka",
      lastName: "Doncic",
      fullName: "Luka Doncic",
      teamId: 1610612747,
      teamAbbr: "LAL",
      position: "G-F",
      jerseyNumber: "77",
    });
  });

  it("nulls a zero team id and blank strings", () => {
    const input = toPlayerInput({
      PERSON_ID: 1,
      PLAYER_FIRST_NAME: "Free",
      PLAYER_LAST_NAME: "Agent",
      TEAM_ID: 0,
      TEAM_ABBREVIATION: null,
      POSITION: "",
      JERSEY_NUMBER: null,
    });
    expect(input.teamId).toBeNull();
    expect(input.teamAbbr).toBeNull();
    expect(input.position).toBeNull();
    expect(input.jerseyNumber).toBeNull();
  });
});

describe("toSeasonStatsInput", () => {
  it("maps totals and stamps season/type", () => {
    const input = toSeasonStatsInput({
      PLAYER_ID: 201939,
      GP: 70,
      MIN: 2400,
      FGM: 600,
      FGA: 1200,
      FG3M: 300,
      FG3A: 700,
      FTM: 200,
      FTA: 220,
      OREB: 50,
      DREB: 300,
      REB: 350,
      AST: 450,
      STL: 90,
      BLK: 20,
      TOV: 200,
      PTS: 1700,
    });
    expect(input).toMatchObject({
      playerId: 201939,
      season: "2025-26",
      seasonType: "Regular Season",
      gamesPlayed: 70,
      minutes: 2400,
      pts: 1700,
      tov: 200,
    });
  });
});

describe("toGameLogInput", () => {
  it("maps a box score and derives matchup + date", () => {
    const input = toGameLogInput({
      PLAYER_ID: 201939,
      GAME_ID: "0022500001",
      GAME_DATE: "2025-10-22T00:00:00",
      TEAM_ID: 1610612744,
      TEAM_ABBREVIATION: "GSW",
      MATCHUP: "GSW vs. LAL",
      WL: "W",
      MIN: 34,
      FGM: 10,
      FGA: 20,
      FG3M: 5,
      FG3A: 11,
      FTM: 4,
      FTA: 4,
      OREB: 1,
      DREB: 4,
      REB: 5,
      AST: 8,
      STL: 2,
      BLK: 0,
      TOV: 3,
      PTS: 29,
      PLUS_MINUS: 12,
    });
    expect(input).toMatchObject({
      playerId: 201939,
      gameId: "0022500001",
      season: "2025-26",
      seasonType: "Regular Season",
      teamAbbr: "GSW",
      opponentAbbr: "LAL",
      homeAway: "home",
      winLoss: "W",
      minutes: 34,
      pts: 29,
      plusMinus: 12,
    });
    expect(input.gameDate.toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("parses a date-only GAME_DATE as UTC midnight", () => {
    const input = toGameLogInput({
      PLAYER_ID: 1,
      GAME_ID: "0022500002",
      GAME_DATE: "2025-10-23",
      TEAM_ID: 1,
      TEAM_ABBREVIATION: "BOS",
      MATCHUP: "BOS @ NYK",
      WL: null,
      MIN: "30:00",
      FGM: 0,
      FGA: 0,
      FG3M: 0,
      FG3A: 0,
      FTM: 0,
      FTA: 0,
      OREB: 0,
      DREB: 0,
      REB: 0,
      AST: 0,
      STL: 0,
      BLK: 0,
      TOV: 0,
      PTS: 0,
      PLUS_MINUS: null,
    });
    expect(input.gameDate.toISOString()).toBe("2025-10-23T00:00:00.000Z");
    expect(input.opponentAbbr).toBe("NYK");
    expect(input.homeAway).toBe("away");
    expect(input.winLoss).toBeNull();
    expect(input.plusMinus).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/nba/transform.test.ts`
Expected: FAIL (module `./transform` not found).

- [ ] **Step 3: Write `src/lib/nba/transform.ts`**

```typescript
import { SEASON, SEASON_TYPE } from "./constants";
import { GameLogRow, PlayerIndexRow, SeasonStatsRow } from "./schemas";

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

const blankToNull = (value: string | null): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

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

export const parseMatchup = (
  matchup: string,
): { homeAway: "home" | "away"; opponentAbbr: string } => {
  const away = matchup.includes(" @ ");
  const separator = away ? " @ " : " vs. ";
  const opponentAbbr = matchup.split(separator)[1]?.trim() ?? "";
  return { homeAway: away ? "away" : "home", opponentAbbr };
};

const parseGameDate = (value: string): Date => {
  if (!value.includes("T")) {
    return new Date(`${value}T00:00:00Z`);
  }
  // A bare date-time with no timezone designator is parsed as LOCAL time by JS
  // (skewing the stored date by the host offset). Force UTC when none is given.
  const hasTimezone = value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value);
  return hasTimezone ? new Date(value) : new Date(`${value}Z`);
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

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/nba/transform.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nba/transform.ts src/lib/nba/transform.test.ts
git commit -m "CV: add NBA row-to-model transforms"
```

---

## Task 8: Persist (idempotent upserts)

**Files:**

- Create: `src/lib/nba/persist.ts`
- Test: `src/lib/nba/persist.test.ts`

The Prisma client is mocked — no DB is touched. The test asserts the upsert payloads and that re-running issues upserts (not inserts), proving idempotency.

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

import { upsertGameLogs, upsertPlayers, upsertSeasonStats } from "./persist";
import { GameLogInput, PlayerInput, SeasonStatsInput } from "./transform";

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

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/nba/persist.test.ts`
Expected: FAIL (module `./persist` not found).

- [ ] **Step 3: Write `src/lib/nba/persist.ts`**

```typescript
import { prisma } from "@/lib/prisma";

import { GameLogInput, PlayerInput, SeasonStatsInput } from "./transform";

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

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/nba/persist.test.ts`
Expected: PASS (4 tests).

> If `tsc` flags the `create`/`update` payloads, it means a model scalar field is missing from the corresponding `*Input` interface in `transform.ts` — reconcile the interface with the Prisma model (the `Unchecked*` input variant accepts the scalar `playerId`). Do not add casts.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nba/persist.ts src/lib/nba/persist.test.ts
git commit -m "CV: add idempotent NBA upsert persistence"
```

---

## Task 9: Sync orchestration + CLI script

**Files:**

- Create: `src/lib/nba/sync.ts`
- Test: `src/lib/nba/sync.test.ts`
- Modify: `package.json` (add `sync:nba` script)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";

import * as endpoints from "./endpoints";
import * as persist from "./persist";
import { syncNba } from "./sync";

const playerIndexRow = {
  PERSON_ID: 1629029,
  PLAYER_FIRST_NAME: "Luka",
  PLAYER_LAST_NAME: "Doncic",
  TEAM_ID: 1610612747,
  TEAM_ABBREVIATION: "LAL",
  POSITION: "G-F",
  JERSEY_NUMBER: "77",
};

describe("syncNba", () => {
  it("fetches, transforms, persists, and aggregates counts across month chunks", async () => {
    vi.spyOn(endpoints, "fetchPlayerIndex").mockResolvedValue([playerIndexRow]);
    vi.spyOn(endpoints, "fetchSeasonStats").mockResolvedValue([]);
    vi.spyOn(endpoints, "fetchPlayerGameLogs").mockResolvedValue([]);

    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    const upsertSeasonStats = vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(0);
    const upsertGameLogs = vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(0);

    const summary = await syncNba();

    expect(summary).toEqual({ players: 1, seasonStats: 0, gameLogs: 0 });
    expect(upsertPlayers).toHaveBeenCalledWith([
      {
        id: 1629029,
        firstName: "Luka",
        lastName: "Doncic",
        fullName: "Luka Doncic",
        teamId: 1610612747,
        teamAbbr: "LAL",
        position: "G-F",
        jerseyNumber: "77",
      },
    ]);
    expect(upsertSeasonStats).toHaveBeenCalledTimes(1);
    // one game-log fetch + upsert per month range (7)
    expect(endpoints.fetchPlayerGameLogs).toHaveBeenCalledTimes(7);
    expect(upsertGameLogs).toHaveBeenCalledTimes(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/nba/sync.test.ts`
Expected: FAIL (module `./sync` not found).

- [ ] **Step 3: Write `src/lib/nba/sync.ts`**

```typescript
import { REGULAR_SEASON_DATE_RANGES } from "./constants";
import {
  NbaClientDeps,
  fetchPlayerGameLogs,
  fetchPlayerIndex,
  fetchSeasonStats,
} from "./endpoints";
import { upsertGameLogs, upsertPlayers, upsertSeasonStats } from "./persist";
import { toGameLogInput, toPlayerInput, toSeasonStatsInput } from "./transform";

// Bun sets `import.meta.main` on the entry module. @types/node's ImportMeta
// doesn't declare it, so augment the global interface (declaration merging,
// same pattern as src/lib/prisma.ts) rather than adding bun-types or casting.
declare global {
  interface ImportMeta {
    readonly main: boolean;
  }
}

export interface SyncSummary {
  players: number;
  seasonStats: number;
  gameLogs: number;
}

export async function syncNba(deps: NbaClientDeps = {}): Promise<SyncSummary> {
  const playerRows = await fetchPlayerIndex(deps);
  const players = await upsertPlayers(playerRows.map(toPlayerInput));

  const seasonRows = await fetchSeasonStats(deps);
  const seasonStats = await upsertSeasonStats(seasonRows.map(toSeasonStatsInput));

  const gameLogs = await REGULAR_SEASON_DATE_RANGES.reduce(async (previous, range) => {
    const runningTotal = await previous;
    const rows = await fetchPlayerGameLogs({ ...range, ...deps });
    const written = await upsertGameLogs(rows.map(toGameLogInput));
    return runningTotal + written;
  }, Promise.resolve(0));

  return { players, seasonStats, gameLogs };
}

if (import.meta.main) {
  syncNba()
    .then((summary) => {
      console.log(
        `NBA sync complete: ${summary.players} players, ${summary.seasonStats} season rows, ${summary.gameLogs} game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("NBA sync failed:", error);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/nba/sync.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Add the `sync:nba` script to `package.json`**

In the `scripts` block, add:

```json
"sync:nba": "bun run src/lib/nba/sync.ts",
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/nba/sync.ts src/lib/nba/sync.test.ts package.json
git commit -m "CV: add NBA sync orchestration + sync:nba script"
```

---

## Task 10: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full quality gate**

Run: `bun run system-check`
Expected: PASS — `prettier:check`, `typecheck`, `lint` (0 warnings), and `test` (all suites, including the ~36 new NBA tests) all green.

- [ ] **Step 2: Confirm scope guarantees**

- `grep -rn "as any\|as unknown" src/lib/nba` → no matches (no casts).
- `git grep -n "\^\|~" package.json` within the dependency blocks → no caret/tilde ranges; `zod` reads `4.4.3`.
- `prisma/migrations/20260612000000_init/migration.sql` exists and was **not applied** (no DB).

- [ ] **Step 3: Final commit (only if anything was fixed in Steps 1–2)**

```bash
git add -A
git commit -m "CV: finalize NBA player stats fetch layer"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** source/headers (Task 2, 5), envelope+column parse (Task 3), zod validation (Task 4), 3 league-wide endpoints with the required-but-empty params + month chunking (Task 6, constants in Task 2), matchup/minutes/date derivations (Task 7), 3 models with raw components + idempotent upserts (Task 1, 8), Bun-run sync entry (Task 9), code-only no-DB verification (Task 10). All spec §4–§10 items map to a task.
- **No DB is ever run.** `prisma generate` and `migrate diff` are DB-free; persistence is exercised only through a mocked Prisma client.
- **Param sets** in Task 6 are best-effort for the eventual live run; tests assert the params we send, not the live API. Adjust them when the real backfill is wired up (a documented follow-up).
