# Court Vision Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome MV3 extension that reads a Yahoo Fantasy Basketball league the user can see with their own Yahoo login and hands the raw data to Court Vision, so private leagues can be imported and kept in sync.

**Architecture:** Court Vision drives and the extension only fetches. The import page and the sync button message the extension (`externally_connectable`). Its service worker checks the sender's origin, fetches `pub-api-ro` with the user's Yahoo cookies, and returns the raw `json_f` bodies. The page passes them to new server actions that validate them with plan 1's schemas and transform, then persist through the same code as the server path, without ever writing the shared `PlayerExternalId` table. The message protocol lives in a dependency-free lib, `@vision/yahoo-bridge`, that both sides import.

**Tech Stack:** WXT 0.21.4 (Vite-based MV3 framework, no React: the extension has no UI), Next.js App Router (read `node_modules/next/dist/docs/` before Next code), Prisma 7.10, zod 4.6.5, bun:test with the `vi` shim.

**Spec:** `docs/superpowers/specs/2026-10-16-yahoo-league-import-design.md` (phase 3: "The Chrome extension", plus its lines in Testing and Risks). This plan builds on plan 1 (`2026-10-16-yahoo-import.md`) and plan 2 (`2026-10-16-waiver-wire.md`), which must be complete first.

## Global Constraints

- House rules in `CLAUDE.md` apply: no relative imports (app `@/`, lib `#bridge/`, `@vision/*` across packages), type aliases, no `any`, no casts, named exports (WXT's config and entrypoint default exports are the unavoidable exception; bind them to a name first so oxlint's anonymous-default-export rule stays quiet), single object parameters, `Array.prototype` methods, every type guard unit tested.
- Tests: co-located, `import { … vi } from "bun:test"`, `it` not `test`, never bare `bun test`. One file: `bun run --cwd <project> test <path>`. No test calls Yahoo or Chrome live; extension logic lives in plain modules with injected `fetchImpl`, and the WXT entrypoint is thin wiring.
- Extension permissions: exactly one host permission, `https://pub-api-ro.fantasysports.yahoo.com/*`, and no `permissions` entries. No content scripts.
- `externally_connectable.matches`: `https://court-vizion.netlify.app/*`, plus `http://localhost/*` in development builds only. Netlify deploy previews can't match (`netlify.app` is a public suffix), so preview builds never see the extension.
- The extension never stores, logs or forwards Yahoo cookies. It returns response bodies only.
- Snapshots sent by the extension are client-supplied: fully zod-validated, capped at 1.5 MB, and never written to `PlayerExternalId` (`resolveYahooPlayers({ writeMappings: false })`).
- Exact dependency pins (root `bunfig.toml` `exact = true`). Workspace siblings use `workspace:*`.
- CI (`.github/workflows/pull-request-checks.yml`) runs `format:check`, `lint:ts`, `lint:scss`, `lint:spell`, `typecheck`, `test` and `build` over every project through `nx run-many`. The extension's scripts must pass there with no secrets and no network.
- The app reads the extension id from `NEXT_PUBLIC_COURT_VISION_EXTENSION_ID`. When it is unset, the extension path is hidden entirely, so CI, deploy previews and builds need no value. Why an env var and not a constant: the Chrome Web Store assigns the production id only after the user's first upload, unpacked development builds have their own id, and Netlify can carry the store id without a code change. The id is public, not a secret.
- User-facing copy is exactly as written in this plan.
- Commits only after the user has authorized committing for the execution session; messages follow the `commit-format` skill. Pushing, applying migrations to Supabase, setting Netlify env vars and anything in the Chrome Web Store dashboard need the user's go-ahead, and the store steps are theirs to run.

## Review Focus

1. **A message from an origin that isn't allowed**, or one with no `sender.origin` (another site, a deploy preview, another extension), must be answered `forbidden_origin` without a single Yahoo request. Pinned in Task 6.
2. **A user who is signed out of Yahoo, or who blocks third-party cookies**, gets a 400 from the league request exactly as for a league that doesn't exist. They must see the sign-in and cookies message, not "couldn't read this league". Pinned in Task 5.
3. **A forged or oversized snapshot** sent to the snapshot actions (wrong shape, over 1.5 MB, a game from another season, a team key that isn't in the league) must be refused with nothing written, and `PlayerExternalId` must never be written by this path. Pinned in Task 4.
4. **No extension at all.** With the id unset, `chrome.runtime` missing, or the ping timing out, the import page must look and work exactly as in plan 1, with no extension button and no console error. Pinned in Task 7.
5. **An extension-synced league opened where the extension isn't available** (phone, another browser), including the Waiver Wire's automatic sync, must say syncing needs the extension and must never call the server sync, which would fail on a private league and record a `syncError`. Pinned in Task 9.

---

### Task 1: `@vision/yahoo-bridge`

**Files:**

- Create: `libs/yahoo-bridge/package.json`, `libs/yahoo-bridge/tsconfig.json`
- Create: `libs/yahoo-bridge/src/protocol.ts`, `libs/yahoo-bridge/src/protocol.test.ts`, `libs/yahoo-bridge/src/constants.ts`
- Modify: `.oxlintrc.json` (an override for `libs/yahoo-bridge/src/**` copying `@vision/core`'s, with the messages reworded for this lib: no `@vision/*`, no React/Next/nuqs/zustand, no Prisma/Supabase, no `@/`, no relative paths)
- Modify: `apps/court-vision/package.json` (`"@vision/yahoo-bridge": "workspace:*"`), `apps/court-vision/next.config.ts` (`workspacePackages` + `"@vision/yahoo-bridge"`)
- Modify: `apps/court-vision/src/lib/yahoo/constants.ts`, `client.ts`, `load.ts` (import the three moved constants from the bridge)
- Modify: `CLAUDE.md` "Structure" (one bullet for the lib, one for the extension app) and the dependency-rules bullet ("`@vision/yahoo-bridge` imports nothing")

**Interfaces:**

- Produces (`@vision/yahoo-bridge/constants`): `YAHOO_API_BASE_URL`, `YAHOO_PAGE_SIZE`, `YAHOO_MAX_WAIVER_PAGES` (moved out of the app's `lib/yahoo/constants.ts`, same values), `COURT_VISION_ORIGIN = "https://court-vizion.netlify.app"`, `COURT_VISION_DEV_ORIGIN = "http://localhost:46644"`.
- Produces (`@vision/yahoo-bridge/protocol`):

  ```ts
  export const BRIDGE_VERSION = 1;
  export type BridgeRequest = { type: "ping" } | { type: "fetchLeague"; leagueId: string }; // leagueId: /^\d{1,9}$/
  export type BridgeLeaguePayload = { game: unknown; snapshot: unknown; waiverPages: unknown[] };
  export type BridgeErrorReason =
    "forbidden_origin" | "bad_request" | "logged_out" | "not_found" | "unavailable";
  export type BridgeResponse =
    | { type: "pong"; version: number }
    | { type: "league"; payload: BridgeLeaguePayload }
    | { type: "error"; reason: BridgeErrorReason };
  export const isBridgeRequest: (value: unknown) => value is BridgeRequest;
  export const isBridgeResponse: (value: unknown) => value is BridgeResponse;
  export const isBridgeLeaguePayload: (value: unknown) => value is BridgeLeaguePayload;
  ```

- [ ] **Step 1: Scaffold the lib** like `libs/vision-core`: `package.json` with `"name": "@vision/yahoo-bridge"`, `"type": "module"`, `"sideEffects": false`, scripts `test` (`bun test --parallel --dots`) and `typecheck` (`tsgo --noEmit`), `"imports": { "#bridge/*": "./src/*.ts" }`, `"exports": { "./*": "./src/*.ts" }`. `tsconfig.json` extends `../../tsconfig.base.json` and includes `src/**/*.ts`. No `bunfig.toml` (no DOM).
- [ ] **Step 2: Write the failing tests** in `protocol.test.ts`:
  - `it("accepts each request shape")`: `{ type: "ping" }`, `{ type: "fetchLeague", leagueId: "106344" }`.
  - `it("rejects malformed requests")`: `null`, `"ping"`, `{ type: "fetchLeague" }`, `{ type: "fetchLeague", leagueId: 106344 }`, `{ type: "fetchLeague", leagueId: "abc" }`, `{ type: "fetchLeague", leagueId: "1234567890" }`, `{ type: "nuke" }`.
  - `it("accepts each response shape")` and `it("rejects an error with an unknown reason")`.
  - `it("requires waiverPages to be an array")` for `isBridgeLeaguePayload`; `game` and `snapshot` may be anything except `undefined`.
- [ ] **Step 3: Run** `bun run --cwd libs/yahoo-bridge test` → FAIL (module missing).
- [ ] **Step 4: Implement** with a private `isRecord` (the lib may not import `@vision/core`). Move the three constants, delete them from the app's `constants.ts`, and repoint their imports in `client.ts` and `load.ts`.
- [ ] **Step 5: Run** `bun install` (links the workspace; `bun.lock` changes), then `bun run --cwd libs/yahoo-bridge test`, `bun run --cwd apps/court-vision test src/lib/yahoo`, `bun run lint:ts` and `bun run typecheck` → PASS.
- [ ] **Step 6: Commit** `CV: add \`@vision/yahoo-bridge\` message protocol`.

---

### Task 2: `League.syncVia`, and the server sync stands down for extension leagues

**Files:**

- Modify: `apps/court-vision/prisma/schema.prisma`; create `apps/court-vision/prisma/migrations/20261016000100_league_sync_via/migration.sql`
- Modify: `apps/court-vision/src/lib/leagues/types.ts`, `queries.ts` (+ tests)
- Modify: `apps/court-vision/src/lib/yahoo/types.ts`, `actions.ts`, `messages.ts` (+ tests)

**Interfaces:**

- Produces: `League.syncVia String @default("server")` (`"server"` | `"extension"`); `LeagueSyncVia = "server" | "extension"` and `isLeagueSyncVia(value: string): value is LeagueSyncVia` in `lib/leagues/types.ts`; `LeagueSummary` + `syncVia: LeagueSyncVia` (unknown stored values read as `"server"`).
- Produces: `YahooSyncResult` + `{ status: "needs_extension" }`; `yahooFailureMessage` accepts `"needs_extension"` → "Syncing this league needs the Court Vision extension in this browser."

- [ ] **Step 1: Edit the schema** (comment: which path keeps the league in sync, because a private league can only be read through the extension). Generate the SQL as in plan 1 Task 7, diffing against the schema at plan 1's migration: `git show HEAD:apps/court-vision/prisma/schema.prisma > "$TMPDIR/schema-before.prisma"` before editing, then `bunx prisma migrate diff --from-schema "$TMPDIR/schema-before.prisma" --to-schema prisma/schema.prisma --script > prisma/migrations/20261016000100_league_sync_via/migration.sql`. Expected: one `ALTER TABLE "League" ADD COLUMN "syncVia" TEXT NOT NULL DEFAULT 'server';`. Run `bun run --cwd apps/court-vision db:generate`.
- [ ] **Step 2: Write the failing tests:**
  - `types.test.ts`: `isLeagueSyncVia`.
  - `queries.test.ts`: `it("maps syncVia into the summary, defaulting to server")`.
  - `actions.test.ts`: `it("refuses to sync an extension league from the server")`: `syncVia: "extension"` → `{ status: "needs_extension" }`, no load call, no `syncError` written.
  - `messages.test.ts`: `needs_extension` copy.
- [ ] **Step 3: Run** `bun run --cwd apps/court-vision test src/lib/leagues src/lib/yahoo` → the new cases FAIL.
- [ ] **Step 4: Implement**, then run the tests and `bun run --cwd apps/court-vision typecheck` → PASS.
- [ ] **Step 5: Apply.** Ask the user before running `DATABASE_URL=$(grep '^DIRECT_URL' .env | cut -d'"' -f2) bunx prisma migrate deploy` in `apps/court-vision`; then `bunx prisma migrate status` → up to date.
- [ ] **Step 6: Commit** `CV: record whether a league syncs through the server or the extension`.

---

### Task 3: Share the import and sync orchestration

Plan 1 keeps preview building and the import and sync transactions private inside the `"use server"` file `lib/yahoo/actions.ts`. The snapshot actions need the same steps, so lift them into a server-only module. Behavior does not change.

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/importLeague.ts`, `importLeague.test.ts`
- Modify: `apps/court-vision/src/lib/yahoo/actions.ts` (call the helpers), `apps/court-vision/src/lib/yahoo/persist.ts` (+ test)

**Interfaces:**

- Consumes: `YahooLoadResult`, `YahooLoadFailure` (plan 1 Task 9), `resolveYahooPlayers`, `createImportedLeague`, `syncImportedLeague`, `toLeagueSummary`, `formatLeagueMeta`, `MAX_LEAGUES`, `YAHOO_SYNC_THROTTLE_MS`.
- Produces:
  ```ts
  type LoadedLeague = Extract<YahooLoadResult, { status: "ok" }>;
  export const toYahooPreview: ({ league }: { league: ImportedLeague }) => YahooPreview;
  export const loadFailureToResult: ({ failure }: { failure: YahooLoadFailure }) => YahooFailure;
  // not_found/unavailable/invalid_payload/past_season pass through; unsupported → highscore | unsupported_scoring
  export const importLoadedLeague: (args: {
    profileId: string;
    loaded: LoadedLeague;
    myTeamExternalKey: string;
    writeMappings: boolean;
    syncVia: LeagueSyncVia;
  }) => Promise<YahooImportResult>;
  export const syncLoadedLeague: (args: {
    profileId: string;
    leagueId: string;
    loaded: LoadedLeague;
    writeMappings: boolean;
  }) => Promise<YahooSyncResult>;
  ```
- Changes: `createImportedLeague` args gain `syncVia: LeagueSyncVia`, written to the new column.

- [ ] **Step 1: Write the failing tests** in `importLeague.test.ts` (mocks as in plan 1's `actions.test.ts`):
  - `it("imports with the requested syncVia and mapping policy")`: `writeMappings: false` reaches `resolveYahooPlayers`; `syncVia: "extension"` reaches `createImportedLeague`.
  - `it("refuses a duplicate, the cap, and a team key outside the league")` → `duplicate` (with slug), `limit`, `invalid_team`; nothing written.
  - `it("throttles a sync inside 60 seconds")`.
  - `it("builds the preview from an imported league")`: Game of Courts fixture → `meta: "12-team · 9-cat"`, 12 teams, `rosterCount` 13 for Newfoundlanders.
  - `persist.test.ts`: `it("stores syncVia on create")`.
- [ ] **Step 2: Run** `bun run --cwd apps/court-vision test src/lib/yahoo/importLeague.test.ts src/lib/yahoo/persist.test.ts` → FAIL.
- [ ] **Step 3: Implement**, moving code out of `actions.ts` rather than copying it. `actions.ts` passes `writeMappings: true, syncVia: "server"`.
- [ ] **Step 4: Run** `bun run --cwd apps/court-vision test src/lib/yahoo` → PASS. Plan 1's `actions.test.ts` passes unchanged. Then `bun run security:scan` → PASS.
- [ ] **Step 5: Commit** `CV: share Yahoo import and sync steps between paths`.

---

### Task 4: Snapshot server actions

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/snapshotActions.ts`, `snapshotActions.test.ts`
- Modify: `apps/court-vision/src/lib/yahoo/constants.ts` (`MAX_SNAPSHOT_BYTES`)
- Modify: `apps/court-vision/next.config.ts` (`experimental: { serverActions: { bodySizeLimit: "2mb" } }`, with a comment: an extension snapshot of a 20-team league can pass Next's 1 MB default)

**Interfaces:**

- Consumes: `isBridgeLeaguePayload` (Task 1), `yahooGameSchema` and `parseYahooPayload` (plan 1 Tasks 4 and 9), Task 3's helpers, `withProfile`, `getProfile`, `isActionId`, `isActionText`.
- Produces:

  ```ts
  // lib/yahoo/constants.ts ("use server" files may export only async functions)
  export const MAX_SNAPSHOT_BYTES = 1_500_000;
  // lib/yahoo/snapshotActions.ts
  export const previewYahooSnapshot: ({
    payload,
  }: {
    payload: unknown;
  }) => Promise<YahooPreviewResult>;
  export const importYahooLeagueFromSnapshot: (args: {
    payload: unknown;
    myTeamExternalKey: string;
  }) => Promise<YahooImportResult>;
  export const syncYahooLeagueFromSnapshot: (args: {
    leagueId: string;
    payload: unknown;
  }) => Promise<YahooSyncResult>;
  ```

- [ ] **Step 1: Write the failing tests** (Review Focus 3):
  - `it("answers unauthenticated without a profile")`, for all three.
  - `it("refuses a payload that isn't a bridge payload")`: `null`, `{}`, `{ game: {}, snapshot: {}, waiverPages: "x" }` → `invalid_payload`, no Prisma call.
  - `it("refuses a payload over 1.5 MB")`: a `waiverPages` entry holding a 1.6 MB string → `invalid_payload` before any parsing.
  - `it("refuses a game body that doesn't parse")` and `it("refuses a league from another season")` (game season 2027, snapshot 2026 → `past_season`).
  - `it("previews from the Game of Courts fixture")`: the fixture bodies (plan 1 Task 4) → 12 teams, nothing written.
  - `it("imports through the extension without writing shared mappings")`: `resolveYahooPlayers` called with `writeMappings: false`; `createImportedLeague` with `syncVia: "extension"`.
  - `it("refuses a team key that isn't in the snapshot")` → `invalid_team`.
  - `it("syncs only a league the caller owns")`: forged `leagueId` → `error`; `leagueId: {}` → `error` with no Prisma call.
  - `it("syncs a server league from a snapshot too")`: allowed; `syncVia` unchanged.
- [ ] **Step 2: Run** `… test src/lib/yahoo/snapshotActions.test.ts` → FAIL.
- [ ] **Step 3: Implement** with `"use server"`. Size is `new TextEncoder().encode(JSON.stringify(payload)).length`, checked first. The current season comes from `yahooGameSchema.safeParse(payload.game)`, so this path works even if Yahoo blocks Netlify (plan 1 Task 0).
- [ ] **Step 4: Run** the test, `bun run security:scan` and `bun run --cwd apps/court-vision typecheck` → PASS.
- [ ] **Step 5: Commit** `CV: accept Yahoo snapshots from the extension`.

---

### Task 5: Extension app and its Yahoo requests

**Files:**

- Create: `apps/court-vision-extension/package.json`, `tsconfig.json`, `wxt.config.ts`
- Create: `apps/court-vision-extension/public/icon/16.png`, `32.png`, `48.png`, `128.png`
- Create: `apps/court-vision-extension/src/lib/yahooRequests.ts`, `yahooRequests.test.ts`
- Modify: `.gitignore`, `.oxfmtrc.json` `ignorePatterns`, `.oxlintrc.json` `ignorePatterns` (all three gain `apps/*/.wxt/` and `apps/*/.output/`)
- Modify: root `package.json` scripts: `"dev:extension": "bun run --cwd apps/court-vision-extension dev"`, `"zip:extension": "bun run --cwd apps/court-vision-extension zip"`

**Interfaces:**

- Consumes: `YAHOO_API_BASE_URL`, `YAHOO_PAGE_SIZE`, `YAHOO_MAX_WAIVER_PAGES`, `BridgeLeaguePayload` (Task 1); `FetchImpl` from `@vision/core/util/fetchImpl`.
- Produces:
  ```ts
  export type LeagueFetchResult =
    | { type: "league"; payload: BridgeLeaguePayload }
    | { type: "error"; reason: "logged_out" | "not_found" | "unavailable" };
  export const fetchLeaguePayload: (args: {
    leagueId: string;
    fetchImpl: FetchImpl;
  }) => Promise<LeagueFetchResult>;
  ```

Requests, all `GET` with `{ credentials: "include" }` and `format=json_f`. The game code `nba` stands in for the current season's game key (`league/nba.l.106344` returned `478.l.106344`, checked 2026-10-16), so the extension parses nothing:

1. `game/nba` → `payload.game`
2. `league/nba.l.{id};out=settings/teams/roster` → `payload.snapshot`
3. `league/nba.l.{id}/players;status=W;start={n·25};count=25`, until a page with fewer than 25 players or 10 pages. "Fewer than 25" is the length of `fantasy_content.league.players` when it is an array, else 0. That one read is the only shape the extension knows.
4. Only when request 2 answers 400: `users;use_login=1/games;game_keys=nba`. A 401 means Yahoo saw no session (`logged_out`); anything else means the session is fine and the league isn't readable by it (`not_found`). Anonymously this returned 401 on 2026-10-16. Confirm a signed-in 200 in Task 10.

- [ ] **Step 1: Scaffold.** `package.json`: `"name": "court-vision-extension"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`, scripts `dev` (`wxt`), `build` (`wxt build`), `zip` (`wxt zip`), `typecheck` (`wxt prepare && tsgo --noEmit`), `test` (`wxt prepare && bun test --parallel --dots`); dependencies `@vision/core` and `@vision/yahoo-bridge` (`workspace:*`); devDependency `wxt` `0.21.4` (it brings `@wxt-dev/browser`; `vite` 8.3.2 is already at the root). `tsconfig.json`: `"extends": ["../../tsconfig.base.json", "./.wxt/tsconfig.json"]`, `"include": ["src/**/*.ts", "wxt.config.ts", ".wxt/wxt.d.ts"]`. If tsgo rejects an `extends` array, extend `./.wxt/tsconfig.json` alone and copy `strict`, `noEmit` and `types` from the base. WXT's generated config maps `@/*` to `src/*`, which satisfies the repo's no-relative-imports rule. Icons: resize `apps/court-vision/src/app/icon.png` with `sips -z <n> <n>`.
- [ ] **Step 2: Write `wxt.config.ts`.** It uses `srcDir: "src"`, `imports: false` (explicit `#imports`), and a manifest function of `{ mode }`:
  - `name: "Court Vision"`;
  - `description: "Import your Yahoo Fantasy Basketball league into Court Vision. Not affiliated with Yahoo."`;
  - `host_permissions: ["https://pub-api-ro.fantasysports.yahoo.com/*"]`;
  - `externally_connectable: { matches: [\`${COURT_VISION_ORIGIN}/_\`, …(mode === "development" ? ["http://localhost/_"] : [])] }`;
  - `action: {}` (a click opens the import page; there is no popup);
  - `key: DEV_MANIFEST_KEY` in development only.

  Generate `DEV_MANIFEST_KEY` once; it is a public key, safe to commit, and no private key is kept:

  ```bash
  openssl genrsa 2048 2>/dev/null | openssl rsa -pubout -outform DER 2>/dev/null > "$TMPDIR/cv-ext.der"
  base64 < "$TMPDIR/cv-ext.der" | tr -d '\n'                     # → DEV_MANIFEST_KEY
  shasum -a 256 "$TMPDIR/cv-ext.der" | head -c 32 | tr 0-9a-f a-p  # → the dev extension id
  ```

  Put the dev id in `apps/court-vision/.env.example` as a comment and tell the user to set it in their `.env`.

- [ ] **Step 3: Write the failing tests** in `yahooRequests.test.ts` with a `vi.fn<FetchImpl>()` serving bodies by URL:
  - `it("fetches the game, the league and the waiver list with the user's cookies")`: three requests, each with `credentials: "include"`, URLs exactly `${YAHOO_API_BASE_URL}/game/nba?format=json_f`, `…/league/nba.l.106344;out=settings/teams/roster?format=json_f`, `…/league/nba.l.106344/players;status=W;start=0;count=25?format=json_f`; the payload holds the three bodies untouched.
  - `it("pages waivers until a short page and never past ten")`: pages of 25, 25, 3 → `waiverPages.length === 3`; eleven full pages → ten requests.
  - `it("reports logged_out when Yahoo sees no session")` (Review Focus 2): league 400, login probe 401 → `logged_out`.
  - `it("reports not_found when the session can't see the league")`: league 400, probe 200 → `not_found`.
  - `it("reports unavailable for 5xx, 999 and network errors")`, and `it("reports unavailable for a body that isn't JSON")`.
- [ ] **Step 4: Run** `bun run --cwd apps/court-vision-extension test src/lib/yahooRequests.test.ts` → FAIL.
- [ ] **Step 5: Implement** `fetchLeaguePayload`: no retries (the user can press again); 15 s timeout per request through `AbortController`.
- [ ] **Step 6: Run** the test, then `bun install`, `bun run --cwd apps/court-vision-extension typecheck`, `bun run --cwd apps/court-vision-extension build` (expect `.output/chrome-mv3/manifest.json` with the one host permission and no `key`), `bun run format:check` and `bun run lint:ts` → PASS.
- [ ] **Step 7: Commit** `CV: scaffold the Court Vision extension and its Yahoo requests`.

---

### Task 6: Message handling and the background entrypoint

**Files:**

- Create: `apps/court-vision-extension/src/lib/origins.ts`, `origins.test.ts`
- Create: `apps/court-vision-extension/src/lib/handleMessage.ts`, `handleMessage.test.ts`
- Create: `apps/court-vision-extension/src/entrypoints/background.ts`

**Interfaces:**

- Consumes: `fetchLeaguePayload` (Task 5); `isBridgeRequest`, `BridgeResponse`, `BRIDGE_VERSION`, `COURT_VISION_ORIGIN`, `COURT_VISION_DEV_ORIGIN` (Task 1).
- Produces:

  ```ts
  export const allowedOrigins: ({ isDev }: { isDev: boolean }) => readonly string[];
  // production: [COURT_VISION_ORIGIN]; dev adds COURT_VISION_DEV_ORIGIN
  export const importPageUrl: ({ isDev }: { isDev: boolean }) => string; // "<origin>/leagues/import"
  export const handleExternalMessage: (args: {
    message: unknown;
    senderOrigin: string | null;
    allowedOrigins: readonly string[];
    fetchImpl: FetchImpl;
  }) => Promise<BridgeResponse>;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `origins.test.ts`: both functions, dev and production.
  - `handleMessage.test.ts` (Review Focus 1): `it("refuses a sender that isn't Court Vision")` for `"https://evil.example"`, `"https://deploy-preview-12--court-vizion.netlify.app"`, `"http://localhost:46644"` in production, and `null`, each → `{ type: "error", reason: "forbidden_origin" }` with `fetchImpl` never called. `it("answers a ping with the protocol version")`. `it("refuses a malformed request")` → `bad_request`, no fetch. `it("returns the league payload")` (passes the result of `fetchLeaguePayload` through).
- [ ] **Step 2: Run** `bun run --cwd apps/court-vision-extension test src/lib` → FAIL.
- [ ] **Step 3: Implement**, then write `background.ts`. It imports `browser` and `defineBackground` from `#imports` and binds `const background = defineBackground(() => { … }); export default background;`. Inside `main` (synchronous, per WXT):
  - `browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => { void handleExternalMessage({ message, senderOrigin: sender.origin ?? null, allowedOrigins: allowedOrigins({ isDev: import.meta.env.DEV }), fetchImpl: fetch }).then(sendResponse); return true; });`
  - `browser.action.onClicked.addListener(() => { void browser.tabs.create({ url: importPageUrl({ isDev: import.meta.env.DEV }) }); });`

  No code runs outside `main`.

- [ ] **Step 4: Run** the tests, `typecheck` and `build` for the extension → PASS.
- [ ] **Step 5: Smoke-test unpacked.** `bun run dev:extension` opens Chrome with the extension. Clicking its toolbar icon opens `http://localhost:46644/leagues/import`. In that tab's DevTools console, `await chrome.runtime.sendMessage("<dev id>", { type: "ping" })` → `{ type: "pong", version: 1 }`.
- [ ] **Step 6: Commit** `CV: answer Court Vision's messages from the extension`.

---

### Task 7: The app's extension client

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/extensionClient.ts`, `extensionClient.test.ts`
- Modify: `apps/court-vision/src/lib/yahoo/messages.ts` (+ test)
- Modify: `apps/court-vision/.env.example` (`NEXT_PUBLIC_COURT_VISION_EXTENSION_ID=` with a comment: the store id in production, the dev id from Task 5 locally, unset to hide the extension)

**Interfaces:**

- Consumes: `BridgeRequest`, `BridgeLeaguePayload`, `BridgeErrorReason`, `isBridgeResponse` (Task 1).
- Produces:
  ```ts
  export type ExtensionSend = (args: {
    extensionId: string;
    message: BridgeRequest;
  }) => Promise<unknown>;
  export type ExtensionLeagueResult =
    | { status: "ok"; payload: BridgeLeaguePayload }
    | { status: "missing" } // no chrome.runtime, no answer, or a malformed answer
    | { status: "failed"; reason: BridgeErrorReason };
  export const getExtensionId: () => string | null; // trimmed env value, null when unset or empty
  export const extensionStoreUrl: ({ extensionId }: { extensionId: string }) => string; // https://chromewebstore.google.com/detail/<id>
  export const chromeSend: ExtensionSend; // reads globalThis.chrome.runtime.sendMessage through type guards; rejects when absent
  export const pingExtension: (args: {
    extensionId: string;
    send?: ExtensionSend;
    timeoutMs?: number;
  }) => Promise<boolean>; // default 1_500
  export const fetchLeagueViaExtension: (args: {
    extensionId: string;
    leagueId: string;
    send?: ExtensionSend;
    timeoutMs?: number; // default 60_000
  }) => Promise<ExtensionLeagueResult>;
  export const bridgeFailureMessage: ({
    reason,
  }: {
    reason: BridgeErrorReason | "missing";
  }) => string; // in messages.ts
  ```

Copy (exact; `logged_out` extends the spec's sentence with the sign-in hint):

| Reason             | Message                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logged_out`       | Couldn't read this league with your Yahoo login. Make sure you're signed in to Yahoo in this browser. If you block third-party cookies, allow them for yahoo.com and try again. |
| `not_found`        | Couldn't read this league with your Yahoo login. Check that you're signed in to the Yahoo account that's in this league.                                                        |
| `unavailable`      | Yahoo isn't answering right now; try again in a minute.                                                                                                                         |
| `forbidden_origin` | The Court Vision extension only works on court-vizion.netlify.app.                                                                                                              |
| `bad_request`      | Something went wrong. Try again.                                                                                                                                                |
| `missing`          | The Court Vision extension isn't responding. Check that it's installed and enabled, then try again.                                                                             |

- [ ] **Step 1: Write the failing tests** (Review Focus 4):
  - `it("hides the extension when no id is configured")`: env unset or `"  "` → `getExtensionId()` is `null`.
  - `it("treats a missing chrome.runtime as missing")`: `chromeSend` rejects without `globalThis.chrome`, so `pingExtension` → `false`.
  - `it("gives up on a ping after the timeout")`: a `send` that never resolves → `false` after `timeoutMs`.
  - `it("returns the payload, a failure reason, or missing")`: the three outcomes from `send` answering `league`, `error`, and `{ nonsense: true }`.
  - `messages.test.ts`: every reason has the copy above.
- [ ] **Step 2: Run** `bun run --cwd apps/court-vision test src/lib/yahoo/extensionClient.test.ts src/lib/yahoo/messages.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Read `chrome` without casts: `const chromeValue: unknown = Reflect.get(globalThis, "chrome")`, then narrow `runtime` and `sendMessage` with `isRecord` and `typeof … === "function"`. Use the promise form of `sendMessage(extensionId, message)`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CV: talk to the Court Vision extension from the app`.

---

### Task 8: Import through the extension

**Files:**

- Modify: `apps/court-vision/src/components/YahooImportForm/YahooImportForm.tsx`, `YahooImportForm.module.scss`, `YahooImportForm.test.tsx`

**Interfaces:**

- Consumes: `getExtensionId`, `pingExtension`, `fetchLeagueViaExtension`, `extensionStoreUrl`, `bridgeFailureMessage` (Task 7); `previewYahooSnapshot`, `importYahooLeagueFromSnapshot` (Task 4); `parseYahooLeagueUrl` (plan 1 Task 2).

Behavior:

- On mount, with an id configured, the form pings the extension once. Until it answers, nothing about the extension renders.
- When the ping succeeds, a second keycap button, "Import with the Court Vision extension", sits beside "Find league". It parses the URL in the browser (`parseYahooLeagueUrl`; failures use plan 1's messages), calls `fetchLeagueViaExtension`, then `previewYahooSnapshot({ payload })`. The preview and team picker are plan 1's, and the team Yahoo marks as the user's is preselected.
- "Import league" in extension mode fetches through the extension again, so the import never uses a stale preview, then calls `importYahooLeagueFromSnapshot`.
- When a server preview answers `not_found`: with the extension present, a "Try with the extension" button appears under the message; with an id configured but no answer to the ping, a link "Get the Court Vision extension" (`extensionStoreUrl`, new tab) appears instead.
- Bridge failures render `bridgeFailureMessage` in the same `role="alert"` region plan 1 uses.

- [ ] **Step 1: Write the failing tests** (mock `@/lib/yahoo/extensionClient` and both action modules):
  - `it("shows no extension controls without an id")` and `it("shows no extension controls when the ping fails")` (Review Focus 4): the form is plan 1's, with no extra buttons or links.
  - `it("previews through the extension and preselects my team")`.
  - `it("refetches through the extension on import")`: `fetchLeagueViaExtension` called twice; `importYahooLeagueFromSnapshot` gets the second payload and the picked key.
  - `it("announces an extension failure")`: `logged_out` → its message in `role="alert"`.
  - `it("offers the extension after a private-league miss")`, both variants above.
- [ ] **Step 2: Run** `… test src/components/YahooImportForm` → FAIL.
- [ ] **Step 3: Implement.** Keep the server path untouched; the extension path is a second source for the same preview state.
- [ ] **Step 4: Run** → PASS, plus `bun run --cwd apps/court-vision typecheck`.
- [ ] **Step 5: Commit** `CV: import private Yahoo leagues through the extension`.

---

### Task 9: Sync extension leagues through the extension

**Files:**

- Create: `apps/court-vision/src/lib/yahoo/clientSync.ts`, `clientSync.test.ts`
- Modify: `apps/court-vision/src/components/SyncYahooButton/SyncYahooButton.tsx` (+ test), and its two call sites (`LeagueList`, the Waiver Wire page from plan 2) to pass the new props

**Interfaces:**

- Consumes: `syncYahooLeague` (plan 1), `syncYahooLeagueFromSnapshot` (Task 4), `fetchLeagueViaExtension`, `getExtensionId`, `bridgeFailureMessage` (Task 7), `parseYahooLeagueUrl`.
- Produces:

  ```ts
  export type ClientSyncResult =
    | YahooSyncResult
    | { status: "extension_missing" }
    | { status: "extension_failed"; reason: BridgeErrorReason };
  export const syncLeagueFromClient: (args: {
    leagueId: string;
    syncVia: LeagueSyncVia;
    externalUrl: string | null; // the Yahoo league id is parsed back out of it
  }) => Promise<ClientSyncResult>;
  ```

  `SyncYahooButton` gains required props `syncVia: LeagueSyncVia` and `externalUrl: string | null`, and every sync it runs, including plan 2's `autoSyncWhenStale`, goes through `syncLeagueFromClient`.

- [ ] **Step 1: Write the failing tests:**
  - `clientSync.test.ts`: `it("syncs a server league on the server")`; `it("syncs an extension league through the extension")` (`fetchLeagueViaExtension` then `syncYahooLeagueFromSnapshot`; `syncYahooLeague` never called); `it("reports extension_missing without calling the server")` (Review Focus 5: no id, or `missing`).
  - `SyncYahooButton.test.tsx`: `it("says syncing needs the extension")`: `extension_missing` → "Syncing this league needs the Court Vision extension in this browser." in the live region, with the last-synced time still shown. `it("auto-sync of a stale extension league never falls back to the server")` (Review Focus 5) for plan 2's `autoSyncWhenStale`.
- [ ] **Step 2: Run** `… test src/lib/yahoo/clientSync.test.ts src/components/SyncYahooButton` → FAIL.
- [ ] **Step 3: Implement**; let typecheck find the call sites.
- [ ] **Step 4: Run** → PASS, plus `bun run --cwd apps/court-vision typecheck`.
- [ ] **Step 5: Commit** `CV: sync private leagues through the extension`.

---

### Task 10: Privacy page and end-to-end check

**Files:**

- Create: `apps/court-vision/src/app/privacy/page.tsx`, `page.test.tsx`, `privacy.module.scss`
- Modify: `apps/court-vision/src/components/SiteFooter/SiteFooter.tsx` (+ test): a "Privacy" link
- Modify: `apps/court-vision/e2e/accessibility.e2e.ts` (`{ path: "/privacy", heading: "Privacy" }`), `apps/court-vision/perf-budget.json` (`{ "path": "/privacy", "label": "Privacy", "budgetMs": { "ttfb": 600, "total": 1500 } }`)

- [ ] **Step 1: Write the failing tests:** `page.test.tsx` renders one `h1` "Privacy" and a section for each point below; `SiteFooter.test.tsx` finds the "Privacy" link to `/privacy`.
- [ ] **Step 2: Implement.** A static, public page (no session read) opening with `PageHeader` (eyebrow "Court Vision", title "Privacy"). It says, in plain sentences:
  - the extension reads Yahoo Fantasy data only for a league you ask Court Vision to import or sync, using your Yahoo login in your browser;
  - it sends that league's settings, teams and rosters to Court Vision, where they are saved to your account;
  - it never reads or sends your Yahoo password or cookies, or your browsing history;
  - nothing is sold or shared;
  - deleting the league in Court Vision deletes its imported data;
  - Court Vision is not affiliated with Yahoo;
  - how to contact Court Vision, in the user's own words (ask them).
- [ ] **Step 3: Run** `… test src/app/privacy src/components/SiteFooter` → PASS.
- [ ] **Step 4: End-to-end, unpacked** (migrations applied, the dev id in `.env`, `bun run dev` and `bun run dev:extension`):
  - Signed in to Yahoo, importing Game of Courts through the extension shows the preview with the user's team preselected and manager names filled in. Import, then check My Teams.
  - "Sync with Yahoo" on that league goes through the extension: it appears in the extension's service-worker network log.
  - Sign out of Yahoo and sync again → the `logged_out` message. Record the login probe's status codes signed in and signed out in the spec's Risks section.
  - If the user has a private league, import it the same way.
  - Remove the id from `.env` and restart → the import page shows no extension controls.
- [ ] **Step 5: Full verification** from the root: `bun run system-check` and `bun run security:scan` → PASS.
- [ ] **Step 6: Commit** `CV: add the privacy page`.

---

### Task 11: Publish unlisted to the Chrome Web Store (the user runs this)

Nothing here runs without the user. Hand them this checklist with the zip path.

- [ ] **Step 1: Build the zip.** `bun run zip:extension` → `apps/court-vision-extension/.output/court-vision-extension-0.1.0-chrome.zip`. Unzip it and confirm `manifest.json` has no `key` and no `http://localhost/*` match.
- [ ] **Step 2: The user** registers a Chrome Web Store developer account (one-time fee), then creates a new item from the zip, choosing:
  - **Visibility:** Unlisted.
  - **Listing:**
    - name "Court Vision";
    - summary "Import your Yahoo Fantasy Basketball league into Court Vision.";
    - description including "Not affiliated with Yahoo";
    - the 128 px icon;
    - at least one 1280×800 screenshot of the import page.
  - **Privacy tab:**
    - single purpose: "Import your Yahoo Fantasy Basketball league into Court Vision";
    - host permission justification: "Reads the fantasy league the user asks to import from Yahoo's fantasy data host, using their Yahoo login";
    - remote code: none;
    - data disclosure: website content (the league), sent only to Court Vision;
    - privacy policy URL `https://court-vizion.netlify.app/privacy`.
- [ ] **Step 3: After approval,** the user sets `NEXT_PUBLIC_COURT_VISION_EXTENSION_ID` to the store item's id in Netlify's production environment and redeploys. Optionally, copy the item's public key (Package tab) into `DEV_MANIFEST_KEY`, so unpacked builds share the store id and one `.env` value works everywhere.
- [ ] **Step 4: Check production** with the store build: import a league on `court-vizion.netlify.app` through the extension.
- [ ] **Step 5: Commit** any `DEV_MANIFEST_KEY` change (`CV: pin the extension's dev key to the store item`).
