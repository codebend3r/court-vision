# Player Headshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NBA CDN headshots (with initials fallback) beside every player in the `/players` table and the player-page header, keyed by a one-time name→NBA-person-id mapping.

**Architecture:** New nullable `Player.nbaPersonId` column; a `map:headshots` Bun script fetches a static NBA player index, matches by normalized name, and writes ids; a client `PlayerAvatar` renders the CDN image with an initials fallback on error/absence.

**Tech Stack:** Prisma migration, zod, next/image (remote pattern), Bun script.

**Spec:** `docs/superpowers/specs/2026-07-10-player-headshots-design.md`

## Global Constraints

- Current branch; no `any`/`as` casts; `?.` with `??`; no `for/of`; single-object params; SCSS tokens; co-located tests; Bun; `CV:` commits.
- Headshot URL exactly: `https://cdn.nba.com/headshots/nba/latest/1040x760/<personId>.png`.
- Mapping matches ONLY players that have game logs (the 603 current players); ambiguity (duplicate normalized name on either side) → null + log the name.

---

### Task 1: Schema + mapping script

**Files:**

- Modify: `prisma/schema.prisma` (Player gains `nbaPersonId Int?`), migration via `bunx prisma migrate dev --name add_nba_person_id` (DIRECT_URL env override — see below), `package.json` (script `"map:headshots": "bun run src/lib/headshots/map.ts"`)
- Create: `src/lib/headshots/sources.ts` (fetch + zod-validate the index), `src/lib/headshots/map.ts` (match + persist + entry block), `src/lib/headshots/url.ts` (`headshotUrl({ nbaPersonId }): string`)
- Test: `src/lib/headshots/map.test.ts`, `src/lib/headshots/url.test.ts`

**Interfaces:**

- Produces: `headshotUrl({ nbaPersonId }: { nbaPersonId: number }): string`; `mapHeadshots(deps?: { fetchImpl?: typeof fetch }): Promise<{ matched: number; unmatched: string[] }>`; `fetchNbaPlayerIndex({ fetchImpl }): Promise<Array<{ personId: number; fullName: string }>>`.

**Steps:**

- [ ] Migration: run with `DATABASE_URL=$(grep '^DIRECT_URL' .env | cut -d'"' -f2) bunx prisma migrate dev --name add_nba_person_id` (session pooler; the transaction pooler can't run migrations). Regenerate client (`bun run db:generate` runs automatically with migrate dev).
- [ ] TDD `url.ts`: `headshotUrl({ nbaPersonId: 1630162 })` → exact URL string.
- [ ] TDD `sources.ts` + `map.ts` with mocked fetch/prisma (mirror `seed.test.ts` mock style):
  - index rows validate via zod (`{ personId: number, fullName: string }` after source-specific transform);
  - PRIMARY source (probe at implementation): `https://cdn.nba.com/static/json/staticData/playerindex_00.json` — shape inspection required; if unreachable/wrong shape, FALLBACK: nba_api static data from raw.githubusercontent (`https://raw.githubusercontent.com/swar/nba_api/master/src/nba_api/stats/library/data.py` — parse the `players` tuple lines with a regex into (id, full_name); validate row count > 4000). Whichever source works, wrap it in `fetchNbaPlayerIndex` so `map.ts` is source-agnostic. Record which source worked in the report.
  - matching: `normalizeName` (from `@/lib/demo/names`) over our players with `gameLogs: { some: {} }`; skip + collect names with 0 or 2+ index matches, or where two of OUR players normalize identically;
  - persist: per-row `prisma.player.update({ where: { id }, data: { nbaPersonId } })` sequentially (reduce-chain); return `{ matched, unmatched }` and log both.
- [ ] Full suite; commit — `CV: add nbaPersonId + headshot mapping script`
- [ ] **Controller runs live:** `bun run map:headshots` against Supabase; record matched/unmatched counts in the ledger; spot-check 3 URLs return 200 (curl HEAD).

---

### Task 2: PlayerAvatar component

**Files:**

- Create: `src/components/PlayerAvatar/PlayerAvatar.tsx` + `.module.scss` + test
- Modify: `next.config.ts` (images.remotePatterns for `cdn.nba.com`)

**Interfaces:**

- Produces: `PlayerAvatar({ fullName, nbaPersonId, size }: { fullName: string; nbaPersonId: number | null; size: "sm" | "lg" })` — client component.

**Steps:**

- [ ] TDD: (a) with id → `<img>` with src containing `/headshots/nba/latest/1040x760/<id>.png` and `alt={fullName}`; (b) `nbaPersonId: null` → no img, initials text (e.g. "AE" for "Anthony Edwards"; first char of first + last word, uppercased); (c) `fireEvent.error(img)` → initials replace the img.
- [ ] Implement: `"use client"`; `const [failed, setFailed] = useState(false);` show initials when `nbaPersonId === null || failed`; `next/image` with `width/height` 32 (sm) / 96 (lg), `onError={() => setFailed(true)}`, class per size; SCSS: circle (`--radius-full`), surface bg, border token, centered initials in `--font-size-xs`/`sm` muted. Initials via `fullName.split(" ").filter(Boolean)` first+last word initial (reduce/slice, no loops).
- [ ] next.config: `images: { remotePatterns: [{ protocol: "https", hostname: "cdn.nba.com" }] }` (merge with existing config keys).
- [ ] Full suite; commit — `CV: add PlayerAvatar (NBA CDN headshot + initials fallback)`

---

### Task 3: Integration

**Files:**

- Modify: `src/lib/players/search.ts` (select + `PlayerRow` gain `nbaPersonId`), `src/lib/players/search.test.ts` (select shape assertions), `src/app/players/page.tsx` (avatar `sm` in the Name cell), `src/app/players/[playerId]/page.tsx` (avatar `lg` in header; player query already selects the full row → passes `player.nbaPersonId`), both page tests (avatar presence via alt text), page SCSS (name cell becomes an icon+text row; header becomes avatar+text grid), README (layout tree + a line in the Data layer section about `map:headshots`).

**Steps:**

- [ ] TDD page/table tests for avatar presence (mock rows with and without `nbaPersonId`); RED → implement → GREEN.
- [ ] `bun run system-check` + `bun run build`; commit — `CV: show player headshots in table and player header`
- [ ] **Controller verification:** live screenshots of `/players` and a player page; confirm real photos render and a null-id row shows initials.

## Self-review notes

Spec §2→Task 1; §3→Tasks 2-3; §4 tests distributed; URL/`nbaPersonId`/`PlayerAvatar` names consistent across tasks; migration uses DIRECT_URL per repo convention.
