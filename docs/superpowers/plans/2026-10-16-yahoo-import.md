# Yahoo League Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user pastes a public Yahoo Fantasy Basketball league URL, picks their team, and Court Vision imports the league's settings, teams, logos and rosters, keeps them in sync, and shows them read-only in My Teams.

**Architecture:** A provider adapter under `apps/court-vision/src/lib/yahoo/` layered like `lib/balldontlie/`: `client` (fetch) → `schemas` (zod) → `transform` + `settings` (pure, the only code that knows Yahoo field names) → `matchPlayers` (Yahoo player → `Player.id`) → `persist` (one transaction) → `actions` (server actions in `withProfile`). Additive Prisma changes mark a league's provider, its external keys and the user's own team. Existing league code learns three rules: "yours" means `myTeamId`, imported teams are read-only, imported scoring is not user-editable.

**Tech Stack:** Next.js App Router (read `node_modules/next/dist/docs/` before Next code), React 19, Prisma 7.10 on Supabase Postgres, zod 4.6.5, bun:test with the `vi` shim.

**Spec:** `docs/superpowers/specs/2026-10-16-yahoo-league-import-design.md` (phases 0 and 1). Mockup beside it. Plans for phase 2 (`2026-10-16-waiver-wire.md`) and phase 3 (`2026-10-16-yahoo-extension.md`) build on the interfaces this plan produces.

## Global Constraints

- House rules in `CLAUDE.md` apply to every line: no relative imports (`@/`, `#<lib>/`, `@vision/*`), type aliases not interfaces, no `any`, no casts, named exports, single object parameters, `Array.prototype` methods instead of loops, `!!x &&` in JSX, `?.` always paired with `??`, every type guard unit tested.
- Tests: co-located, `import { … vi } from "bun:test"`, `it` not `test`, behavior-sentence names, never bare `bun test`. One file: `bun run --cwd apps/court-vision test <path>`.
- Yahoo host: `https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2`, always `format=json_f`. No test calls Yahoo live.
- Provider string: `"yahoo"`; hand-built leagues: `"manual"`.
- The shared `PlayerExternalId` table is written only from data the server fetched itself.
- No Yahoo credentials or cookies are ever stored or sent by the server.
- Styles: SCSS modules, tokens from `@vision/ui` `styles/globals.scss`, `keycap` mixins for every pressable control, `table-wrapper` + `data-table` + `numeric-cell` for tables, no glows.
- User-facing copy is exactly as written in this plan (it is the spec's).
- Commits: only after the user has authorized committing for the execution session (CLAUDE.md). Messages follow the `commit-format` skill (`CV:` prefix, `-` bullets, backticked identifiers, no agent attribution).
- Pushing (needed for the phase 0 deploy preview) and applying migrations to Supabase need the user's go-ahead first.

## Review Focus

1. **A roster player whose `selected_position` is missing or unknown** (Yahoo's `NA`, a new slot) must land on the bench, not fail the import. Pinned in Task 6.
2. **Two Yahoo players that normalize to the same Court Vision name**, or one Yahoo name shared by two active players, must never both map to one `Player.id`; the ambiguous side stays unmatched. Pinned in Task 8.
3. **A re-sync after a trade and a team rename** must leave each player on exactly one team, keep slugs and `myTeamId`, and leave no orphan slot rows. Pinned in Task 9.
4. **A pasted URL with whitespace, no scheme, a trailing team id, a query (`?lhst=stand`) or a hash** must still parse. Pinned in Task 2.
5. **Yahoo answering 200 with something that isn't `fantasy_content`** (an HTML error page, `{ "error": … }`) must surface as the "couldn't read" message, never a 500. Pinned in Tasks 3 and 9.

---

### Task 0: Reachability probe from Netlify (throwaway)

Decides whether the server path can work in production at all. Do this before any other task.

**Files:**

- Create: `apps/court-vision/src/app/api/yahoo-probe/route.ts` (deleted at the end of this task)

- [ ] **Step 1: Write the probe route.** `export async function GET(): Promise<Response>` fetches `https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/league/478.l.1000?format=json_f` with a 15 s timeout and returns `Response.json({ status, ok, bytes, hasFantasyContent })`. No auth, no secrets, no query params.
- [ ] **Step 2: Get a deploy preview.** Ask the user to approve pushing `yahoo-importer` (the PR already exists, so Netlify builds `deploy-preview-<PR>--court-vizion.netlify.app`). Wait for the deploy to finish.
- [ ] **Step 3: Call it three times, a minute apart.**
      Run: `curl -s https://deploy-preview-<PR>--court-vizion.netlify.app/api/yahoo-probe`
      Expected for "go": `{"status":200,"ok":true,…,"hasFantasyContent":true}` every time.
- [ ] **Step 4: Decide.** If any call returns 999, 403 or a timeout, stop and tell the user: the server path is blocked, phase 3 (extension) becomes the import path, and the official Yahoo API application becomes urgent. Do not continue this plan until they decide.
- [ ] **Step 5: Delete the route** and record the result (status codes, date) in the spec's Risks section under "Yahoo blocks Netlify's IPs".
- [ ] **Step 6: Commit** (`CV: record Yahoo reachability from Netlify`), spec change only.

---

### Task 1: Shared name match key

`lib/headshots/map.ts` already has the right key (diacritics stripped, only `a-z0-9` and single spaces). Lift it into core so Yahoo matching uses the identical rule.

**Files:**

- Modify: `libs/vision-core/src/util/names.ts`, `libs/vision-core/src/util/names.test.ts`
- Modify: `apps/court-vision/src/lib/headshots/map.ts:25-30` (delete local `matchKey`, call the new export)

**Interfaces:**

- Produces: `nameMatchKey({ name }: { name: string }): string` from `@vision/core/util/names`.

- [ ] **Step 1: Write the failing tests** in `names.test.ts`:
  - `it("reduces names that differ only in punctuation and accents to one key")`: `nameMatchKey({ name: "A.J. Green" })` equals `nameMatchKey({ name: "AJ Green" })`; `"Egor Dëmin"` → `"egor demin"`; `"Kristaps Porziņģis"` → `"kristaps porzingis"`; `"Wendell Carter Jr."` → `"wendell carter jr"`; `"  De'Aaron   Fox "` → `"deaaron fox"`.
- [ ] **Step 2: Run** `bun run --cwd libs/vision-core test src/util/names.test.ts` → FAIL (`nameMatchKey` not exported).
- [ ] **Step 3: Implement `nameMatchKey`** as `normalizeName` then `.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()`; switch `map.ts` to it.
- [ ] **Step 4: Run** the names test and `bun run --cwd apps/court-vision test src/lib/headshots` → PASS.
- [ ] **Step 5: Commit** `CV: share \`nameMatchKey\` from core`.

---

### Task 2: League URL parser

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/constants.ts`, `apps/court-vision/src/lib/yahoo/url.ts`, `apps/court-vision/src/lib/yahoo/url.test.ts`

**Interfaces:**

- Produces (`constants.ts`): `YAHOO_PROVIDER = "yahoo"`, `YAHOO_API_BASE_URL = "https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2"`, `YAHOO_LEAGUE_HOST = "basketball.fantasysports.yahoo.com"`, `YAHOO_PAGE_SIZE = 25`, `YAHOO_MAX_WAIVER_PAGES = 10`, `YAHOO_SYNC_THROTTLE_MS = 60_000`, `YAHOO_STALE_AFTER_MS = 900_000`.
- Produces (`url.ts`):

  ```ts
  export type YahooUrlParse =
    | { status: "ok"; leagueId: string }
    | { status: "past_season"; season: number }
    | { status: "wrong_sport" }
    | { status: "invalid" };
  export const parseYahooLeagueUrl: ({ input }: { input: string }) => YahooUrlParse;
  ```

- [ ] **Step 1: Write the failing tests.** Table-driven `it.each`, one behavior sentence per group:
  - ok `"106344"`: `"106344"`, `" 106344 "`, `"https://basketball.fantasysports.yahoo.com/nba/106344"`, `"basketball.fantasysports.yahoo.com/nba/106344"`, `"http://basketball.fantasysports.yahoo.com/nba/106344/"`, `".../nba/106344/5"`, `".../nba/106344/players?status=A"`, `".../nba/106344?lhst=stand#standings"`.
  - past_season: `".../2025/nba/91581"` → `{ status: "past_season", season: 2025 }`; `".../archive/nba/2019/1234"` → season 2019.
  - wrong_sport: `"https://football.fantasysports.yahoo.com/f1/12345"`, `"https://hockey.fantasysports.yahoo.com/hockey/123"`.
  - invalid: `""`, `"abc"`, `"https://espn.com/nba/106344"`, `"https://basketball.fantasysports.yahoo.com/nba"`, `"https://basketball.fantasysports.yahoo.com/nba/abc"`, `"12345678901"` (more than 9 digits).
- [ ] **Step 2: Run** `bun run --cwd apps/court-vision test src/lib/yahoo/url.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement.** Bare id: `/^\d{1,9}$/`. Otherwise prefix `https://` when there is no scheme, parse with `URL` (catch → invalid), lowercase host. Host `YAHOO_LEAGUE_HOST` → read path segments; another `*.fantasysports.yahoo.com` host → `wrong_sport`; anything else → `invalid`. Segment shapes: `["nba", id, …]`, `[yyyy, "nba", id, …]`, `["archive", "nba", yyyy, id, …]`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: parse Yahoo league URLs`.

---

### Task 3: Yahoo client

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/client.ts`, `apps/court-vision/src/lib/yahoo/client.test.ts`

**Interfaces:**

- Consumes: `YAHOO_API_BASE_URL`; `FetchImpl` from `@vision/core/util/fetchImpl`.
- Produces:

  ```ts
  export type YahooFetchResult =
    | { status: "ok"; body: unknown }
    | { status: "not_found" }
    | { status: "unavailable"; detail: string };
  export const yahooFetch: (args: {
    path: string; // e.g. "league/478.l.106344;out=settings/teams/roster"
    fetchImpl?: FetchImpl;
    sleep?: (ms: number) => Promise<void>;
    maxRetries?: number; // default 2
    timeoutMs?: number; // default 15_000
  }) => Promise<YahooFetchResult>;
  ```

- [ ] **Step 1: Write the failing tests** with `vi.fn<FetchImpl>()` and a no-op `sleep`:
  - `it("requests json_f from the read-only host")`: called with `${YAHOO_API_BASE_URL}/game/nba?format=json_f`; a path that already has `?` gets `&format=json_f`.
  - `it("returns the parsed body on 200")`.
  - `it("reports a 400 as not_found without retrying")`: one call.
  - `it("retries 5xx and 999 then reports unavailable")`: 3 calls with `maxRetries: 2`, result `unavailable`.
  - `it("retries a body that is not JSON")`: first 200 `"<html>"`, second valid JSON → ok.
  - `it("never throws when fetch rejects")`: `TypeError` every time → `unavailable`.
- [ ] **Step 2: Run** `… test src/lib/yahoo/client.test.ts` → FAIL.
- [ ] **Step 3: Implement** after `lib/balldontlie/client.ts` (AbortController timeout, `2 ** n * 500` backoff), but returning results instead of throwing. Any other 4xx → `unavailable` with the status in `detail`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: add the Yahoo read-only client`.

---

### Task 4: Fixtures and zod schemas

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/fixtures/game-nba.json`, `league-106344.json`, `league-1000.json`, `waivers-106344.json`
- Create: `apps/court-vision/src/lib/yahoo/schemas.ts`, `apps/court-vision/src/lib/yahoo/schemas.test.ts`

**Interfaces:**

- Produces: `yahooGameSchema`, `yahooLeagueSnapshotSchema`, `yahooPlayersPageSchema` and their inferred types `YahooGame`, `YahooLeagueSnapshot`, `YahooLeague` (= snapshot's `fantasy_content.league`), `YahooTeam`, `YahooPlayer`, `YahooPlayersPage`.

`json_f` shapes, verified 2026-10-16: collections are arrays of single-key wrappers (`teams: [{ team }]`, `roster.players: [{ player }]`, `stat_categories.stats: [{ stat }]`, `roster_positions: [{ roster_position }]`, `team_logos: [{ team_logo: { size, url } }]`, `managers: [{ manager }]`, `eligible_positions: [{ position }]`). Ids and flags mix numbers and strings (`stat_id` is a number, `team_id` a string, flags `0`/`1`/`"0"`/`"1"`), and `is_highscore` / `stat_modifiers` can be `null`.

- [ ] **Step 1: Record fixtures** (minified, headshots stripped to keep them ~150 KB):
  ```bash
  cd apps/court-vision/src/lib/yahoo/fixtures
  B=https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2
  STRIP='del(.. | .headshot?, .image_url?, .eligible_positions_to_add?, .player_notes_last_timestamp?)'
  curl -s "$B/game/nba?format=json_f" | jq -c . > game-nba.json
  curl -s "$B/league/478.l.106344;out=settings/teams/roster?format=json_f" | jq -c "$STRIP" > league-106344.json
  curl -s "$B/league/478.l.1000;out=settings/teams/roster?format=json_f" | jq -c "$STRIP" > league-1000.json
  curl -s "$B/league/478.l.106344/players;status=W;start=0;count=25?format=json_f" | jq -c "$STRIP" > waivers-106344.json
  ```
- [ ] **Step 2: Write the failing tests:**
  - `it("parses both recorded league snapshots")`: 106344 has 12 teams, team 1 named `"Better Call Gasol"`, 13 roster players, `settings.stat_categories.stats` length 11.
  - `it("parses the current game")`: `game_key` `"478"`, `season` `2026`.
  - `it("parses a players page, including an empty one")`: the waiver fixture; `{ fantasy_content: { league: { players: [] } } }` and a page with no `players` key both give `[]`.
  - `it("treats null is_highscore and stat_modifiers as absent")`.
  - `it("rejects a body without fantasy_content")`: `{ error: { description: "x" } }` fails `safeParse`.
- [ ] **Step 3: Run** `… test src/lib/yahoo/schemas.test.ts` → FAIL.
- [ ] **Step 4: Implement schemas.** Unknown keys are stripped (default `z.object`). Coerce ids to `string`, counts and `stat_id`/`season` to `number`. A `yahooFlag` schema maps `0|1|"0"|"1"|true|false|null|undefined` → `boolean`. Fields read: league `league_key, league_id, name, url, logo_url, num_teams, season, scoring_type, is_highscore, settings.{roster_positions, stat_categories, stat_modifiers}, teams`; team `team_key, name, team_logos, managers[].manager.nickname, is_owned_by_current_login, roster.players`; player `player_id, name.full, editorial_team_abbr, eligible_positions, status, selected_position.position`. `stat_modifiers` is `z.object({ stats: z.array(z.object({ stat: z.object({ stat_id, value }) })) }).nullish()`. Its shape is unverified (no points-league sample yet); the transform test in Task 6 uses a hand-made one.
- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `CV: add Yahoo fixtures and \`json_f\` schemas`.

---

### Task 5: Settings mapping

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/settings.ts`, `apps/court-vision/src/lib/yahoo/settings.test.ts`

**Interfaces:**

- Consumes: `YahooLeague`; `Category`, `ScoringStatKey`, `RosterSlotType`, `LeagueScoringConfig` from `@vision/sport-basketball/types`; `LeagueScoringType` from `@vision/core/league/scoring`; `clampInt`, `LEAGUE_BOUNDS` from `@/lib/leagues/settings`.
- Produces:

  ```ts
  export const YAHOO_CATEGORY_BY_STAT_ID: Readonly<Record<number, Category>>;
  // { 5: "fg", 8: "ft", 10: "tpm", 12: "pts", 15: "reb", 16: "ast", 17: "stl", 18: "blk", 19: "tov" }
  export const YAHOO_POINTS_KEY_BY_STAT_ID: Readonly<Record<number, ScoringStatKey>>;
  // { 12: "pts", 15: "reb", 16: "ast", 17: "stl", 18: "blk", 10: "fg3m", 19: "tov" }
  export const YAHOO_SLOT_BY_POSITION: Readonly<Record<string, RosterSlotType>>;
  // PG SG G SF PF F C as-is, Util → UTIL, BN → BENCH, IL → IL, "IL+" → ILPLUS
  export const toSlotType: ({ position }: { position: string | null }) => RosterSlotType; // unknown or null → "BENCH"
  export type MappedScoring = {
    scoringType: LeagueScoringType;
    scoringConfig: LeagueScoringConfig;
    unsupportedCategories: string[]; // Yahoo display names, in Yahoo's order
  };
  export type MappedSettings =
    | {
        status: "ok";
        scoring: MappedScoring;
        slotLayout: RosterSlotType[];
        rosterSlots: number;
        teamCount: number;
      }
    | { status: "unsupported"; reason: "highscore" | "scoring_type" };
  export const mapLeagueSettings: ({ league }: { league: YahooLeague }) => MappedSettings;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `it("maps Game of Courts to 9-cat head-to-head")`: fixture 106344 → `scoringType: "h2h_categories"`, `scoringConfig: { categories: ["fg","ft","tpm","pts","reb","ast","stl","blk","tov"] }` (Yahoo order), `unsupportedCategories: []`, `teamCount: 12`, `rosterSlots: 13`, `slotLayout` = `PG SG G G G SF PF F F C UTIL UTIL UTIL IL IL`.
  - `it("skips display-only stats")`: FGM/A (9004003) and FTM/A (9007006) appear in neither list.
  - `it("drops an unsupported category and names it")`: the fixture with an extra `{ stat_id: 23, display_name: "DD" }` → `unsupportedCategories: ["DD"]`, categories unchanged.
  - `it("maps roto")`: `scoring_type: "roto"` → `"roto"`, `{ categories }` with no weights.
  - `it("maps points modifiers and zero-fills the rest")`: `scoring_type: "headpoint"`, modifiers `{12: 1, 15: 1.2, 19: -1, 23: 2}` → `h2h_points`, `scoring: { pts: 1, reb: 1.2, ast: 0, stl: 0, blk: 0, fg3m: 0, tov: -1 }`, `unsupportedCategories: ["DD"]` (display name looked up in `stat_categories`).
  - `it("refuses High Score and unknown scoring types")`: `is_highscore: "1"` → `{ status: "unsupported", reason: "highscore" }`; `scoring_type: "weird"` → `reason: "scoring_type"`.
  - `it("treats an unknown position as bench")`: `toSlotType({ position: "NA" })` and `toSlotType({ position: null })` → `"BENCH"`.
- [ ] **Step 2: Run** `… test src/lib/yahoo/settings.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Scoring types: `head` → `h2h_categories`, `roto` → `roto`, `headpoint` and `point` → `h2h_points`; anything else → unsupported. Layout expands each `roster_position` by `count`. `rosterSlots` = layout entries other than `IL`/`ILPLUS`, clamped with `LEAGUE_BOUNDS.slots`; `teamCount` = `num_teams` clamped with `LEAGUE_BOUNDS.teams`. The returned config must pass `parseScoringConfig` unchanged; assert that in the tests.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: map Yahoo league settings onto the basketball descriptor`.

---

### Task 6: Transform a snapshot into an `ImportedLeague`

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/types.ts`, `apps/court-vision/src/lib/yahoo/transform.ts`, `apps/court-vision/src/lib/yahoo/transform.test.ts`

**Interfaces:**

- Consumes: `YahooLeagueSnapshot`, `YahooPlayersPage` (Task 4); `mapLeagueSettings`, `toSlotType`, `MappedScoring` (Task 5).
- Produces (`types.ts`):
  ```ts
  export type YahooPlayerRef = {
    yahooPlayerId: string; // "6404"
    fullName: string;
    teamAbbr: string | null; // Yahoo's abbreviations equal Balldontlie's (all 30 checked 2026-10-16)
    eligiblePositions: string[];
    status: string | null; // "Q", "O", "INJ", "P", … or null
  };
  export type ImportedSlot = { slotType: RosterSlotType; player: YahooPlayerRef | null };
  export type ImportedTeam = {
    externalKey: string; // "478.l.106344.t.5"
    name: string;
    logoUrl: string | null;
    managerName: string | null; // null when Yahoo sends "--hidden--"
    isOwnedByCurrentLogin: boolean;
    slots: ImportedSlot[];
  };
  export type ImportedLeague = {
    externalKey: string; // "478.l.106344"
    externalUrl: string;
    name: string;
    logoUrl: string | null;
    season: number;
    teamCount: number;
    rosterSlots: number;
    scoring: MappedScoring;
    teams: ImportedTeam[];
  };
  ```
- Produces (`transform.ts`):

  ```ts
  export type TransformResult =
    | { status: "ok"; league: ImportedLeague }
    | { status: "unsupported"; reason: "highscore" | "scoring_type" };
  export const toImportedLeague: ({
    snapshot,
  }: {
    snapshot: YahooLeagueSnapshot;
  }) => TransformResult;
  export const toPlayerRefs: ({
    pages,
  }: {
    pages: readonly YahooPlayersPage[];
  }) => YahooPlayerRef[];
  ```

- [ ] **Step 1: Write the failing tests** against fixture 106344:
  - `it("imports every team with its name, logo and roster")`: 12 teams; team `478.l.106344.t.5` is `"Newfoundlanders"`, `logoUrl` starts `https://yahoofantasysports-res.cloudinary.com/`, `managerName: null`, 15 slots (13 layout + 2 IL), 13 filled.
  - `it("seats each player in the slot Yahoo selected")`: Newfoundlanders' first slot is `{ slotType: "PG", player.fullName: "Ty Jerome" }`; `"Kevin Durant"` sits in a `G` slot.
  - `it("appends overflow and unknown-position players as extra slots")` (Review Focus 1): a team with 3 players selected at `C` against a layout of one `C` gets two appended `C` slots; a player with no `selected_position` gets an appended `BENCH` slot.
  - `it("reads injury status and eligibility")`: `"Anthony Black"` has `status: "Q"`, `eligiblePositions` `["PG","SG","G","SF","F","Util"]`.
  - `it("passes unsupported settings through")`: `is_highscore: "1"` → `{ status: "unsupported", reason: "highscore" }`.
  - `it("flattens waiver pages into refs")`: `toPlayerRefs` on the waiver fixture page twice gives each player once (dedupe by `yahooPlayerId`).
- [ ] **Step 2: Run** `… test src/lib/yahoo/transform.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Seat players in roster order: fill the first empty layout slot of `toSlotType(selected_position)`, else append a slot of that type. `isOwnedByCurrentLogin` is the parsed flag (false when absent).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: transform Yahoo snapshots into imported leagues`.

---

### Task 7: Schema and migration

**Files:**

- Modify: `apps/court-vision/prisma/schema.prisma`
- Create: `apps/court-vision/prisma/migrations/20261016000000_yahoo_league_import/migration.sql`

**Interfaces:**

- Produces (Prisma models):
  - `League` + `provider String @default("manual")`, `externalKey String?`, `externalUrl String?`, `myTeamId String? @unique` with `myTeam LeagueTeam? @relation("MyTeam", fields: [myTeamId], references: [id], onDelete: SetNull)`, `syncedAt DateTime?`, `syncError String?`, `unsupportedCategories String[] @default([])`, `waivers LeagueWaiverPlayer[]`, `@@unique([profileId, provider, externalKey])`. (Name the existing `teams` relation `@relation("LeagueTeams")` on both sides, since `LeagueTeam` now has two relations to `League`.)
  - `LeagueTeam` + `externalKey String?`, `logoUrl String?`, `managerName String?`, `myTeamOf League? @relation("MyTeam")`, `@@unique([leagueId, externalKey])`.
  - `LeagueTeamSlot` + `externalPlayerKey String?`, `externalPlayerName String?`, `injuryStatus String?` (Yahoo's `status`: "Q", "O", "INJ", "P", …; refreshed every sync).
  - `PlayerExternalId { provider String; externalId String; playerId Int; player Player @relation(…, onDelete: Cascade); method String; eligiblePositions String[] @default([]); updatedAt DateTime @updatedAt; @@id([provider, externalId]); @@index([playerId]) }`, plus `externalIds PlayerExternalId[]` on `Player`.
  - `LeagueWaiverPlayer { leagueId String; league League @relation(…, onDelete: Cascade); playerId Int; player Player @relation(…, onDelete: Cascade); profileId String @db.Uuid; injuryStatus String?; @@id([leagueId, playerId]); @@index([profileId]) }`, plus `leagueWaivers LeagueWaiverPlayer[]` on `Player`.

- [ ] **Step 1: Edit `schema.prisma`** as above, with a comment on each new model in the file's existing style (why it exists, who writes it).
- [ ] **Step 2: Generate the SQL without touching a database:**
  ```bash
  cd apps/court-vision
  git show main:apps/court-vision/prisma/schema.prisma > "$TMPDIR/schema-before.prisma"
  mkdir -p prisma/migrations/20261016000000_yahoo_league_import
  bunx prisma migrate diff --from-schema "$TMPDIR/schema-before.prisma" --to-schema prisma/schema.prisma --script > prisma/migrations/20261016000000_yahoo_league_import/migration.sql
  ```
  Expected: `ALTER TABLE` statements for the three models and `CREATE TABLE` for the two new ones.
- [ ] **Step 3: Append RLS** to the migration, following `20260806001000_username_and_league_rls_hardening`:
  - `PlayerExternalId`: `enable row level security`; no policies (server-only, Prisma bypasses RLS).
  - `LeagueWaiverPlayer`: enable RLS; owner `select` and `delete` on `auth.uid() = "profileId"`; `insert` with check `auth.uid() = "profileId" AND EXISTS (SELECT 1 FROM "League" l WHERE l.id = "leagueId" AND l."profileId" = auth.uid())`.
- [ ] **Step 4: Regenerate the client.** Run `bun run --cwd apps/court-vision db:generate` → succeeds. Then `bun run --cwd apps/court-vision typecheck` → PASS (nothing reads the new fields yet).
- [ ] **Step 5: Apply.** Ask the user before applying to Supabase. With approval: `cd apps/court-vision && DATABASE_URL=$(grep '^DIRECT_URL' .env | cut -d'"' -f2) bunx prisma migrate deploy`, then `bunx prisma migrate status` → "Database schema is up to date".
- [ ] **Step 6: Commit** `CV: add provider, external keys and my-team to leagues`.

---

### Task 8: Player matching

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/matchPlayers.ts`, `apps/court-vision/src/lib/yahoo/matchPlayers.test.ts`

**Interfaces:**

- Consumes: `YahooPlayerRef` (Task 6); `nameMatchKey` (Task 1); `PlayerExternalId` (Task 7).
- Produces:

  ```ts
  export type MatchCandidate = { id: number; fullName: string; teamAbbr: string | null };
  export type MatchMethod = "name_team" | "name_only";
  export type MatchOutcome =
    | { status: "matched"; playerId: number; method: MatchMethod | "existing" }
    | { status: "unmatched" };
  export const matchPlayer: (args: {
    ref: YahooPlayerRef;
    candidates: readonly MatchCandidate[];
    existing: MatchCandidate | null; // the Player a stored mapping points at
  }) => MatchOutcome;
  export type ResolvedPlayers = {
    byYahooId: ReadonlyMap<string, number>;
    unmatched: YahooPlayerRef[];
  };
  export const resolveYahooPlayers: (args: {
    refs: readonly YahooPlayerRef[];
    writeMappings: boolean; // true only on the server path
  }) => Promise<ResolvedPlayers>;
  ```

- [ ] **Step 1: Write the failing tests.** `matchPlayer` is pure; `resolveYahooPlayers` mocks `@/lib/prisma` the way `lib/leagues/actions.test.ts` does (`player.findMany`, `playerExternalId.findMany`, `.upsert`, `.deleteMany`).
  - `it("keeps a stored mapping whose name still agrees")` → `method: "existing"`.
  - `it("drops a stored mapping whose name no longer agrees and rematches")`: existing points at "Jalen Smith", ref is "Jalen Green" → matched by name+team to the right id; with `writeMappings: true` the stale row is deleted and the new one upserted.
  - `it("matches on name and team")`, `it("matches on name alone when exactly one active player has it")` → `name_only`.
  - `it("leaves ambiguous names unmatched")` (Review Focus 2): two candidates share the name and neither team matches → unmatched.
  - `it("never maps two Yahoo players to one Court Vision player")` (Review Focus 2): two refs that both resolve to id 7 → both unmatched.
  - `it("matches accented names")`: ref "Egor Dëmin" vs candidate "Egor Demin".
  - `it("writes nothing when writeMappings is false")`: no `upsert` or `deleteMany` calls, matches still returned.
  - `it("refreshes eligible positions on stored mappings")`: `upsert` carries the ref's `eligiblePositions`.
- [ ] **Step 2: Run** `… test src/lib/yahoo/matchPlayers.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Candidates are `Player` rows with `isActive: true` (`select: { id, fullName, teamAbbr }`). Stored mappings are loaded for all refs in one `findMany` with `include: { player: { select: { id, fullName, teamAbbr } } }`. Order: existing (if names agree) → name + team → name only (exactly one candidate). After matching, any `playerId` claimed by more than one ref is unmatched for all of them. With `writeMappings`, upsert `{ provider: "yahoo", externalId, playerId, method, eligiblePositions }` for new and existing matches and delete stale rows, in one `$transaction([...])`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: match Yahoo players to Court Vision players`.

---

### Task 9: Load and persist

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/load.ts`, `apps/court-vision/src/lib/yahoo/load.test.ts`
- Create: `apps/court-vision/src/lib/yahoo/persist.ts`, `apps/court-vision/src/lib/yahoo/persist.test.ts`

**Interfaces:**

- Consumes: `yahooFetch` (Task 3), schemas (Task 4), `toImportedLeague`/`toPlayerRefs` (Task 6), `ResolvedPlayers` (Task 8).
- Produces (`load.ts`):
  ```ts
  export type YahooLoadFailure =
    | { status: "not_found" }
    | { status: "unavailable" }
    | { status: "invalid_payload" }
    | { status: "past_season" }
    | { status: "unsupported"; reason: "highscore" | "scoring_type" };
  export type YahooLoadResult =
    { status: "ok"; league: ImportedLeague; waiverRefs: YahooPlayerRef[] } | YahooLoadFailure;
  export const loadYahooLeague: (args: {
    leagueId: string;
    fetchImpl?: FetchImpl;
  }) => Promise<YahooLoadResult>;
  // Shared with the extension path (phase 3): validates raw bodies and transforms them.
  export const parseYahooPayload: (args: {
    currentSeason: number;
    snapshot: unknown;
    waiverPages: readonly unknown[];
  }) => YahooLoadResult;
  ```
- Produces (`persist.ts`):

  ```ts
  export type PersistArgs = {
    tx: Prisma.TransactionClient;
    profileId: string;
    league: ImportedLeague;
    resolved: ResolvedPlayers;
    waiverRefs: readonly YahooPlayerRef[];
  };
  export const createImportedLeague: (
    args: PersistArgs & { myTeamExternalKey: string },
  ) => Promise<League>;
  export const syncImportedLeague: (args: PersistArgs & { leagueId: string }) => Promise<League>;
  ```

- [ ] **Step 1: Write the failing load tests** with a fetch stub that serves the fixtures by path:
  - `it("loads a league, its settings and its waiver list")`: requests `game/nba`, then `league/478.l.106344;out=settings/teams/roster`, then `league/478.l.106344/players;status=W;start=0;count=25`; returns 12 teams.
  - `it("pages the waiver list until a short page")`: pages of 25, 25, 3 → three requests, 53 refs; never more than `YAHOO_MAX_WAIVER_PAGES` requests.
  - `it("maps a 400 to not_found")`.
  - `it("rejects a league from another season")`: game season 2027 vs snapshot 2026 → `past_season`.
  - `it("reports a 200 that isn't fantasy_content as invalid_payload")` (Review Focus 5).
- [ ] **Step 2: Implement `load.ts`.** Wrap the `game/nba` fetch in `unstable_cache` (key `["yahoo-nba-game"]`, `revalidate: 86_400`), following `lib/players/seasonPool.ts`; its test shows how `next/cache` is mocked. `parseYahooPayload` does the `safeParse`, season check and transform, so the extension path in phase 3 reuses it.
- [ ] **Step 3: Write the failing persist tests** with a mocked transaction client:
  - `it("creates the league, teams, slots and waivers in one transaction")`: league `provider: "yahoo"`, `externalKey: "478.l.106344"`, settings from `league.scoring`, `syncedAt` set; 12 `leagueTeam.create`s with `externalKey`, `logoUrl`, `managerName` and a unique slug; slots carry `playerId` for matched players and `externalPlayerKey`/`externalPlayerName` for unmatched ones, and every filled slot carries `injuryStatus` from the ref (`"Q"` for Anthony Black's slot); `myTeamId` is the id created for `myTeamExternalKey`; the profile's `activeLeagueId` is set to the new league.
  - `it("re-syncs by external key")` (Review Focus 3): existing teams are upserted on `leagueId_externalKey` (slug unchanged, name and logo updated), every team's slots are deleted and rewritten, teams whose key vanished are deleted, `myTeamId` untouched, waivers replaced, `syncedAt` updated and `syncError` cleared, and the league `name` is left alone.
  - `it("stores only matched waiver players, with their injury status")`.
- [ ] **Step 4: Implement `persist.ts`.** Slot rows reuse `profileId` like `writeSlots` in `teamActions.ts`; positions are the slot's index in the team. The cap check lives in the action, not here.
- [ ] **Step 5: Run** `… test src/lib/yahoo/load.test.ts src/lib/yahoo/persist.test.ts` → PASS.
- [ ] **Step 6: Commit** `CV: load and persist Yahoo leagues`.

---

### Task 10: Existing league code learns about imported leagues

**Files:**

- Modify: `apps/court-vision/src/lib/leagues/types.ts`, `queries.ts`, `teamQueries.ts`, `teams.ts`, `teamActions.ts`, `actions.ts`, `format.ts` and their tests
- Modify: `apps/court-vision/src/lib/fantasyTeams/types.ts`

**Interfaces:**

- Produces:
  - `LeagueProvider = "manual" | "yahoo"` and `isLeagueProvider(value: string): value is LeagueProvider` in `lib/leagues/types.ts` (guard tested).
  - `LeagueSummary` + `provider: LeagueProvider`, `externalUrl: string | null`, `myTeamId: string | null`, `syncedAt: string | null` (ISO), `syncError: string | null`, `unsupportedCategories: string[]`.
  - `FantasyTeam` + `logoUrl: string | null`, `managerName: string | null`, `isMine: boolean`, `isImported: boolean`, `unmatchedBySlotId: Record<string, string>` (slot id → Yahoo player name).
  - `rowsToTeamSlots({ rows }): { slots: RosterSlot[]; unmatchedBySlotId: Record<string, string> }` in `teams.ts`, where `LeagueTeamSlotRow` gains `externalPlayerName: string | null`. `rowsToSlots` stays as `rowsToTeamSlots(…).slots`.
  - `formatLeagueMeta({ league }: { league: Pick<LeagueSummary, "teamCount" | "scoringType" | "scoringConfig"> })`.

- [ ] **Step 1: Write the failing tests:**
  - `queries.test.ts`: `it("maps provider, sync fields and unsupported categories into the summary")`; an unknown stored provider reads as `"manual"`.
  - `teamQueries.test.ts`: `it("counts only my team's players as rostered in an imported league")`: with `myTeamId` set, the `findMany` `where` is `{ teamId: myTeamId, playerId: { not: null } }`; a manual league keeps today's query.
  - `teamQueries.test.ts`: `it("marks my team and lists unmatched players by slot")`.
  - `teams.test.ts`: `it("collects unmatched names by slot id")`.
  - `teamActions.test.ts`: `it("refuses to save or delete a team in an imported league")`: the ownership `findFirst` now also requires `provider: "manual"`; no row → `invalid` / `error`, no writes.
  - `actions.test.ts`: `it("only renames an imported league")`: `updateLeague` on a `yahoo` league writes `{ name }` only, ignoring the scoring arguments.
  - `types.test.ts` (new): `isLeagueProvider`.
- [ ] **Step 2: Run** `bun run --cwd apps/court-vision test src/lib/leagues` → the new cases FAIL.
- [ ] **Step 3: Implement.** `getLeagueTeams` reads `myTeamId` and `provider` with the teams (one query through `league`), puts the user's team first, and fills `isMine`/`isImported`; `TEAM_INCLUDE` selects the new team and slot columns. `parseLegacyTeam` sets the new `FantasyTeam` fields to their empty values. Let typecheck find every other construction site.
- [ ] **Step 4: Run** the leagues tests and `bun run --cwd apps/court-vision typecheck` → PASS.
- [ ] **Step 5: Commit** `CV: scope "yours" to my team and lock imported leagues`.

---

### Task 11: Server actions

**Files:**

- Modify: `apps/court-vision/src/lib/yahoo/types.ts` (result types)
- Create: `apps/court-vision/src/lib/yahoo/actions.ts`, `apps/court-vision/src/lib/yahoo/actions.test.ts`

**Interfaces:**

- Consumes: `parseYahooLeagueUrl`, `loadYahooLeague`, `resolveYahooPlayers`, `createImportedLeague`, `syncImportedLeague`, `toLeagueSummary`, `formatLeagueMeta`, `withProfile`, `getProfile`, `MAX_LEAGUES`, `isActionId`, `isActionText`.
- Produces (types in `types.ts`, functions in `actions.ts`):

  ```ts
  export type YahooFailure =
    | { status: "invalid_url" }
    | { status: "wrong_sport" }
    | { status: "past_season" }
    | { status: "not_found" }
    | { status: "unavailable" }
    | { status: "invalid_payload" }
    | { status: "highscore" }
    | { status: "unsupported_scoring" }
    | { status: "unauthenticated" }
    | { status: "error" };
  export type YahooPreviewTeam = {
    externalKey: string;
    name: string;
    logoUrl: string | null;
    managerName: string | null;
    rosterCount: number;
    isOwnedByCurrentLogin: boolean;
  };
  export type YahooPreview = {
    name: string;
    logoUrl: string | null;
    meta: string; // formatLeagueMeta, e.g. "12-team · 9-cat"
    unsupportedCategories: string[];
    teams: YahooPreviewTeam[];
  };
  export type YahooPreviewResult = { status: "ok"; preview: YahooPreview } | YahooFailure;
  export type YahooImportResult =
    | { status: "ok"; league: LeagueSummary; unmatched: string[] }
    | { status: "duplicate"; slug: string }
    | { status: "limit" }
    | { status: "invalid_team" }
    | YahooFailure;
  export type YahooSyncResult =
    | { status: "ok"; syncedAt: string; unmatched: string[] }
    | { status: "throttled" }
    | { status: "not_imported" }
    | YahooFailure;
  export type SetMyTeamResult =
    { status: "ok" } | { status: "invalid" } | { status: "unauthenticated" } | { status: "error" };

  export const previewYahooLeague: ({ url }: { url: string }) => Promise<YahooPreviewResult>;
  export const importYahooLeague: ({
    url,
    myTeamExternalKey,
  }: {
    url: string;
    myTeamExternalKey: string;
  }) => Promise<YahooImportResult>;
  export const syncYahooLeague: ({ leagueId }: { leagueId: string }) => Promise<YahooSyncResult>;
  export const setMyTeam: ({
    leagueId,
    teamId,
  }: {
    leagueId: string;
    teamId: string;
  }) => Promise<SetMyTeamResult>;
  ```

- [ ] **Step 1: Write the failing tests** (mock `@/lib/auth/session`, `@/lib/prisma`, `@/lib/yahoo/load`, `@/lib/yahoo/matchPlayers`, `@/lib/yahoo/persist`):
  - `it("answers unauthenticated for every action without a profile")`.
  - `it("rejects non-string arguments before any query")`: `{ url: { not: "" } }` → `invalid_url`; `leagueId: {}` → `error` with no Prisma call.
  - `it("maps URL and load failures to their statuses")`: `wrong_sport`, `past_season` (from the URL and from the load), `not_found`, `unavailable`, `invalid_payload`, `highscore`, `unsupported_scoring`.
  - `it("previews without writing anything")`: `resolveYahooPlayers` and `persist` not called.
  - `it("refuses a duplicate import and returns the existing slug")`.
  - `it("refuses an eleventh league")` → `limit`.
  - `it("refuses a team key that isn't in the league")` → `invalid_team`.
  - `it("imports with server-side matching")`: `resolveYahooPlayers` called with `writeMappings: true`; result lists unmatched names.
  - `it("throttles a sync within 60 seconds")` → `throttled`, no fetch.
  - `it("refuses to sync a manual league")` → `not_imported`.
  - `it("records the failure on the league and keeps its data")`: load returns `unavailable` → `league.update({ data: { syncError: "Yahoo isn't answering right now; try again in a minute." } })`, nothing else written.
  - `it("only sets my team to a team in that league")`.
- [ ] **Step 2: Run** `… test src/lib/yahoo/actions.test.ts` → FAIL.
- [ ] **Step 3: Implement** with `"use server"` at the top. Every body runs in `withProfile`. Ownership is in each `where` (`{ id: leagueId, profileId: profile.id }`). Import refetches rather than trusting a preview. The cap check and the create run in one `$transaction`, like `createLeague`. Sync reads `externalKey` to get the league id back (`externalKey.split(".l.")[1]`).
- [ ] **Step 4: Run** the test, then `bun run security:scan` → PASS (every `"use server"` file calls a session helper).
- [ ] **Step 5: Commit** `CV: add Yahoo import, sync and my-team actions`.

---

### Task 12: The import page

**Files:**

- Create: `apps/court-vision/src/app/leagues/import/page.tsx`
- Create: `apps/court-vision/src/components/YahooImportForm/YahooImportForm.tsx`, `YahooImportForm.module.scss`, `YahooImportForm.test.tsx`
- Create: `apps/court-vision/src/components/FantasyTeamLogo/FantasyTeamLogo.tsx`, `FantasyTeamLogo.module.scss`, `FantasyTeamLogo.test.tsx`
- Create: `apps/court-vision/src/lib/yahoo/messages.ts`, `messages.test.ts`
- Modify: `apps/court-vision/src/components/LeagueList/LeagueList.tsx` (an "Import from Yahoo" link beside both "Create league" links, hidden at the cap)
- Modify: `netlify.toml` `[images] remote_images` + `"https://s\\.yimg\\.com/.*"`, `"https://yahoofantasysports-res\\.cloudinary\\.com/.*"`

**Interfaces:**

- Consumes: `previewYahooLeague`, `importYahooLeague` and their result types (Task 11).
- Produces:
  - `yahooFailureMessage({ status }: { status: YahooFailure["status"] | "duplicate" | "limit" | "invalid_team" | "throttled" }): string` in `messages.ts`, with the copy below.
  - `<FantasyTeamLogo name={string} logoUrl={string | null} size?: "sm" | "md" />`: `next/image` with `alt=""` (decorative beside the name); with no URL, or `onError`, shows the name's initials in a neutral chip that uses no theme accent tokens.

Copy (exact):

| Status                | Message                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid_url`         | That doesn't look like a Yahoo league link. Paste the URL from your league's page, or just the league ID.                                                                    |
| `wrong_sport`         | That's a Yahoo league for another sport. Only Yahoo Fantasy Basketball leagues can be imported.                                                                              |
| `past_season`         | Only this season's leagues can be imported.                                                                                                                                  |
| `not_found`           | Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings, or you can import it with the Court Vision extension. |
| `highscore`           | Yahoo Fantasy High Score leagues aren't supported yet.                                                                                                                       |
| `unsupported_scoring` | This league's scoring type isn't supported yet.                                                                                                                              |
| `unavailable`         | Yahoo isn't answering right now; try again in a minute.                                                                                                                      |
| `invalid_payload`     | Yahoo sent something we couldn't read. Try again in a minute.                                                                                                                |
| `duplicate`           | You've already imported this league.                                                                                                                                         |
| `limit`               | You've reached the 10-league limit. Delete a league to import another.                                                                                                       |
| `invalid_team`        | Pick your team from the list.                                                                                                                                                |
| `throttled`           | Synced less than a minute ago.                                                                                                                                               |
| `unauthenticated`     | Your session expired. Sign in again to continue.                                                                                                                             |
| `error`               | Something went wrong. Try again.                                                                                                                                             |

- [ ] **Step 1: Write the failing tests:**
  - `messages.test.ts`: every status has a non-empty message; `not_found` equals the copy above.
  - `FantasyTeamLogo.test.tsx`: renders an `img` with `alt=""` for a URL; with no URL renders initials: the first letters of the first two words (`"Better Call Gasol"` → `"BC"`), or the first two letters of a one-word name (`"Newfoundlanders"` → `"NE"`).
  - `YahooImportForm.test.tsx` (actions mocked):
    - `it("labels the URL field and describes it")`: `getByLabelText("Yahoo league URL")` has `aria-describedby` pointing at the hint "Paste the link from your league's page on basketball.fantasysports.yahoo.com, or just the league ID."
    - `it("announces a preview failure")`: `not_found` → its message inside `role="alert"`.
    - `it("shows the league and asks which team is yours")`: a `fieldset` with legend "Which team is yours?" and one radio per team (logo, name, roster count); "Not valued: DD" when `unsupportedCategories` is non-empty.
    - `it("won't import until a team is picked")`: the "Import league" button is disabled.
    - `it("preselects the team Yahoo says is yours")`.
    - `it("imports the picked team and goes to My Teams")`: `importYahooLeague({ url, myTeamExternalKey: "478.l.106344.t.5" })`, then `router.push("/my-teams")` when `unmatched` is empty.
    - `it("names unmatched players before moving on")`: with `unmatched: ["Jalen Smith"]` it stays, announces "Imported. 1 player couldn't be matched: Jalen Smith. They won't count as rostered, so they may show up as free agents." in `role="status"`, and offers a "Go to My Teams" link.
    - `it("links to the existing league on duplicate")`: a link to `/leagues/<slug>` labelled "Open it".
- [ ] **Step 2: Run** the three tests → FAIL.
- [ ] **Step 3: Implement.** The page is `force-dynamic` and redirects signed-out visitors to `/login?next=/leagues/import`. It opens with `PageHeader` (eyebrow "My league", title "Import from Yahoo", description "Bring your Yahoo Fantasy Basketball league into Court Vision: every team, logo and roster."). The form is a client component with `useActionState`-style pending state; buttons use the `keycap` mixins; moving from the URL step to the team step moves focus to the fieldset legend. Read `node_modules/next/dist/docs/` for `next/image` with the custom loader before writing `FantasyTeamLogo`.
- [ ] **Step 4: Run** → PASS, plus `bun run --cwd apps/court-vision typecheck`.
- [ ] **Step 5: Commit** `CV: add the Yahoo import page`.

---

### Task 13: Imported leagues on the Leagues page and in My Teams

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/format.ts`, `format.test.ts`
- Create: `apps/court-vision/src/components/SyncYahooButton/SyncYahooButton.tsx`, `.module.scss`, `.test.tsx`
- Modify: `apps/court-vision/src/components/LeagueList/LeagueList.tsx` (+ test), `apps/court-vision/src/components/LeagueForm/LeagueForm.tsx` (+ test), `apps/court-vision/src/components/MyTeamsList/MyTeamsList.tsx` (+ test)
- Modify: `apps/court-vision/src/app/my-teams/page.tsx`, `apps/court-vision/src/app/my-teams/create/page.tsx`, `apps/court-vision/src/app/my-teams/[teamSlug]/page.tsx`

**Interfaces:**

- Consumes: `syncYahooLeague` (Task 11), `LeagueSummary`/`FantasyTeam` fields (Task 10), `FantasyTeamLogo` and `yahooFailureMessage` (Task 12).
- Produces:
  - `formatSyncedAgo({ syncedAt, now }: { syncedAt: string | null; now: Date }): string` → `"Never synced"`, `"Synced just now"` (< 1 min), `"Synced 4 min ago"`, `"Synced 2 h ago"`, `"Synced 3 d ago"`.
  - `<SyncYahooButton leagueId={string} syncedAt={string | null} syncError={string | null} />`: a keycap button "Sync with Yahoo"; while pending it reads "Syncing…" and is disabled; the status line (`formatSyncedAgo`, or the error) sits in an `aria-live="polite"` region; on `ok` it calls `router.refresh()`. Phase 2 reuses it on the Waiver Wire.

- [ ] **Step 1: Write the failing tests:**
  - `format.test.ts`: each band above, with a fixed `now`.
  - `SyncYahooButton.test.tsx`: `it("shows syncing, then refreshes")`; `it("announces a sync failure")` (`unavailable` → its message in the live region); `it("shows a throttle notice")`.
  - `LeagueList.test.tsx`: a `yahoo` league card shows a "Yahoo" badge, "Open in Yahoo" (`externalUrl`, `target="_blank"`, `rel="noreferrer"`), the sync button, "Not valued: DD" when `unsupportedCategories` is non-empty, and the credit line "League data from Yahoo Fantasy"; a `manual` card shows none of them. My Teams shows the same credit line for an imported league.
  - `LeagueForm.test.tsx`: `it("only offers a name for an imported league")` with the note "Scoring, teams and roster slots come from Yahoo."
  - `MyTeamsList.test.tsx`: imported teams show their logo, "Your team" on `isMine` (listed first), "Managed in Yahoo. Sync from the Leagues page to update.", no delete button, no edit link, and "Unmatched: <name>" in a slot from `unmatchedBySlotId`.
- [ ] **Step 2: Run** the component tests → FAIL.
- [ ] **Step 3: Implement.** `my-teams/page.tsx` hides "New team" for an imported active league. `my-teams/create` and `my-teams/[teamSlug]` `redirect("/my-teams")` when the active league (or the team) is imported. Every new piece uses tokens from `@vision/ui` `styles/globals.scss`; fantasy team logos never borrow theme tokens.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: show imported leagues and teams read-only`.

---

### Task 14: Probe CLI and end-to-end check

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/probe.ts`
- Modify: `apps/court-vision/package.json` (`"yahoo:probe": "bun run src/lib/yahoo/probe.ts"`), root `package.json` (proxy script, like `sync:players`)

**Interfaces:**

- Consumes: `parseYahooLeagueUrl`, `loadYahooLeague`, `resolveYahooPlayers` with `writeMappings: false`.
- Produces: `probeYahooLeague({ input, logger }: { input: string; logger?: Logger }): Promise<void>`, runnable through `isMainModule`.

- [ ] **Step 1: Implement the CLI.** It prints the league name, `formatLeagueMeta`, unsupported categories, each team with its roster count, and "matched X of Y; unmatched: …". It writes nothing.
- [ ] **Step 2: Run** `bun run yahoo:probe https://basketball.fantasysports.yahoo.com/nba/106344`.
      Expected: "Game of Courts · 12-team · 9-cat", 12 teams, and an unmatched list that is short enough to read (record the count in the PR).
- [ ] **Step 3: Full verification** from the repo root: `bun run typecheck`, `bun run test`, `bun run lint`, `bun run security:scan`, `bun run build`. All pass.
- [ ] **Step 4: Manual check in the app** (migration applied in Task 7): `bun run dev`, sign in, Leagues → "Import from Yahoo" → paste `https://basketball.fantasysports.yahoo.com/nba/106344` → the preview lists 12 teams with logos → pick the user's team → My Teams shows 12 read-only teams with logos, theirs first → the Players table marks only their players as "On your team" → "Sync with Yahoo" updates the time. Then try `https://football.fantasysports.yahoo.com/f1/1` and `999999999` and check the messages.
- [ ] **Step 5: Commit** `CV: add \`yahoo:probe\` CLI`.
