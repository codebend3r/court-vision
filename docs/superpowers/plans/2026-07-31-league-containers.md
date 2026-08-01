# League Containers + User Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User-owned League Containers (each with fantasy teams, starred players, and H2H-categories / H2H-points / roto setup) that absorb the global My Teams + Starred features, plus a `/settings` page (preferred fantasy formula, font-size scale with live preview, theme placeholder).

**Architecture:** New Prisma models (`League`, `LeagueTeam`, `LeagueTeamSlot`, `LeagueWatchlistPlayer`) with Supabase RLS, replacing `WatchlistPlayer` and the localStorage fantasy-teams store. One league is active per profile (`Profile.activeLeagueId`); existing routes keep their URLs and scope to it. League config seeds the Fantasy Value tab's nuqs defaults. Settings persist on `Profile` and render server-side (`data-font-scale` on `<html>`).

**Tech Stack:** Next.js 16 App Router, Prisma 7 (`generated/prisma`), Supabase auth + RLS, zustand 5, nuqs 2, SCSS modules, bun:test + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-31-league-containers-design.md`

## Global Constraints

- All commands through Bun: `bun run test` (NEVER bare `bun test`), `bun run typecheck`, `bun run lint`, `bun run db:migrate`.
- Type aliases only, never interfaces; never `any`; never cast (`as`) — use type guards, and unit test every guard.
- Named exports only. Import React symbols from `react`. Single-object parameters (type-guard predicates are the allowed positional exception, see `lib/watchlist/guards.ts`).
- Immutable data; `reduce`/`map`/`filter`/`flatMap` over loops; no `for/in`/`for/of`.
- `?.` always paired with `??`; `!!` for boolean conversion; `&&` over ternary-null in JSX.
- SCSS modules co-located; tokens from `styles/globals.scss` for every value; grid + `gap`, no margins for spacing; no unclassed divs; mixins via `@use "@/styles/mixins" as *;`.
- Imports via `@/*` / `@generated/*` aliases, never `../`.
- Accessibility: semantic elements, labels on all controls, keyboard operable, `aria-current`/`aria-pressed` states, focus styles via `control-focus-ring` mixin.
- Commits: subject `CV: <short title>`, bullet body. One commit per task (steps below say when).
- Tests co-located: `lib/foo.ts` ↔ `lib/foo.test.ts`, `components/Foo/Foo.tsx` ↔ `components/Foo/Foo.test.tsx`.

---

### Task 1: League types, scoring-config guards, constants, slug helper

**Files:**

- Create: `src/lib/leagues/types.ts`, `src/lib/leagues/constants.ts`, `src/lib/leagues/guards.ts`, `src/lib/leagues/guards.test.ts`, `src/lib/leagues/slug.ts`, `src/lib/leagues/slug.test.ts`

**Interfaces:**

- Consumes: `Category`, `ScoringSettings` from `@/lib/valuation/types`; `CATEGORY_KEYS`, `isCategory` from `@/lib/valuation/categories`; `DEFAULT_POINTS_SCORING`, `SCORED_KEYS` from `@/lib/valuation/methods/points`; `teamNameToSlug` from `@/lib/fantasyTeams/slug`.
- Produces: `LeagueScoringType`, `H2hCategoriesConfig`, `H2hPointsConfig`, `RotoConfig`, `LeagueScoringConfig`, `LeagueSummary`, `isLeagueScoringType(value)`, `isH2hCategoriesConfig(value)`, `isH2hPointsConfig(value)`, `isRotoConfig(value)`, `parseScoringConfig({ scoringType, value })`, `defaultScoringConfig({ scoringType })`, `MAX_LEAGUES`, `DEFAULT_LEAGUE_NAME`, `DEFAULT_LEAGUE_SLUG`, `uniqueSlug({ base, taken })`.

- [ ] **Step 1: Write failing guard tests** in `src/lib/leagues/guards.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import {
  defaultScoringConfig,
  isH2hCategoriesConfig,
  isH2hPointsConfig,
  isLeagueScoringType,
  isRotoConfig,
  parseScoringConfig,
} from "@/lib/leagues/guards";

describe("isLeagueScoringType", () => {
  it("accepts the three scoring types", () => {
    expect(isLeagueScoringType("h2h_categories")).toBe(true);
    expect(isLeagueScoringType("h2h_points")).toBe(true);
    expect(isLeagueScoringType("roto")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isLeagueScoringType("dynasty")).toBe(false);
    expect(isLeagueScoringType("")).toBe(false);
  });
});

describe("isH2hCategoriesConfig", () => {
  it("accepts categories with optional weights", () => {
    expect(isH2hCategoriesConfig({ categories: ["pts", "reb"] })).toBe(true);
    expect(isH2hCategoriesConfig({ categories: ["pts"], weights: { pts: 1.5 } })).toBe(true);
  });
  it("rejects empty, unknown, or malformed categories", () => {
    expect(isH2hCategoriesConfig({ categories: [] })).toBe(false);
    expect(isH2hCategoriesConfig({ categories: ["dunks"] })).toBe(false);
    expect(isH2hCategoriesConfig({ categories: ["pts"], weights: { pts: "high" } })).toBe(false);
    expect(isH2hCategoriesConfig(null)).toBe(false);
    expect(isH2hCategoriesConfig({ weights: {} })).toBe(false);
  });
});

describe("isH2hPointsConfig", () => {
  it("accepts a full scoring table", () => {
    expect(
      isH2hPointsConfig({
        scoring: { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, fg3m: 0, tov: -1 },
      }),
    ).toBe(true);
  });
  it("rejects missing keys and non-numbers", () => {
    expect(isH2hPointsConfig({ scoring: { pts: 1 } })).toBe(false);
    expect(isH2hPointsConfig({ scoring: { pts: "1" } })).toBe(false);
    expect(isH2hPointsConfig({})).toBe(false);
  });
});

describe("isRotoConfig", () => {
  it("accepts a category list", () => {
    expect(isRotoConfig({ categories: ["pts", "fg"] })).toBe(true);
  });
  it("rejects empty or unknown categories", () => {
    expect(isRotoConfig({ categories: [] })).toBe(false);
    expect(isRotoConfig({ categories: ["pts", "nope"] })).toBe(false);
  });
});

describe("parseScoringConfig", () => {
  it("returns a valid config unchanged", () => {
    const value = { categories: ["pts", "reb"] };
    expect(parseScoringConfig({ scoringType: "h2h_categories", value })).toEqual(value);
  });
  it("falls back to the type default on invalid input", () => {
    expect(parseScoringConfig({ scoringType: "h2h_points", value: { junk: true } })).toEqual(
      defaultScoringConfig({ scoringType: "h2h_points" }),
    );
    expect(parseScoringConfig({ scoringType: "roto", value: null })).toEqual(
      defaultScoringConfig({ scoringType: "roto" }),
    );
  });
  it("rejects a config that belongs to a different scoring type", () => {
    expect(
      parseScoringConfig({ scoringType: "h2h_points", value: { categories: ["pts"] } }),
    ).toEqual(defaultScoringConfig({ scoringType: "h2h_points" }));
  });
});
```

- [ ] **Step 2: Write failing slug tests** in `src/lib/leagues/slug.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { uniqueSlug } from "@/lib/leagues/slug";

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug({ base: "my-league", taken: [] })).toBe("my-league");
  });
  it("suffixes from -2 upward when taken", () => {
    expect(uniqueSlug({ base: "my-league", taken: ["my-league"] })).toBe("my-league-2");
    expect(uniqueSlug({ base: "my-league", taken: ["my-league", "my-league-2"] })).toBe(
      "my-league-3",
    );
  });
});
```

- [ ] **Step 3: Run to verify failure**: `bun run test src/lib/leagues` — expect module-not-found failures.

- [ ] **Step 4: Implement.** `src/lib/leagues/constants.ts`:

```ts
// Hard caps enforced server-side in lib/leagues/actions.ts, echoed in UI copy.
export const MAX_LEAGUES = 10;

export const DEFAULT_LEAGUE_NAME = "My League";
export const DEFAULT_LEAGUE_SLUG = "my-league";
```

`src/lib/leagues/types.ts`:

```ts
import { type Category, type ScoringSettings } from "@/lib/valuation/types";

export type LeagueScoringType = "h2h_categories" | "h2h_points" | "roto";

// Per-type scoring payloads stored in League.scoringConfig (Json column).
// Discriminated externally by League.scoringType, validated by lib/leagues/guards.
export type H2hCategoriesConfig = {
  categories: Category[];
  weights?: Partial<Record<Category, number>>;
};
export type H2hPointsConfig = { scoring: ScoringSettings };
export type RotoConfig = { categories: Category[] };
export type LeagueScoringConfig = H2hCategoriesConfig | H2hPointsConfig | RotoConfig;

// Serializable league shape crossing the RSC boundary (dates as ISO strings).
export type LeagueSummary = {
  id: string;
  name: string;
  slug: string;
  scoringType: LeagueScoringType;
  teamCount: number;
  rosterSlots: number;
  scoringConfig: LeagueScoringConfig;
  createdAt: string;
};

// Mirrors WatchlistActionResult (lib/watchlist/types.ts): server actions cross
// the RSC boundary, so errors are a result union, not throws.
export type LeagueMutationResult =
  | { status: "ok"; league: LeagueSummary }
  | { status: "limit" }
  | { status: "invalid" }
  | { status: "unauthenticated" }
  | { status: "error" };

export type LeagueDeleteResult =
  | { status: "ok"; activeLeagueId: string | null }
  | { status: "unauthenticated" }
  | { status: "error" };

export type SetActiveLeagueResult =
  { status: "ok" } | { status: "unauthenticated" } | { status: "error" };
```

`src/lib/leagues/guards.ts` (guards are positional, like `isWatchlistActionResult` — TS1230):

```ts
import { CATEGORY_KEYS, isCategory } from "@/lib/valuation/categories";
import { DEFAULT_POINTS_SCORING, SCORED_KEYS } from "@/lib/valuation/methods/points";
import {
  type H2hCategoriesConfig,
  type H2hPointsConfig,
  type LeagueScoringConfig,
  type LeagueScoringType,
  type RotoConfig,
} from "@/lib/leagues/types";

const SCORING_TYPES: readonly LeagueScoringType[] = ["h2h_categories", "h2h_points", "roto"];

export const isLeagueScoringType = (value: string): value is LeagueScoringType =>
  SCORING_TYPES.some((type) => type === value);

const isCategoryList = (value: unknown): value is H2hCategoriesConfig["categories"] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((entry) => typeof entry === "string" && isCategory(entry));

const isWeightRecord = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).every(
    ([key, weight]) => isCategory(key) && typeof weight === "number" && Number.isFinite(weight),
  );
};

export const isH2hCategoriesConfig = (value: unknown): value is H2hCategoriesConfig => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  if (!isCategoryList(record.categories)) return false;
  return record.weights === undefined || isWeightRecord(record.weights);
};

export const isH2hPointsConfig = (value: unknown): value is H2hPointsConfig => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  const scoring = record.scoring;
  if (typeof scoring !== "object" || scoring === null) return false;
  const scoringRecord: Record<string, unknown> = { ...scoring };
  return SCORED_KEYS.every(
    (key) => typeof scoringRecord[key] === "number" && Number.isFinite(scoringRecord[key]),
  );
};

export const isRotoConfig = (value: unknown): value is RotoConfig => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return isCategoryList(record.categories) && record.weights === undefined;
};

export const defaultScoringConfig = ({
  scoringType,
}: {
  scoringType: LeagueScoringType;
}): LeagueScoringConfig => {
  if (scoringType === "h2h_points") return { scoring: { ...DEFAULT_POINTS_SCORING } };
  return { categories: [...CATEGORY_KEYS] };
};

// Stored Json → typed config; anything stale or malformed falls back to the
// scoring type's default instead of crashing a page.
export const parseScoringConfig = ({
  scoringType,
  value,
}: {
  scoringType: LeagueScoringType;
  value: unknown;
}): LeagueScoringConfig => {
  if (scoringType === "h2h_categories" && isH2hCategoriesConfig(value)) return value;
  if (scoringType === "h2h_points" && isH2hPointsConfig(value)) return value;
  if (scoringType === "roto" && isRotoConfig(value)) return value;
  return defaultScoringConfig({ scoringType });
};
```

Note: `isRotoConfig` requires `weights === undefined` so a categories-config with weights doesn't satisfy roto — keeps `parseScoringConfig`'s type check honest. `isH2hCategoriesConfig` and `isRotoConfig` overlap on plain category lists; that is fine because `parseScoringConfig` checks against the declared `scoringType` only.

`src/lib/leagues/slug.ts`:

```ts
// Collision-proof slugs within one owner scope: "my-league" → "my-league-2".
export const uniqueSlug = ({ base, taken }: { base: string; taken: readonly string[] }): string => {
  if (!taken.includes(base)) return base;
  const candidate = Array.from(
    { length: taken.length + 1 },
    (_, index) => `${base}-${index + 2}`,
  ).find((suffixed) => !taken.includes(suffixed));
  return candidate ?? `${base}-${taken.length + 2}`;
};
```

- [ ] **Step 5: Run tests**: `bun run test src/lib/leagues` — expect PASS. Then `bun run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/leagues docs/superpowers/specs/2026-07-31-league-containers-design.md
git commit -m "CV: league scoring types, config guards, and slug helper

- LeagueScoringType + per-type config shapes with tested type guards
- parseScoringConfig falls back to type defaults on malformed Json
- uniqueSlug for per-owner slug collision handling
- league containers design spec"
```

---

### Task 2: Prisma schema, migrations, and league-scoped watchlist

This task is atomic: the schema change drops `WatchlistPlayer`, so `lib/watchlist` and `lib/leagues/queries.ts` must land together or the build breaks.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: migration `league_containers` (edited by hand for backfill), migration `league_rls` (hand-written SQL)
- Create: `src/lib/leagues/queries.ts`
- Modify: `src/lib/watchlist/actions.ts`, `src/lib/watchlist/queries.ts`

**Interfaces:**

- Consumes: Task 1 (`LeagueSummary`, `parseScoringConfig`, `defaultScoringConfig`, `DEFAULT_LEAGUE_NAME`, `DEFAULT_LEAGUE_SLUG`); `getProfile` from `@/lib/auth/session`; `prisma` from `@/lib/prisma`.
- Produces: Prisma models `League`, `LeagueTeam`, `LeagueTeamSlot`, `LeagueWatchlistPlayer`; `Profile.activeLeagueId/preferredFormula/fontScale`; `toLeagueSummary({ league })`, `getLeagues(): Promise<LeagueSummary[]>`, `getActiveLeague(): Promise<LeagueSummary | null>`, `resolveActiveLeague({ profile })` (read-only fallback), `ensureDefaultLeague(): Promise<LeagueSummary | null>` (writes). Watchlist actions/queries keep their exact existing signatures, now scoped to the active league.

- [ ] **Step 1: Edit `prisma/schema.prisma`.** Remove model `WatchlistPlayer` and the `watchlist` relation fields on `Profile` and `Player`. Update `Profile`, add new models:

```prisma
model Profile {
  id               String   @id @db.Uuid
  email            String
  username         String   @unique
  tier             String   @default("free")
  displayName      String?
  // User preferences (spec: settings page). preferredFormula is a
  // FantasyMethodKey; fontScale is "sm" | "default" | "lg" | "xl" — both
  // validated by guards at the edges, stored as plain strings.
  preferredFormula String?
  fontScale        String   @default("default")
  activeLeagueId   String?
  activeLeague     League?  @relation("ActiveLeague", fields: [activeLeagueId], references: [id], onDelete: SetNull)
  leagues          League[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

// A League Container: one user's fantasy league with its own teams, starred
// players, and scoring setup. scoringConfig's shape depends on scoringType and
// is validated by lib/leagues/guards.ts. The 10-league cap is enforced in
// lib/leagues/actions.ts, inside a transaction.
model League {
  id            String                  @id @default(cuid())
  profileId     String                  @db.Uuid
  profile       Profile                 @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name          String
  slug          String
  scoringType   String                  @default("h2h_categories")
  teamCount     Int                     @default(12)
  rosterSlots   Int                     @default(13)
  scoringConfig Json
  teams         LeagueTeam[]
  watchlist     LeagueWatchlistPlayer[]
  activeFor     Profile[]               @relation("ActiveLeague")
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt

  @@unique([profileId, slug])
}

model LeagueTeam {
  id        String           @id @default(cuid())
  leagueId  String
  league    League           @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  // Denormalized owner so RLS is a direct auth.uid() check, not a join.
  profileId String           @db.Uuid
  name      String
  slug      String
  slots     LeagueTeamSlot[]
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@unique([leagueId, slug])
  @@index([profileId])
}

model LeagueTeamSlot {
  id        String     @id @default(cuid())
  teamId    String
  team      LeagueTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  profileId String     @db.Uuid
  slotType  String
  position  Int
  playerId  Int?
  player    Player?    @relation(fields: [playerId], references: [id], onDelete: SetNull)

  @@unique([teamId, position])
  @@index([profileId])
}

// Per-league starred players; replaces the global WatchlistPlayer. Same
// composite-natural-key design; the 50-row cap (per league now) stays in
// lib/watchlist/actions.ts.
model LeagueWatchlistPlayer {
  leagueId  String
  league    League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  playerId  Int
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  profileId String   @db.Uuid
  createdAt DateTime @default(now())

  @@id([leagueId, playerId])
  @@index([leagueId, createdAt(sort: Desc)])
  @@index([profileId])
}
```

On `Player`, replace `watchlist WatchlistPlayer[]` with:

```prisma
  leagueWatchlist  LeagueWatchlistPlayer[]
  leagueTeamSlots  LeagueTeamSlot[]
```

- [ ] **Step 2: Generate the migration without applying**: `bun run db:migrate -- --create-only --name league_containers`. Open the generated `prisma/migrations/<timestamp>_league_containers/migration.sql` and insert this backfill block **immediately before** the `DROP TABLE "WatchlistPlayer"` statement (after all `CREATE TABLE`/`ALTER TABLE` statements):

```sql
-- Backfill: every profile with starred players gets a default league, becomes
-- its active league, and keeps its stars — before the old table drops.
INSERT INTO "League" ("id", "profileId", "name", "slug", "scoringType", "teamCount", "rosterSlots", "scoringConfig", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'My League', 'my-league', 'h2h_categories', 12, 13,
  '{"categories":["pts","reb","ast","stl","blk","tpm","tov","fg","ft"]}'::jsonb,
  now(), now()
FROM "Profile" p
WHERE EXISTS (SELECT 1 FROM "WatchlistPlayer" w WHERE w."profileId" = p."id");

UPDATE "Profile" p SET "activeLeagueId" = l."id"
FROM "League" l
WHERE l."profileId" = p."id" AND l."slug" = 'my-league';

INSERT INTO "LeagueWatchlistPlayer" ("leagueId", "playerId", "profileId", "createdAt")
SELECT l."id", w."playerId", w."profileId", w."createdAt"
FROM "WatchlistPlayer" w
JOIN "League" l ON l."profileId" = w."profileId" AND l."slug" = 'my-league';
```

- [ ] **Step 3: Apply**: `bun run db:migrate`. Verify with `bun run db:generate` that the client regenerates cleanly.

- [ ] **Step 4: RLS migration**: `bun run db:migrate -- --create-only --name league_rls`, then replace the generated file's contents with (pattern from `prisma/migrations/20260731143800_watchlist_rls/migration.sql`):

```sql
-- Leagues are personal. Prisma connects as the Postgres role and bypasses RLS;
-- these policies close the anon-key path for all four league tables.
alter table "League" enable row level security;
create policy "league_owner_select" on "League" for select using (auth.uid() = "profileId");
create policy "league_owner_insert" on "League" for insert with check (auth.uid() = "profileId");
create policy "league_owner_update" on "League" for update using (auth.uid() = "profileId");
create policy "league_owner_delete" on "League" for delete using (auth.uid() = "profileId");

alter table "LeagueTeam" enable row level security;
create policy "league_team_owner_select" on "LeagueTeam" for select using (auth.uid() = "profileId");
create policy "league_team_owner_insert" on "LeagueTeam" for insert with check (auth.uid() = "profileId");
create policy "league_team_owner_update" on "LeagueTeam" for update using (auth.uid() = "profileId");
create policy "league_team_owner_delete" on "LeagueTeam" for delete using (auth.uid() = "profileId");

alter table "LeagueTeamSlot" enable row level security;
create policy "league_team_slot_owner_select" on "LeagueTeamSlot" for select using (auth.uid() = "profileId");
create policy "league_team_slot_owner_insert" on "LeagueTeamSlot" for insert with check (auth.uid() = "profileId");
create policy "league_team_slot_owner_update" on "LeagueTeamSlot" for update using (auth.uid() = "profileId");
create policy "league_team_slot_owner_delete" on "LeagueTeamSlot" for delete using (auth.uid() = "profileId");

alter table "LeagueWatchlistPlayer" enable row level security;
create policy "league_watchlist_owner_select" on "LeagueWatchlistPlayer" for select using (auth.uid() = "profileId");
create policy "league_watchlist_owner_insert" on "LeagueWatchlistPlayer" for insert with check (auth.uid() = "profileId");
create policy "league_watchlist_owner_delete" on "LeagueWatchlistPlayer" for delete using (auth.uid() = "profileId");
```

Apply with `bun run db:migrate`.

- [ ] **Step 5: Create `src/lib/leagues/queries.ts`:**

```ts
import { type League, type Profile } from "@generated/prisma/client";

import { getProfile } from "@/lib/auth/session";
import { DEFAULT_LEAGUE_NAME, DEFAULT_LEAGUE_SLUG } from "@/lib/leagues/constants";
import {
  defaultScoringConfig,
  isLeagueScoringType,
  parseScoringConfig,
} from "@/lib/leagues/guards";
import { type LeagueSummary } from "@/lib/leagues/types";
import { prisma } from "@/lib/prisma";

// A stored scoringType predates a rename or was tampered with → treat the
// league as h2h_categories rather than crash.
export const toLeagueSummary = ({ league }: { league: League }): LeagueSummary => {
  const scoringType = isLeagueScoringType(league.scoringType)
    ? league.scoringType
    : "h2h_categories";
  return {
    id: league.id,
    name: league.name,
    slug: league.slug,
    scoringType,
    teamCount: league.teamCount,
    rosterSlots: league.rosterSlots,
    scoringConfig: parseScoringConfig({ scoringType, value: league.scoringConfig }),
    createdAt: league.createdAt.toISOString(),
  };
};

export const getLeagues = async (): Promise<LeagueSummary[]> => {
  const profile = await getProfile();
  if (profile === null) return [];
  const leagues = await prisma.league.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "asc" },
  });
  return leagues.map((league) => toLeagueSummary({ league }));
};

// Read-only resolution for RSC render paths: prefers activeLeagueId, falls
// back to the most recently updated league WITHOUT persisting anything —
// writes during render are ensureDefaultLeague's job, called from actions.
export const resolveActiveLeague = async ({
  profile,
}: {
  profile: Profile;
}): Promise<League | null> => {
  if (profile.activeLeagueId !== null) {
    const active = await prisma.league.findUnique({ where: { id: profile.activeLeagueId } });
    if (active !== null) return active;
  }
  return prisma.league.findFirst({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" },
  });
};

export const getActiveLeague = async (): Promise<LeagueSummary | null> => {
  const profile = await getProfile();
  if (profile === null) return null;
  const league = await resolveActiveLeague({ profile });
  return league === null ? null : toLeagueSummary({ league });
};

// Server-action entry point: guarantees a league exists and is active. Spread
// the config into a fresh literal — Prisma's InputJsonValue needs an index
// signature, which a fresh object literal satisfies without a cast.
export const ensureDefaultLeague = async (): Promise<LeagueSummary | null> => {
  const profile = await getProfile();
  if (profile === null) return null;
  const existing = await resolveActiveLeague({ profile });
  if (existing !== null) {
    if (profile.activeLeagueId !== existing.id) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { activeLeagueId: existing.id },
      });
    }
    return toLeagueSummary({ league: existing });
  }
  const config = defaultScoringConfig({ scoringType: "h2h_categories" });
  const created = await prisma.league.create({
    data: {
      profileId: profile.id,
      name: DEFAULT_LEAGUE_NAME,
      slug: DEFAULT_LEAGUE_SLUG,
      scoringType: "h2h_categories",
      scoringConfig: { ...config },
    },
  });
  await prisma.profile.update({
    where: { id: profile.id },
    data: { activeLeagueId: created.id },
  });
  return toLeagueSummary({ league: created });
};
```

- [ ] **Step 6: League-scope the watchlist.** In `src/lib/watchlist/actions.ts`, resolve the league first; the cap stays per-league. `starPlayer` becomes:

```ts
export const starPlayer = async ({
  playerId,
}: {
  playerId: number;
}): Promise<WatchlistActionResult> => {
  const league = await ensureDefaultLeague();
  if (league === null) return { status: "unauthenticated" };
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
      if (current >= MAX_WATCHLIST) return { status: "limit", count: current };
      try {
        await tx.leagueWatchlistPlayer.create({
          data: { leagueId: league.id, playerId, profileId: profileIdOf(league) },
        });
      } catch (error) {
        if (!isUniqueViolation({ error })) throw error;
      }
      const count = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
      return { status: "ok", count };
    });
  } catch {
    return { status: "error" };
  }
};
```

`LeagueSummary` doesn't carry `profileId`; instead of a helper, fetch the profile once at the top (`const profile = await getProfile()`) and use `profile.id` — `ensureDefaultLeague` already null-checks the same session, so gate on `profile === null` first, then call `ensureDefaultLeague()`. `unstarPlayer` mirrors it with `deleteMany({ where: { leagueId: league.id, playerId } })`. In `src/lib/watchlist/queries.ts`, each function resolves `const profile = await getProfile()`, then `const league = await resolveActiveLeague({ profile })` (import from `@/lib/leagues/queries`), returns `[]`/`0` when either is null, and swaps `prisma.watchlistPlayer` → `prisma.leagueWatchlistPlayer` with `where: { leagueId: league.id }`. `WatchlistPlayerSummary`, result types, and function names are unchanged, so `StarButton`, `StarredPlayersView`, `WatchlistHydrator`, trend code, and the store need no edits.

- [ ] **Step 7: Verify**: `bun run typecheck`, `bun run test`, `bun run lint`. Manually: `bun dev`, star a player, confirm it lands in `LeagueWatchlistPlayer` for the default league.

- [ ] **Step 8: Commit**

```bash
git add prisma src/lib/leagues src/lib/watchlist
git commit -m "CV: league container schema with per-league watchlist

- League / LeagueTeam / LeagueTeamSlot / LeagueWatchlistPlayer models + RLS
- Profile gains activeLeagueId, preferredFormula, fontScale
- migration backfills a default My League and moves watchlist rows into it
- watchlist actions/queries scope to the active league, same public API"
```

---

### Task 3: League CRUD server actions

**Files:**

- Create: `src/lib/leagues/actions.ts`
- Modify: `src/lib/leagues/guards.ts`, `src/lib/leagues/guards.test.ts` (add `isLeagueMutationResult`)

**Interfaces:**

- Consumes: Task 1 types/guards, Task 2 queries (`toLeagueSummary`), `uniqueSlug`, `teamNameToSlug` from `@/lib/fantasyTeams/slug`.
- Produces: `createLeague({ name, scoringType, teamCount, rosterSlots, scoringConfig })`, `updateLeague({ leagueId, name, scoringType, teamCount, rosterSlots, scoringConfig })` → `Promise<LeagueMutationResult>`; `deleteLeague({ leagueId })` → `Promise<LeagueDeleteResult>`; `setActiveLeague({ leagueId })` → `Promise<SetActiveLeagueResult>`; guard `isLeagueMutationResult(value)`.

- [ ] **Step 1: Failing guard test** (append to `guards.test.ts`):

```ts
describe("isLeagueMutationResult", () => {
  it("accepts every status arm", () => {
    const league = {
      id: "1",
      name: "A",
      slug: "a",
      scoringType: "roto",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
      createdAt: "2026-07-31T00:00:00.000Z",
    };
    expect(isLeagueMutationResult({ status: "ok", league })).toBe(true);
    expect(isLeagueMutationResult({ status: "limit" })).toBe(true);
    expect(isLeagueMutationResult({ status: "invalid" })).toBe(true);
    expect(isLeagueMutationResult({ status: "unauthenticated" })).toBe(true);
    expect(isLeagueMutationResult({ status: "error" })).toBe(true);
  });
  it("rejects ok without a league and unknown statuses", () => {
    expect(isLeagueMutationResult({ status: "ok" })).toBe(false);
    expect(isLeagueMutationResult({ status: "nope" })).toBe(false);
    expect(isLeagueMutationResult(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `bun run test src/lib/leagues/guards.test.ts` — FAIL (no export).

- [ ] **Step 3: Implement.** Add to `guards.ts`:

```ts
export const isLeagueMutationResult = (value: unknown): value is LeagueMutationResult => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  if (record.status === "ok") return typeof record.league === "object" && record.league !== null;
  return (
    record.status === "limit" ||
    record.status === "invalid" ||
    record.status === "unauthenticated" ||
    record.status === "error"
  );
};
```

`src/lib/leagues/actions.ts` (clamp bounds match `fantasyParsers`: teams 2–30, slots 1–25):

```ts
"use server";

import { getProfile } from "@/lib/auth/session";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { MAX_LEAGUES } from "@/lib/leagues/constants";
import { isLeagueScoringType, parseScoringConfig } from "@/lib/leagues/guards";
import { toLeagueSummary } from "@/lib/leagues/queries";
import { uniqueSlug } from "@/lib/leagues/slug";
import {
  type LeagueDeleteResult,
  type LeagueMutationResult,
  type LeagueScoringConfig,
  type SetActiveLeagueResult,
} from "@/lib/leagues/types";
import { prisma } from "@/lib/prisma";

const clampInt = ({
  value,
  min,
  max,
  fallback,
}: {
  value: number;
  min: number;
  max: number;
  fallback: number;
}): number => (Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback);

export const createLeague = async ({
  name,
  scoringType,
  teamCount,
  rosterSlots,
  scoringConfig,
}: {
  name: string;
  scoringType: string;
  teamCount: number;
  rosterSlots: number;
  scoringConfig: LeagueScoringConfig;
}): Promise<LeagueMutationResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  const trimmed = name.trim();
  if (trimmed === "" || !isLeagueScoringType(scoringType)) return { status: "invalid" };
  const config = parseScoringConfig({ scoringType, value: scoringConfig });
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.league.findMany({
        where: { profileId: profile.id },
        select: { slug: true },
      });
      if (existing.length >= MAX_LEAGUES) return { status: "limit" };
      const league = await tx.league.create({
        data: {
          profileId: profile.id,
          name: trimmed,
          slug: uniqueSlug({
            base: teamNameToSlug(trimmed),
            taken: existing.map((row) => row.slug),
          }),
          scoringType,
          teamCount: clampInt({ value: teamCount, min: 2, max: 30, fallback: 12 }),
          rosterSlots: clampInt({ value: rosterSlots, min: 1, max: 25, fallback: 13 }),
          scoringConfig: { ...config },
        },
      });
      // A user's first league becomes active without a second click.
      await tx.profile.updateMany({
        where: { id: profile.id, activeLeagueId: null },
        data: { activeLeagueId: league.id },
      });
      return { status: "ok", league: toLeagueSummary({ league }) };
    });
  } catch {
    return { status: "error" };
  }
};

export const updateLeague = async ({
  leagueId,
  name,
  scoringType,
  teamCount,
  rosterSlots,
  scoringConfig,
}: {
  leagueId: string;
  name: string;
  scoringType: string;
  teamCount: number;
  rosterSlots: number;
  scoringConfig: LeagueScoringConfig;
}): Promise<LeagueMutationResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  const trimmed = name.trim();
  if (trimmed === "" || !isLeagueScoringType(scoringType)) return { status: "invalid" };
  const config = parseScoringConfig({ scoringType, value: scoringConfig });
  try {
    // updateMany + ownership in the where: a forged leagueId updates 0 rows.
    const updated = await prisma.league.updateMany({
      where: { id: leagueId, profileId: profile.id },
      data: {
        name: trimmed,
        scoringType,
        teamCount: clampInt({ value: teamCount, min: 2, max: 30, fallback: 12 }),
        rosterSlots: clampInt({ value: rosterSlots, min: 1, max: 25, fallback: 13 }),
        scoringConfig: { ...config },
      },
    });
    if (updated.count === 0) return { status: "invalid" };
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (league === null) return { status: "error" };
    return { status: "ok", league: toLeagueSummary({ league }) };
  } catch {
    return { status: "error" };
  }
};

export const deleteLeague = async ({
  leagueId,
}: {
  leagueId: string;
}): Promise<LeagueDeleteResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  try {
    await prisma.league.deleteMany({ where: { id: leagueId, profileId: profile.id } });
    // FK onDelete: SetNull already cleared activeLeagueId if it pointed here;
    // promote the most recently updated survivor so the app never dangles.
    const fallback = await prisma.league.findFirst({
      where: { profileId: profile.id },
      orderBy: { updatedAt: "desc" },
    });
    await prisma.profile.update({
      where: { id: profile.id },
      data: { activeLeagueId: fallback?.id ?? null },
    });
    return { status: "ok", activeLeagueId: fallback?.id ?? null };
  } catch {
    return { status: "error" };
  }
};

export const setActiveLeague = async ({
  leagueId,
}: {
  leagueId: string;
}): Promise<SetActiveLeagueResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  try {
    const owned = await prisma.league.findFirst({
      where: { id: leagueId, profileId: profile.id },
      select: { id: true },
    });
    if (owned === null) return { status: "error" };
    await prisma.profile.update({
      where: { id: profile.id },
      data: { activeLeagueId: leagueId },
    });
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
};
```

- [ ] **Step 4: Verify**: `bun run test src/lib/leagues` PASS; `bun run typecheck`; `bun run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leagues
git commit -m "CV: league CRUD server actions

- create/update/delete/setActive with ownership checks in the where clause
- 10-league cap inside the create transaction
- deleting the active league promotes the most recent survivor"
```

---

### Task 4: Leagues store + hydrator + root-layout wiring

**Files:**

- Create: `src/lib/leagues/store.ts`, `src/lib/leagues/store.test.ts`, `src/components/LeaguesHydrator/LeaguesHydrator.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**

- Consumes: `LeagueSummary` (Task 1), `getLeagues`/`getActiveLeague` (Task 2), `getProfile`.
- Produces: `useLeaguesStore` with `{ leagues, activeLeagueId, hydrate({ leagues, activeLeagueId }), setActive({ leagueId }), upsert({ league }), remove({ leagueId }) }`; selectors `useActiveLeague(): LeagueSummary | null`, `useLeagues(): LeagueSummary[]`; component `LeaguesHydrator({ leagues, activeLeagueId })`. Root layout renders `<html data-font-scale=...>` and hydrates leagues; SideNav gate switches from `user` to `profile`.

- [ ] **Step 1: Failing store test** `src/lib/leagues/store.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "bun:test";

import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

const league = ({ id, name }: { id: string; name: string }): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  createdAt: "2026-07-31T00:00:00.000Z",
});

beforeEach(() => {
  useLeaguesStore.setState({ leagues: [], activeLeagueId: null });
});

describe("useLeaguesStore", () => {
  it("hydrates leagues and the active id", () => {
    useLeaguesStore
      .getState()
      .hydrate({ leagues: [league({ id: "a", name: "Alpha" })], activeLeagueId: "a" });
    expect(useLeaguesStore.getState().leagues).toHaveLength(1);
    expect(useLeaguesStore.getState().activeLeagueId).toBe("a");
  });

  it("upsert replaces by id and appends when new", () => {
    const alpha = league({ id: "a", name: "Alpha" });
    useLeaguesStore.getState().hydrate({ leagues: [alpha], activeLeagueId: "a" });
    useLeaguesStore.getState().upsert({ league: { ...alpha, name: "Renamed" } });
    expect(useLeaguesStore.getState().leagues[0]?.name).toBe("Renamed");
    useLeaguesStore.getState().upsert({ league: league({ id: "b", name: "Beta" }) });
    expect(useLeaguesStore.getState().leagues).toHaveLength(2);
  });

  it("remove drops the league and clears a dangling active id", () => {
    useLeaguesStore
      .getState()
      .hydrate({ leagues: [league({ id: "a", name: "Alpha" })], activeLeagueId: "a" });
    useLeaguesStore.getState().remove({ leagueId: "a" });
    expect(useLeaguesStore.getState().leagues).toHaveLength(0);
    expect(useLeaguesStore.getState().activeLeagueId).toBe(null);
  });
});
```

- [ ] **Step 2: Run** `bun run test src/lib/leagues/store.test.ts` — FAIL.

- [ ] **Step 3: Implement** `src/lib/leagues/store.ts` (not persisted — DB is truth, same rationale as the watchlist store):

```ts
import { create } from "zustand";

import { type LeagueSummary } from "@/lib/leagues/types";

type LeaguesState = {
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
  hydrate: (args: { leagues: LeagueSummary[]; activeLeagueId: string | null }) => void;
  setActive: (args: { leagueId: string }) => void;
  upsert: (args: { league: LeagueSummary }) => void;
  remove: (args: { leagueId: string }) => void;
};

// Deliberately NOT persisted: the database is the source of truth.
// LeaguesHydrator re-seeds this store from the server on every navigation.
export const useLeaguesStore = create<LeaguesState>()((set) => ({
  leagues: [],
  activeLeagueId: null,
  hydrate: ({ leagues, activeLeagueId }) => set({ leagues, activeLeagueId }),
  setActive: ({ leagueId }) => set({ activeLeagueId: leagueId }),
  upsert: ({ league }) =>
    set((state) => ({
      leagues: state.leagues.some((entry) => entry.id === league.id)
        ? state.leagues.map((entry) => (entry.id === league.id ? league : entry))
        : [...state.leagues, league],
    })),
  remove: ({ leagueId }) =>
    set((state) => ({
      leagues: state.leagues.filter((entry) => entry.id !== leagueId),
      activeLeagueId: state.activeLeagueId === leagueId ? null : state.activeLeagueId,
    })),
}));

export const useLeagues = (): LeagueSummary[] => useLeaguesStore((state) => state.leagues);

export const useActiveLeague = (): LeagueSummary | null =>
  useLeaguesStore(
    (state) => state.leagues.find((entry) => entry.id === state.activeLeagueId) ?? null,
  );
```

`src/components/LeaguesHydrator/LeaguesHydrator.tsx` (mirror of `WatchlistHydrator`):

```tsx
"use client";

import { useEffect } from "react";

import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

export type LeaguesHydratorProps = {
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
};

// Seeds the leagues store from the server once per navigation, so the side-nav
// switcher and league pages share one query and one source of truth.
export function LeaguesHydrator({ leagues, activeLeagueId }: LeaguesHydratorProps) {
  useEffect(() => {
    useLeaguesStore.getState().hydrate({ leagues, activeLeagueId });
  }, [leagues, activeLeagueId]);
  return null;
}
```

- [ ] **Step 4: Wire the root layout.** In `src/app/layout.tsx`: replace `getUser()` with `getProfile()`; fetch leagues; stamp the font scale (guard comes in Task 12 — until then inline `profile?.fontScale ?? "default"` is safe because the column defaults to `"default"`):

```tsx
const profile = await getProfile();
const watchlistPlayerIds = await getWatchlistPlayerIds();
const leagues = profile === null ? [] : await getLeagues();
const activeLeagueId = leagues.some((league) => league.id === profile?.activeLeagueId)
  ? (profile?.activeLeagueId ?? null)
  : (leagues[0]?.id ?? null);
```

```tsx
<html
  lang="en"
  suppressHydrationWarning
  data-font-scale={profile?.fontScale ?? "default"}
  className={...}
>
```

Inside `<ThemeProvider>` add `<LeaguesHydrator leagues={leagues} activeLeagueId={activeLeagueId} />` next to `WatchlistHydrator`, and change the nav gate to `{!!profile && <SideNav />}`.

- [ ] **Step 5: Verify**: `bun run test`, `bun run typecheck`, `bun run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/leagues src/components/LeaguesHydrator src/app/layout.tsx
git commit -m "CV: leagues store hydrated from the root layout

- non-persisted zustand store with tested hydrate/upsert/remove/setActive
- LeaguesHydrator seeds it per navigation like the watchlist
- layout stamps data-font-scale from the profile"
```

---

### Task 5: SideNav entry + LeagueSwitcher

**Files:**

- Create: `src/components/LeagueSwitcher/LeagueSwitcher.tsx`, `src/components/LeagueSwitcher/LeagueSwitcher.module.scss`, `src/components/LeagueSwitcher/LeagueSwitcher.test.tsx`
- Modify: `src/components/SideNav/SideNav.tsx`, `src/components/SideNav/SideNav.test.tsx`, `src/components/SideNav/SideNav.module.scss`

**Interfaces:**

- Consumes: `useLeagues`, `useActiveLeague`, `useLeaguesStore` (Task 4), `setActiveLeague` action (Task 3).
- Produces: `LeagueSwitcher()` client component rendered inside `SideNav` below the nav list; new `NAV_ENTRIES` item `{ href: "/leagues", label: "Leagues", shortLabel: "L" }`.

- [ ] **Step 1: Failing SideNav test additions** (`SideNav.test.tsx`):

```tsx
it("renders the Leagues link", () => {
  pathnameMock.current = "/";
  render(<SideNav />);
  const link = screen.getByRole("link", { name: "Leagues" });
  expect(link).toHaveAttribute("href", "/leagues");
  expect(link).not.toHaveAttribute("aria-current");
});

it("marks Leagues active on /leagues and nested routes", () => {
  pathnameMock.current = "/leagues/create";
  render(<SideNav />);
  expect(screen.getByRole("link", { name: "Leagues" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 2: Failing LeagueSwitcher test** `LeagueSwitcher.test.tsx` (mock the action module; seed the store):

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { LeagueSwitcher } from "@/components/LeagueSwitcher/LeagueSwitcher";
import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

const setActiveLeagueMock = vi.fn(async () => ({ status: "ok" }));

vi.mock("@/lib/leagues/actions", () => ({
  setActiveLeague: (args: { leagueId: string }) => setActiveLeagueMock(args),
}));

const league = ({ id, name }: { id: string; name: string }): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  createdAt: "2026-07-31T00:00:00.000Z",
});

beforeEach(() => {
  setActiveLeagueMock.mockClear();
  useLeaguesStore.setState({
    leagues: [league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })],
    activeLeagueId: "a",
  });
});

afterEach(cleanup);

describe("LeagueSwitcher", () => {
  it("shows the active league name", () => {
    render(<LeagueSwitcher />);
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("renders nothing with no leagues", () => {
    useLeaguesStore.setState({ leagues: [], activeLeagueId: null });
    const { container } = render(<LeagueSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("switches league optimistically and calls the action", () => {
    render(<LeagueSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Beta/ }));
    expect(useLeaguesStore.getState().activeLeagueId).toBe("b");
    expect(setActiveLeagueMock).toHaveBeenCalledWith({ leagueId: "b" });
  });
});
```

- [ ] **Step 3: Run** `bun run test src/components/LeagueSwitcher src/components/SideNav` — FAIL.

- [ ] **Step 4: Implement.** `SideNav.tsx`: add `{ href: "/leagues", label: "Leagues", shortLabel: "L" }` after the "My Teams" entry, extend the active check with `(entry.href === "/leagues" && pathname.startsWith("/leagues/"))`, and render `<LeagueSwitcher />` between the `</ul>` and the collapse button. `LeagueSwitcher.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/components/LeagueSwitcher/LeagueSwitcher.module.scss";
import { setActiveLeague } from "@/lib/leagues/actions";
import { useActiveLeague, useLeagues, useLeaguesStore } from "@/lib/leagues/store";

// Active-league picker in the side menu. Optimistic: the store flips first so
// every league-scoped surface updates instantly; router.refresh() re-renders
// the server pages against the new active league.
export function LeagueSwitcher() {
  const router = useRouter();
  const leagues = useLeagues();
  const active = useActiveLeague();
  const [open, setOpen] = useState(false);

  if (leagues.length === 0) return null;

  const pick = ({ leagueId }: { leagueId: string }) => {
    useLeaguesStore.getState().setActive({ leagueId });
    setOpen(false);
    void setActiveLeague({ leagueId }).then(() => router.refresh());
  };

  return (
    <section className={styles.switcher} aria-label="Active league">
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {active?.name ?? "Pick a league"}
      </button>
      {open && (
        <ul className={styles.list} role="menu">
          {leagues.map((league) => (
            <li key={league.id} className={styles.item} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={league.id === active?.id}
                className={styles.option}
                onClick={() => pick({ leagueId: league.id })}
              >
                {league.name}
              </button>
            </li>
          ))}
          <li className={styles.item} role="none">
            <Link
              href="/leagues"
              role="menuitem"
              className={styles.manage}
              onClick={() => setOpen(false)}
            >
              Manage leagues
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}
```

`LeagueSwitcher.module.scss`: grid container with `gap: var(--space-2)`, trigger styled with the `retro-button` mixin at `--font-size-sm`, list as `display: grid` using `--color-surface` / `--color-border` / `--radius-md`, options with `control-focus-ring` and `selected-accent` for `aria-checked="true"`. Hide the full label when the parent nav has `data-collapsed="true"` (same technique `SideNav.module.scss` uses for `.label`).

- [ ] **Step 5: Run tests** — PASS. `bun run typecheck && bun run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/components/SideNav src/components/LeagueSwitcher
git commit -m "CV: leagues nav entry and side-menu league switcher

- Leagues entry with /leagues/* active aliasing
- optimistic switcher backed by setActiveLeague + router.refresh"
```

---

### Task 6: /leagues management page

**Files:**

- Create: `src/app/leagues/page.tsx`, `src/app/leagues/page.module.scss`, `src/components/LeagueList/LeagueList.tsx`, `src/components/LeagueList/LeagueList.module.scss`, `src/components/LeagueList/LeagueList.test.tsx`

**Interfaces:**

- Consumes: `getLeagues` (Task 2), `deleteLeague`/`setActiveLeague` (Task 3), store (Task 4), `MAX_LEAGUES`.
- Produces: `LeagueList({ leagues, activeLeagueId })` client component; `/leagues` server page.

- [ ] **Step 1: Failing test** `LeagueList.test.tsx` — mock `@/lib/leagues/actions` (`deleteLeague` → `{ status: "ok", activeLeagueId: null }`, `setActiveLeague` → `{ status: "ok" }`) and `next/navigation` (`useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })`). Assert: renders one card per league with its name and scoring-type label ("H2H Categories" / "H2H Points" / "Rotisserie"); the active league card has `aria-pressed="true"` on its "Active" button; clicking "Set active" on another card calls `setActiveLeague({ leagueId })`; clicking "Delete" then the confirm button calls `deleteLeague({ leagueId })`; with `MAX_LEAGUES` leagues the "Create league" link is replaced by copy `Limit reached (10)`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** `/leagues` page (server):

```tsx
import { LeagueList } from "@/components/LeagueList/LeagueList";
import { getProfile } from "@/lib/auth/session";
import { getLeagues } from "@/lib/leagues/queries";
import { redirect } from "next/navigation";

import styles from "@/app/leagues/page.module.scss";

export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/leagues");
  const leagues = await getLeagues();
  const activeLeagueId =
    leagues.find((league) => league.id === profile.activeLeagueId)?.id ?? leagues[0]?.id ?? null;
  return (
    <main className={styles.page}>
      <h1>Leagues</h1>
      <LeagueList leagues={leagues} activeLeagueId={activeLeagueId} />
    </main>
  );
}
```

`LeagueList` (client): local state seeded from props; header row with a "Create league" `<Link href="/leagues/create">` (hidden at cap, replaced by `Limit reached (10)` copy in a `<p>`); a `<ul>` of cards — each card shows name (link to `/leagues/${league.slug}`), a scoring-type badge (label via a local `SCORING_TYPE_LABELS: Record<LeagueScoringType, string>` = `{ h2h_categories: "H2H Categories", h2h_points: "H2H Points", roto: "Rotisserie" }`), `${teamCount} teams · ${rosterSlots} slots`, an Active toggle button (`aria-pressed`, `retro-button` mixin) calling `setActiveLeague` + store `setActive` + `router.refresh()`, and a Delete button with a two-click confirm (first click flips the button to "Confirm delete", `aria-label` says so; second click calls `deleteLeague`, store `remove`, `router.refresh()`). Empty state: `<p>` prompting to create a first league. SCSS: cards in `display: grid; gap: var(--space-4)`, card = `--color-surface` bg, `--color-border`, `--radius-lg`, padding `--space-4`; badge uses `micro-label` mixin.

- [ ] **Step 4: Run tests** — PASS. `bun run typecheck && bun run lint`.

- [ ] **Step 5: Commit** — `CV: leagues management page` with bullets for cards, active toggle, delete confirm, cap copy.

---

### Task 7: LeagueForm + create/edit routes

**Files:**

- Create: `src/components/LeagueForm/LeagueForm.tsx`, `src/components/LeagueForm/LeagueForm.module.scss`, `src/components/LeagueForm/LeagueForm.test.tsx`, `src/app/leagues/create/page.tsx`, `src/app/leagues/[leagueSlug]/page.tsx`, shared `src/app/leagues/leagues.module.scss` if needed
- Modify: none

**Interfaces:**

- Consumes: `createLeague`/`updateLeague` (Task 3), `defaultScoringConfig`, `CATEGORY_META`/`CATEGORY_KEYS`, `DEFAULT_POINTS_SCORING`/`SCORED_KEYS`, `snapWeight`/`clampScore` from `@/lib/valuation/searchParams`, store `upsert`.
- Produces: `LeagueForm({ league })` — `league: LeagueSummary | null` (null = create mode).

- [ ] **Step 1: Failing tests** `LeagueForm.test.tsx` — mock actions module. Assert: create mode renders a name input (labelled "League name"), three scoring-type radios, teams/slots number inputs defaulting 12/13; selecting "H2H Points" swaps the category checkboxes for the 7-stat scoring table inputs; selecting "Rotisserie" shows categories without weight inputs; submitting with a name calls `createLeague` with `scoringType: "h2h_points"` and a `scoring` config when points is selected; edit mode (league prop) pre-fills fields and submits `updateLeague({ leagueId: ... })`; a `limit` result renders the error copy `You already have 10 leagues.` in a `role="alert"` region.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement `LeagueForm`.** One client component holding form state:

```tsx
type LeagueFormState = {
  name: string;
  scoringType: LeagueScoringType;
  teamCount: number;
  rosterSlots: number;
  categories: Category[]; // h2h_categories + roto
  weights: Partial<Record<Category, number>>; // h2h_categories only
  scoring: ScoringSettings; // h2h_points only
};
```

Initialize from `league` prop via `parseScoringConfig` branches (create mode: all `CATEGORY_KEYS`, empty weights, `DEFAULT_POINTS_SCORING`, 12/13). Render with semantic form markup: `<form>` → labelled `<input>` for name; `<fieldset><legend>Scoring</legend>` with three radios (`control-radio` mixin); teams/slots as labelled `type="number"` inputs (min/max 2–30 and 1–25, `control-field` mixin); conditional config section:

- `h2h_categories`: checkbox per `CATEGORY_META` entry (checked = included) each with a weight `type="number"` input (step 0.25, 0–2, value snapped through `snapWeight`, disabled when unchecked);
- `roto`: the same checkboxes, no weight inputs;
- `h2h_points`: a labelled number input per `SCORED_KEYS` entry (step 0.1, clamped through `clampScore`).

On submit build the config for the selected type (drop weight entries equal to 1), call `createLeague`/`updateLeague`, and on `ok` → `useLeaguesStore.getState().upsert({ league: result.league })`, `router.push("/leagues")`, `router.refresh()`. Non-ok results set an error message state rendered in `<p role="alert">` (`limit` → `You already have 10 leagues.`, `invalid` → `Check the league name and settings.`, otherwise `Something went wrong — try again.`). Keep at least one category checked: disable unchecking the last one. SCSS: form as grid `gap: var(--space-4)`, config grid `repeat(auto-fill, minmax(9rem, 1fr))`, submit via `retro-button`.

`/leagues/create/page.tsx` (server): auth gate like `/leagues`, render `<main>` + `<h1>Create league</h1>` + `<LeagueForm league={null} />`.

`/leagues/[leagueSlug]/page.tsx` (server): auth gate; `const leagues = await getLeagues()`; find by `params.leagueSlug`; `notFound()` from `next/navigation` when missing; render `<h1>{league.name}</h1>` + `<LeagueForm league={league} />`. `export const dynamic = "force-dynamic"` on both.

- [ ] **Step 4: Run tests** — PASS. `bun run typecheck && bun run lint`. Manual: create a points league, reload, edit it, confirm config round-trips.

- [ ] **Step 5: Commit** — `CV: league create/edit form and routes` with bullets.

---

### Task 8: League teams — mapping, queries, actions

**Files:**

- Create: `src/lib/leagues/teams.ts`, `src/lib/leagues/teams.test.ts`, `src/lib/leagues/teamQueries.ts`, `src/lib/leagues/teamActions.ts`

**Interfaces:**

- Consumes: `RosterSlot`, `RosterSlotType`, `FantasyTeamPlayer`, `FantasyTeam` from `@/lib/fantasyTeams/types`; `SLOT_TYPES` from `@/lib/fantasyTeams/slots`; `uniqueSlug`, `teamNameToSlug`; `ensureDefaultLeague`.
- Produces: `isRosterSlotType(value)`, `isFantasyTeamPlayer(value)`, `slotsToRows({ slots })`, `rowsToSlots({ rows })` in `teams.ts`; `getLeagueTeams({ leagueId }): Promise<FantasyTeam[]>` and `getLeagueTeamBySlug({ leagueId, slug }): Promise<FantasyTeam | null>` in `teamQueries.ts`; `saveLeagueTeam({ leagueId, teamId, name, slots })` → `Promise<LeagueTeamActionResult>` and `deleteLeagueTeam({ teamId })` → `Promise<LeagueTeamActionResult>` in `teamActions.ts`, where `LeagueTeamActionResult = { status: "ok"; team: FantasyTeam } | { status: "ok-deleted" } | { status: "invalid" } | { status: "unauthenticated" } | { status: "error" }` (add to `types.ts`). DB `FantasyTeam.id` is the `LeagueTeam.id` cuid; `FantasyTeam.createdAt` the row's ISO date.

- [ ] **Step 1: Failing mapping tests** `teams.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { isRosterSlotType, rowsToSlots, slotsToRows } from "@/lib/leagues/teams";
import { type RosterSlot } from "@/lib/fantasyTeams/types";

const player = {
  playerId: 7,
  firstName: "Kevin",
  lastName: "Durant",
  fullName: "Kevin Durant",
  teamAbbr: "HOU",
  position: "F",
  nbaPersonId: 201142,
};

describe("isRosterSlotType", () => {
  it("accepts every SLOT_META type and rejects junk", () => {
    expect(isRosterSlotType("PG")).toBe(true);
    expect(isRosterSlotType("ILPLUS")).toBe(true);
    expect(isRosterSlotType("COACH")).toBe(false);
  });
});

describe("slot row mapping", () => {
  const slots: RosterSlot[] = [
    { id: "PG-1", type: "PG", player },
    { id: "UTIL-1", type: "UTIL", player: null },
    { id: "UTIL-2", type: "UTIL", player: null },
  ];

  it("slotsToRows keeps order via position and nulls empty slots", () => {
    expect(slotsToRows({ slots })).toEqual([
      { slotType: "PG", position: 0, playerId: 7 },
      { slotType: "UTIL", position: 1, playerId: null },
      { slotType: "UTIL", position: 2, playerId: null },
    ]);
  });

  it("rowsToSlots regenerates per-type slot ids in position order", () => {
    const rows = [
      { slotType: "PG", player },
      { slotType: "UTIL", player: null },
      { slotType: "UTIL", player: null },
    ];
    expect(rowsToSlots({ rows })).toEqual(slots);
  });

  it("rowsToSlots drops rows with unknown slot types", () => {
    expect(rowsToSlots({ rows: [{ slotType: "COACH", player: null }] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** `src/lib/leagues/teams.ts`:

```ts
import { SLOT_TYPES } from "@/lib/fantasyTeams/slots";
import {
  type FantasyTeamPlayer,
  type RosterSlot,
  type RosterSlotType,
} from "@/lib/fantasyTeams/types";

export const isRosterSlotType = (value: string): value is RosterSlotType =>
  SLOT_TYPES.some((type) => type === value);

export const isFantasyTeamPlayer = (value: unknown): value is FantasyTeamPlayer => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    typeof record.playerId === "number" &&
    typeof record.firstName === "string" &&
    typeof record.lastName === "string" &&
    typeof record.fullName === "string" &&
    (record.teamAbbr === null || typeof record.teamAbbr === "string") &&
    (record.position === null || typeof record.position === "string") &&
    (record.nbaPersonId === null || typeof record.nbaPersonId === "number")
  );
};

export type LeagueTeamSlotRow = {
  slotType: string;
  player: FantasyTeamPlayer | null;
};

export const slotsToRows = ({
  slots,
}: {
  slots: readonly RosterSlot[];
}): Array<{ slotType: RosterSlotType; position: number; playerId: number | null }> =>
  slots.map((slot, index) => ({
    slotType: slot.type,
    position: index,
    playerId: slot.player?.playerId ?? null,
  }));

// DB rows (ordered by position) → RosterSlot[]. Ids are regenerated as
// "<TYPE>-<n>" per type, matching lib/fantasyTeams/slots.ts buildSlots.
export const rowsToSlots = ({ rows }: { rows: readonly LeagueTeamSlotRow[] }): RosterSlot[] =>
  rows.reduce<{ counts: Partial<Record<RosterSlotType, number>>; slots: RosterSlot[] }>(
    (acc, row) => {
      if (!isRosterSlotType(row.slotType)) return acc;
      const ordinal = (acc.counts[row.slotType] ?? 0) + 1;
      return {
        counts: { ...acc.counts, [row.slotType]: ordinal },
        slots: [
          ...acc.slots,
          { id: `${row.slotType}-${ordinal}`, type: row.slotType, player: row.player },
        ],
      };
    },
    { counts: {}, slots: [] },
  ).slots;
```

`teamQueries.ts`: `getLeagueTeams` = `prisma.leagueTeam.findMany({ where: { leagueId }, orderBy: { createdAt: "asc" }, include: { slots: { orderBy: { position: "asc" }, include: { player: { select: { id: true, firstName: true, lastName: true, fullName: true, teamAbbr: true, position: true, nbaPersonId: true } } } } } })`, then map each team to `{ id, name, createdAt: team.createdAt.toISOString(), slots: rowsToSlots({ rows: team.slots.map((slot) => ({ slotType: slot.slotType, player: slot.player === null ? null : { playerId: slot.player.id, firstName: slot.player.firstName, lastName: slot.player.lastName, fullName: slot.player.fullName, teamAbbr: slot.player.teamAbbr, position: slot.player.position, nbaPersonId: slot.player.nbaPersonId } })) }) }`. `getLeagueTeamBySlug` = same with `findFirst({ where: { leagueId, slug } })`, null passthrough. Both take `{ leagueId }` from the caller (server pages resolve it), no session re-check needed beyond what pages do — but they run on the Prisma role, so filter strictly by the ids given.

`teamActions.ts` (`"use server"`): `saveLeagueTeam`:

1. `getProfile()` → unauthenticated when null.
2. Verify league ownership: `prisma.league.findFirst({ where: { id: leagueId, profileId: profile.id }, select: { id: true } })` → `invalid` when null.
3. Validate: trimmed name non-empty; `slots.length` between 1 and 60; every `slot.type` passes `isRosterSlotType` and every non-null `slot.player` passes `isFantasyTeamPlayer` → else `invalid`.
4. Transaction: if `teamId === null`, compute slug via `uniqueSlug({ base: teamNameToSlug(name), taken })` from the league's existing team slugs and `create`; else `updateMany({ where: { id: teamId, leagueId, profileId: profile.id } })` (0 rows → `invalid`) keeping the existing slug. Then `deleteMany` the team's slots and `createMany` `slotsToRows({ slots })` rows with `teamId` and `profileId: profile.id`.
5. Re-read via the same include as `getLeagueTeams` and return `{ status: "ok", team }`.

`deleteLeagueTeam`: `deleteMany({ where: { id: teamId, profileId: profile.id } })`, return `{ status: "ok-deleted" }` (0 rows still ok — idempotent), catch → `error`.

- [ ] **Step 4: Run** `bun run test src/lib/leagues` — PASS. `bun run typecheck && bun run lint`.

- [ ] **Step 5: Commit** — `CV: league team persistence layer` with bullets (mapping + guards, queries, save/delete actions, RLS-safe ownership checks).

---

### Task 9: Wire My Teams UI to the database

**Files:**

- Modify: `src/app/my-teams/page.tsx`, `src/app/my-teams/create/page.tsx`, `src/app/my-teams/[teamSlug]/page.tsx`, `src/components/MyTeamsList/MyTeamsList.tsx` (+ test), `src/components/TeamBuilder/TeamBuilder.tsx` (+ test), `src/components/TeamEditor/TeamEditor.tsx` (+ test), `src/components/HomeTeamPanel/HomeTeamPanel.tsx` (+ test), `src/app/page.tsx`

**Interfaces:**

- Consumes: Task 8 queries/actions; `ensureDefaultLeague`/`getActiveLeague` (Task 2).
- Produces: `MyTeamsList({ teams, leagueName })`, `TeamEditor({ team, ... })` and `TeamBuilder` take a `leagueId: string` prop and an optional `team: FantasyTeam | null`; `HomeTeamPanel({ teams })`. No component touches `useFantasyTeamsStore` afterward.

Read each component before editing — this task rewires state, it does not redesign markup. The store-swap recipe per component:

- [ ] **Step 1: Server pages fetch and gate.** `my-teams/page.tsx` becomes async + `force-dynamic`: `getProfile()` → `redirect("/login?next=/my-teams")`; `const league = await getActiveLeague()`; when `league === null` render the existing page shell with a `<p>` prompting to create a league (link `/leagues/create`); else `const teams = await getLeagueTeams({ leagueId: league.id })` and render `<MyTeamsList teams={teams} leagueName={league.name} />` with the league name shown next to the `<h1>` (e.g. `<p className={styles.scope}>League: {league.name}</p>`). Same gating pattern for `my-teams/create/page.tsx` (pass `leagueId={league.id}` into `TeamBuilder`) and `my-teams/[teamSlug]/page.tsx` (`const team = await getLeagueTeamBySlug({ leagueId: league.id, slug: params.teamSlug })`, `notFound()` when null, pass `team` + `leagueId` down).

- [ ] **Step 2: MyTeamsList.** Delete the `useFantasyTeamsStore` import, `persist.rehydrate` effect, and store selectors; take `teams: FantasyTeam[]` + `leagueName: string` props and hold `useState(teams)` synced via `useEffect` on prop change. Replace `removeTeam({ teamId })` with `void deleteLeagueTeam({ teamId }).then(() => router.refresh())` plus a local optimistic filter. Update its test to pass props instead of seeding localStorage, mocking `@/lib/leagues/teamActions`.

- [ ] **Step 3: TeamBuilder / TeamEditor.** Replace `addTeam`/`updateTeam` store calls with `saveLeagueTeam({ leagueId, teamId: team?.id ?? null, name, slots })`; on `ok` → `router.push("/my-teams")` + `router.refresh()`; on failure set inline `role="alert"` copy (`invalid` → `Check the team name and roster.`, else `Something went wrong — try again.`). TeamEditor drops its rehydrate/`hydrated` state entirely — the team arrives as a prop from the server page. Update tests accordingly (mock `teamActions`).

- [ ] **Step 4: HomeTeamPanel + home page.** `src/app/page.tsx` already loads server data; fetch `const league = await getActiveLeague()` and `const teams = league === null ? [] : await getLeagueTeams({ leagueId: league.id })`, pass `teams` into `HomeTeamPanel`. In the panel, drop the store + rehydrate effect and read the prop. Update its test to pass `teams`.

- [ ] **Step 5: Verify**: `bun run test`, `bun run typecheck`, `bun run lint`. Manual: create/edit/delete a team, switch active league in the side menu and watch `/my-teams` re-scope.

- [ ] **Step 6: Commit** — `CV: my teams pages read league teams from the database` with bullets.

---

### Task 10: Legacy localStorage teams migrator + retire the old store

**Files:**

- Create: `src/components/LegacyTeamsMigrator/LegacyTeamsMigrator.tsx`, `src/components/LegacyTeamsMigrator/LegacyTeamsMigrator.test.tsx`
- Modify: `src/lib/leagues/teamActions.ts` (add `importLegacyTeams`), `src/lib/leagues/teams.ts` + `teams.test.ts` (add `parseLegacyTeamsPayload`), `src/app/layout.tsx`
- Delete: `src/lib/fantasyTeams/store.ts` (and its test if present)

**Interfaces:**

- Consumes: `FantasyTeam` shape, guards from Task 8.
- Produces: `parseLegacyTeamsPayload(value)` returning `FantasyTeam[] | null` from the persisted zustand JSON (`{ state: { teams: [...] }, version: 0 }`); `importLegacyTeams({ teams })` → `{ status: "ok" | "skipped" | "unauthenticated" | "error" }`; `LegacyTeamsMigrator()` rendered in the root layout when a profile exists.

- [ ] **Step 1: Failing tests** for `parseLegacyTeamsPayload` in `teams.test.ts`: accepts a real persisted payload (round-trip one `FantasyTeam` with a player and an empty slot); returns null for `null`, `{}`, `{ state: { teams: "no" } }`, and a team whose slot has an unknown type; returns null (not a partial list) when any team is malformed. And a `LegacyTeamsMigrator.test.tsx`: seeds `localStorage["court-vision-fantasy-teams"]` with a valid payload, mocks `importLegacyTeams` → `{ status: "ok" }`, renders, `waitFor` → action called with the parsed teams and the key removed; with result `skipped` the key is also removed; with result `error` the key is kept.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** `parseLegacyTeamsPayload` (in `teams.ts`): narrow `value` → object → `state` object → `teams` array; each team must have string `id`/`name`/`createdAt` and an array `slots` where every entry has string `id`, `isRosterSlotType(type)`, and `player === null || isFantasyTeamPlayer(player)`; rebuild a fresh `FantasyTeam[]` from the narrowed fields (never return the input object as-is). `importLegacyTeams` (in `teamActions.ts`): `ensureDefaultLeague()`; `skipped` when the league already has teams (`count > 0`); otherwise insert each team inside one transaction re-using the same create path as `saveLeagueTeam` (slug from name, `slotsToRows`), `ok` on success. `LegacyTeamsMigrator`:

```tsx
"use client";

import { useEffect } from "react";

import { importLegacyTeams } from "@/lib/leagues/teamActions";
import { parseLegacyTeamsPayload } from "@/lib/leagues/teams";

const LEGACY_KEY = "court-vision-fantasy-teams";

// One-time migration of pre-league localStorage teams into the default league.
// The key is only cleared once the server has them (or explicitly skipped),
// so a failed request retries on the next visit.
export function LegacyTeamsMigrator() {
  useEffect(() => {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) return;
    const parsed: unknown = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();
    const teams = parseLegacyTeamsPayload(parsed);
    if (teams === null || teams.length === 0) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    void importLegacyTeams({ teams }).then((result) => {
      if (result.status === "ok" || result.status === "skipped") {
        localStorage.removeItem(LEGACY_KEY);
      }
    });
  }, []);
  return null;
}
```

Render `{!!profile && <LegacyTeamsMigrator />}` in the layout next to the hydrators. Delete `src/lib/fantasyTeams/store.ts`; `bun run typecheck` must come back clean (Task 9 removed all consumers).

- [ ] **Step 4: Run** `bun run test` — PASS; `bun run typecheck && bun run lint`.

- [ ] **Step 5: Commit** — `CV: migrate legacy localStorage teams into the default league` with bullets.

---

### Task 11: League config seeds Fantasy Value defaults

**Files:**

- Create: `src/lib/leagues/fantasyDefaults.ts`, `src/lib/leagues/fantasyDefaults.test.ts`
- Modify: `src/app/players/page.tsx` (the page that renders `FantasyValueView`; confirm via `grep -rn "FantasyValueView" src/app`), `src/components/FantasyValueView/FantasyValueView.tsx` (+ test)

**Interfaces:**

- Consumes: `LeagueSummary`, config guards; `FantasyMethodKey` from `@/lib/valuation/registry`; `FantasySortKey`, `fantasyParsers`, `FantasySearchParams` from `@/lib/valuation/searchParams`; `CATEGORY_KEYS`; `WEIGHTED_METHOD_KEYS`.
- Produces: `SORT_KEY_BY_METHOD: Record<FantasyMethodKey, FantasySortKey>`; `FantasySeed = Partial<Pick<FantasySearchParams, "teams" | "slots" | "x" | "w" | "s" | "sort">>`; `buildLeagueSeed({ league, preferredFormula, presentKeys }): FantasySeed`; `FantasyValueView` accepts optional `leagueSeed?: FantasySeed`.

- [ ] **Step 1: Failing tests** `fantasyDefaults.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { buildLeagueSeed, SORT_KEY_BY_METHOD } from "@/lib/leagues/fantasyDefaults";
import { type LeagueSummary } from "@/lib/leagues/types";

const base: LeagueSummary = {
  id: "a",
  name: "Alpha",
  slug: "alpha",
  scoringType: "h2h_categories",
  teamCount: 10,
  rosterSlots: 15,
  scoringConfig: { categories: ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg"] },
  createdAt: "2026-07-31T00:00:00.000Z",
};

describe("buildLeagueSeed", () => {
  it("seeds teams/slots and excluded categories for a categories league", () => {
    const seed = buildLeagueSeed({ league: base, preferredFormula: null, presentKeys: new Set() });
    expect(seed.teams).toBe(10);
    expect(seed.slots).toBe(15);
    expect(seed.x).toEqual(["ft"]);
    expect(seed.sort).toBeUndefined();
  });

  it("never seeds a key already present in the URL", () => {
    const seed = buildLeagueSeed({
      league: base,
      preferredFormula: "gscore",
      presentKeys: new Set(["teams", "sort"]),
    });
    expect(seed.teams).toBeUndefined();
    expect(seed.sort).toBeUndefined();
    expect(seed.slots).toBe(15);
  });

  it("maps league weights onto every weighted method column", () => {
    const league: LeagueSummary = {
      ...base,
      scoringConfig: { categories: ["pts", "reb"], weights: { pts: 1.5 } },
    };
    const seed = buildLeagueSeed({ league, preferredFormula: null, presentKeys: new Set() });
    expect(seed.w?.z).toEqual({ pts: 1.5 });
    expect(seed.w?.sim).toEqual({ pts: 1.5 });
  });

  it("seeds the scoring table and points sort for a points league", () => {
    const league: LeagueSummary = {
      ...base,
      scoringType: "h2h_points",
      scoringConfig: { scoring: { pts: 1, reb: 2, ast: 1.5, stl: 3, blk: 3, fg3m: 0.5, tov: -1 } },
    };
    const seed = buildLeagueSeed({ league, preferredFormula: null, presentKeys: new Set() });
    expect(seed.s?.reb).toBe(2);
    expect(seed.sort).toBe("points");
  });

  it("preferred formula wins the sort seed", () => {
    const seed = buildLeagueSeed({
      league: base,
      preferredFormula: "positional",
      presentKeys: new Set(),
    });
    expect(seed.sort).toBe(SORT_KEY_BY_METHOD.positional);
  });

  it("returns an empty seed without a league beyond the formula sort", () => {
    const seed = buildLeagueSeed({
      league: null,
      preferredFormula: "zscore",
      presentKeys: new Set(),
    });
    expect(seed).toEqual({ sort: "z" });
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** `src/lib/leagues/fantasyDefaults.ts`:

```ts
import { isH2hPointsConfig } from "@/lib/leagues/guards";
import { type LeagueSummary } from "@/lib/leagues/types";
import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { type FantasyMethodKey } from "@/lib/valuation/registry";
import {
  type FantasySearchParams,
  type FantasySortKey,
  WEIGHTED_METHOD_KEYS,
} from "@/lib/valuation/searchParams";

export const SORT_KEY_BY_METHOD: Record<FantasyMethodKey, FantasySortKey> = {
  zscore: "z",
  gscore: "g",
  points: "points",
  vorp: "vorp",
  positional: "pos",
  sgp: "sgp",
  simvalue: "sim",
};

export type FantasySeed = Partial<
  Pick<FantasySearchParams, "teams" | "slots" | "x" | "w" | "s" | "sort">
>;

// Defaults for fantasy URL params the current URL doesn't set. Explicit params
// always win — a key in presentKeys is never seeded — so shared links keep
// meaning exactly what they said.
export const buildLeagueSeed = ({
  league,
  preferredFormula,
  presentKeys,
}: {
  league: LeagueSummary | null;
  preferredFormula: FantasyMethodKey | null;
  presentKeys: ReadonlySet<string>;
}): FantasySeed => {
  const sortSeed: FantasySeed =
    presentKeys.has("sort") === false
      ? preferredFormula !== null
        ? { sort: SORT_KEY_BY_METHOD[preferredFormula] }
        : league?.scoringType === "h2h_points"
          ? { sort: "points" }
          : {}
      : {};
  if (league === null) return sortSeed;
  const sizeSeed: FantasySeed = {
    ...(presentKeys.has("teams") ? {} : { teams: league.teamCount }),
    ...(presentKeys.has("slots") ? {} : { slots: league.rosterSlots }),
  };
  const config = league.scoringConfig;
  if (isH2hPointsConfig(config)) {
    return {
      ...sortSeed,
      ...sizeSeed,
      ...(presentKeys.has("s") ? {} : { s: { ...config.scoring } }),
    };
  }
  const excluded = CATEGORY_KEYS.filter(
    (key) => !config.categories.some((included) => included === key),
  );
  const weights = "weights" in config ? (config.weights ?? {}) : {};
  const hasWeights = Object.keys(weights).length > 0;
  return {
    ...sortSeed,
    ...sizeSeed,
    ...(presentKeys.has("x") || excluded.length === 0 ? {} : { x: excluded }),
    ...(presentKeys.has("w") || !hasWeights
      ? {}
      : {
          w: WEIGHTED_METHOD_KEYS.reduce(
            (acc, method) => ({ ...acc, [method]: { ...weights } }),
            {},
          ),
        }),
  };
};
```

- [ ] **Step 4: Wire it.** In the server page that renders `FantasyValueView` (`src/app/players/page.tsx`): it already receives `searchParams`; compute `const presentKeys = new Set(Object.keys(raw))` from the awaited raw search params, fetch `const [league, profile] = ...` (`getActiveLeague()`, `getProfile()`), derive `preferredFormula` via a registry check (`const formula = ENABLED_METHODS.find((method) => method.key === profile?.preferredFormula)?.key ?? null` — no cast, `find` narrows), and pass `leagueSeed={buildLeagueSeed({ league, preferredFormula: formula, presentKeys })}` only when the fantasy tab is active. In `FantasyValueView.tsx` add the prop and a one-shot effect right after its existing `useQueryStates(fantasyParsers)` call:

```tsx
const [, setParams] = useQueryStates(fantasyParsers);
useEffect(() => {
  if (Object.keys(leagueSeed ?? {}).length === 0) return;
  void setParams(leagueSeed ?? {}, { history: "replace" });
  // Seed exactly once per mount: URL params the user changes afterwards win.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

(If the component already destructures `setParams`, reuse it.) Add a component test: render with `leagueSeed={{ teams: 10 }}` inside a nuqs testing adapter (`nuqs/adapters/testing`, pattern from existing FantasyValueView tests if present — otherwise assert via the adapter's `onUrlUpdate` spy that `teams=10` was written once).

- [ ] **Step 5: Run** `bun run test` — PASS; `bun run typecheck && bun run lint`. Manual: set a points league active, open Players → Fantasy with a bare URL, confirm sort=points and the scoring table matches; open a shared URL with `?teams=8` and confirm 8 survives.

- [ ] **Step 6: Commit** — `CV: active league seeds fantasy value defaults` with bullets.

---

### Task 12: Settings lib — preference guards + action

**Files:**

- Create: `src/lib/settings/types.ts`, `src/lib/settings/guards.ts`, `src/lib/settings/guards.test.ts`, `src/lib/settings/actions.ts`

**Interfaces:**

- Consumes: `ENABLED_METHODS`, `FantasyMethodKey` from `@/lib/valuation/registry`; `getProfile`; `prisma`.
- Produces: `FontScale`, `FONT_SCALES`, `FONT_SCALE_LABELS`, `isFontScale(value)`, `isPreferredFormula(value)`, `PreferencesActionResult = { status: "ok" } | { status: "invalid" } | { status: "unauthenticated" } | { status: "error" }`, `updatePreferences({ preferredFormula, fontScale })`.

- [ ] **Step 1: Failing tests** `guards.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { isFontScale, isPreferredFormula } from "@/lib/settings/guards";

describe("isFontScale", () => {
  it("accepts the four scales", () => {
    expect(isFontScale("sm")).toBe(true);
    expect(isFontScale("default")).toBe(true);
    expect(isFontScale("lg")).toBe(true);
    expect(isFontScale("xl")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isFontScale("xxl")).toBe(false);
    expect(isFontScale("")).toBe(false);
  });
});

describe("isPreferredFormula", () => {
  it("accepts available registry methods", () => {
    expect(isPreferredFormula("zscore")).toBe(true);
    expect(isPreferredFormula("simvalue")).toBe(true);
  });
  it("rejects unknown methods", () => {
    expect(isPreferredFormula("montecarlo")).toBe(false);
    expect(isPreferredFormula("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** `types.ts`:

```ts
export type FontScale = "sm" | "default" | "lg" | "xl";

export const FONT_SCALES: readonly FontScale[] = ["sm", "default", "lg", "xl"];

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  sm: "Small",
  default: "Default",
  lg: "Large",
  xl: "X-Large",
};

export type PreferencesActionResult =
  { status: "ok" } | { status: "invalid" } | { status: "unauthenticated" } | { status: "error" };
```

`guards.ts`:

```ts
import { FONT_SCALES, type FontScale } from "@/lib/settings/types";
import { ENABLED_METHODS, type FantasyMethodKey } from "@/lib/valuation/registry";

export const isFontScale = (value: string): value is FontScale =>
  FONT_SCALES.some((scale) => scale === value);

// Only methods the registry marks available can be a preference — an entry
// that later flips to available: false simply stops validating and the app
// falls back to defaults.
export const isPreferredFormula = (value: string): value is FantasyMethodKey =>
  ENABLED_METHODS.some((method) => method.key === value);
```

`actions.ts`:

```ts
"use server";

import { getProfile } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isFontScale, isPreferredFormula } from "@/lib/settings/guards";
import { type PreferencesActionResult } from "@/lib/settings/types";

// null preferredFormula = "no preference", falls back to app defaults.
export const updatePreferences = async ({
  preferredFormula,
  fontScale,
}: {
  preferredFormula?: string | null;
  fontScale?: string;
}): Promise<PreferencesActionResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  if (
    preferredFormula !== undefined &&
    preferredFormula !== null &&
    !isPreferredFormula(preferredFormula)
  ) {
    return { status: "invalid" };
  }
  if (fontScale !== undefined && !isFontScale(fontScale)) return { status: "invalid" };
  try {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        ...(preferredFormula === undefined ? {} : { preferredFormula }),
        ...(fontScale === undefined ? {} : { fontScale }),
      },
    });
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
};
```

Also harden the layout stamp from Task 4: `data-font-scale={isFontScale(profile?.fontScale ?? "") ? (profile?.fontScale ?? "default") : "default"}` — extract a tiny helper `fontScaleOf({ profile })` in `src/lib/settings/guards.ts` if the inline reads poorly.

- [ ] **Step 4: Run** `bun run test src/lib/settings` — PASS; `bun run typecheck`.

- [ ] **Step 5: Commit** — `CV: settings preference guards and update action` with bullets.

---

### Task 13: Font-scale tokens in globals.scss

**Files:**

- Modify: `src/styles/globals.scss`

**Interfaces:**

- Produces: attribute-scoped overrides of the five `--font-size-*` tokens for `sm`/`lg`/`xl`; `default` keeps the `:root` values. Selectors are plain `[data-font-scale="..."]` so they hit both `<html>` (app-wide) and the settings preview container (scoped preview).

- [ ] **Step 1: Add after the `:root` block** (before the `body` rules):

```scss
// User font-size preference (settings → appearance). Stamped on <html> by the
// root layout from Profile.fontScale, and on the settings preview pane for a
// scoped live preview. "default" has no block — it is the :root values above.
[data-font-scale="sm"] {
  --font-size-xs: 0.6875rem;
  --font-size-sm: 0.8125rem;
  --font-size-md: 0.9375rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.5rem;
}

[data-font-scale="lg"] {
  --font-size-xs: 0.8125rem;
  --font-size-sm: 0.9375rem;
  --font-size-md: 1.125rem;
  --font-size-lg: 1.375rem;
  --font-size-xl: 2rem;
}

[data-font-scale="xl"] {
  --font-size-xs: 0.875rem;
  --font-size-sm: 1rem;
  --font-size-md: 1.25rem;
  --font-size-lg: 1.5rem;
  --font-size-xl: 2.25rem;
}
```

- [ ] **Step 2: Verify** `bun run lint` (gale) passes; `bun dev`, set `document.documentElement.dataset.fontScale = "xl"` in the console and confirm the app scales.

- [ ] **Step 3: Commit** — `CV: font-scale token overrides` (fold into Task 14's commit if preferred — they ship together; keep separate if Task 14 runs as its own subagent).

---

### Task 14: /settings page — fantasy formula, appearance + preview, theme placeholder

**Files:**

- Create: `src/app/settings/page.tsx`, `src/app/settings/page.module.scss`, `src/components/SettingsFantasy/SettingsFantasy.tsx` (+ `.module.scss`, `.test.tsx`), `src/components/SettingsAppearance/SettingsAppearance.tsx` (+ `.module.scss`, `.test.tsx`), `src/components/SettingsTheme/SettingsTheme.tsx` (+ `.module.scss`)
- Modify: `src/components/AccountMenu/AccountMenu.tsx` (+ test if present)

**Interfaces:**

- Consumes: `updatePreferences`, `FONT_SCALES`, `FONT_SCALE_LABELS`, `isFontScale`, `FontScale` (Task 12); `ENABLED_METHODS` from the registry.
- Produces: `SettingsFantasy({ preferredFormula })` (`FantasyMethodKey | null`), `SettingsAppearance({ fontScale })`, `SettingsTheme()`; `/settings` route; a Settings link in the account menu.

- [ ] **Step 1: Failing tests.**
  - `SettingsFantasy.test.tsx` (mock `@/lib/settings/actions`): renders one radio per `ENABLED_METHODS` entry plus an "App default" radio; the prop's method starts checked; clicking another calls `updatePreferences({ preferredFormula: "gscore" })`; clicking "App default" calls it with `null`; an `error` result shows `role="alert"` copy and re-checks the previous radio.
  - `SettingsAppearance.test.tsx`: renders four radios labelled Small/Default/Large/X-Large; the preview region (`aria-label "Preview"`) carries `data-font-scale` equal to the checked radio; clicking X-Large sets `document.documentElement.dataset.fontScale` to `"xl"` and calls `updatePreferences({ fontScale: "xl" })`; an `error` result restores both the attribute and the check.
  - `AccountMenu` assertion: opening the menu shows a `menuitem` link "Settings" with `href="/settings"`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.**

`src/app/settings/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { SettingsAppearance } from "@/components/SettingsAppearance/SettingsAppearance";
import { SettingsFantasy } from "@/components/SettingsFantasy/SettingsFantasy";
import { SettingsTheme } from "@/components/SettingsTheme/SettingsTheme";
import { getProfile } from "@/lib/auth/session";
import { isFontScale, isPreferredFormula } from "@/lib/settings/guards";

import styles from "@/app/settings/page.module.scss";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/settings");
  const preferredFormula =
    profile.preferredFormula !== null && isPreferredFormula(profile.preferredFormula)
      ? profile.preferredFormula
      : null;
  const fontScale = isFontScale(profile.fontScale) ? profile.fontScale : "default";
  return (
    <main className={styles.page}>
      <h1>Settings</h1>
      <SettingsFantasy preferredFormula={preferredFormula} />
      <SettingsAppearance fontScale={fontScale} />
      <SettingsTheme />
    </main>
  );
}
```

`SettingsFantasy` (client): `<section aria-labelledby>` + `<h2>Fantasy</h2>`; `<fieldset><legend>Preferred value formula</legend>` with an "App default" radio + one per `ENABLED_METHODS` (`control-radio` mixin), each radio's label showing `method.fullName` with `method.description` as muted helper text (`aria-describedby`). Selection: optimistic local state, `void updatePreferences({ preferredFormula: key })`, revert + `role="alert"` (`Could not save — try again.`) on non-ok. Saves are immediate; no submit button.

`SettingsAppearance` (client): `<section>` + `<h2>Appearance</h2>`; two-column grid (`grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)`, collapses to one column under a container query on narrow widths): left a `<fieldset><legend>Font size</legend>` of the four radios; right the preview:

```tsx
<section className={styles.preview} aria-label="Preview" data-font-scale={selected}>
  <p className={styles.previewHeading}>Court Vision</p>
  <p className={styles.previewBody}>
    Nikola Jokić is averaging a 26/12/9 line over his last 10 games.
  </p>
  <table className={styles.previewTable}>
    <thead>
      <tr>
        <th scope="col">Player</th>
        <th scope="col">PTS</th>
        <th scope="col">REB</th>
        <th scope="col">AST</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>N. Jokić</td>
        <td>26.4</td>
        <td>12.1</td>
        <td>9.2</td>
      </tr>
    </tbody>
  </table>
</section>
```

with `.previewHeading` at `--font-size-xl`/`--font-display`, `.previewBody` at `--font-size-md`, table cells at `--font-size-sm` — all resolve against the preview's own `data-font-scale`. On change: set local state, set `document.documentElement.dataset.fontScale = value` (optimistic, app-wide immediately), call `updatePreferences({ fontScale: value })`, revert both on failure.

`SettingsTheme`: static server-safe component — `<section>` + `<h2>Theme</h2>` + `<p>Something soon.</p>` styled muted.

`AccountMenu`: inside the dropdown, above the sign-out form, add `<Link href="/settings" role="menuitem" className={styles.settingsLink} onClick={() => setOpen(false)}>Settings</Link>` (import `Link` from `next/link`; add the class to the module mirroring `.signout`'s styling).

- [ ] **Step 4: Run** `bun run test` — PASS; `bun run typecheck && bun run lint`. Manual: change font size, hard-reload — no flash, scale persists; sign out — scale returns to default; formula preference changes the fantasy tab's default sort (Task 11 path).

- [ ] **Step 5: Commit** — `CV: settings page with formula, font-scale preview, theme placeholder` with bullets.

---

### Task 15: Full-suite verification + spec sync

- [ ] **Step 1:** `bun run system-check` (format:check, lint, typecheck, test, build) — all green. Fix anything it surfaces.
- [ ] **Step 2:** Manual end-to-end pass: signup-fresh profile gets "My League" on first star/team; create a second league (roto), switch actives, confirm `/my-teams`, `/watchlist`, fantasy defaults, and the home panels all re-scope; delete the active league and confirm fallback.
- [ ] **Step 3:** Re-read `docs/superpowers/specs/2026-07-31-league-containers-design.md`; note any implementation deviations in a short "Implementation notes" section appended to the spec.
- [ ] **Step 4:** Commit any fixes — `CV: league containers polish pass`.

---

## Self-Review Notes (already applied)

- Spec coverage: schema+RLS+backfill (T2), caps (T2/T3), switcher + nav (T5), `/leagues` CRUD UI (T6/T7), teams off localStorage + migrator (T8–T10), watchlist re-scope (T2), valuation seeding incl. preferred formula (T11), settings incl. preview + theme placeholder + account-menu link (T12–T14), a11y + tokens (global constraints).
- Type consistency: `LeagueSummary`/`LeagueScoringConfig` (T1) consumed by T2–T7, T11; `FantasyTeam`/`RosterSlot` reused from `lib/fantasyTeams/types` everywhere; `FontScale` (T12) consumed by T13/T14; result unions all follow the watchlist pattern.
- Known judgment calls: no zustand store for teams (server props + refresh suffice — YAGNI vs. spec's looser wording); `SettingsFantasy`'s "App default" maps to `preferredFormula: null`; roto seeds no sort.
