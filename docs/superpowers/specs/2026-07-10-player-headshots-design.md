# Player headshots — design

Date: 2026-07-10
Status: Approved (source + placement chosen by user)
Depends on: `/players` table, `/players/[playerId]` page

## 1. Goal

Show a player photo beside every player: a large headshot in the player-page
header and a small thumbnail in each `/players` table row. Photos come from
the official NBA CDN; anyone unmatched (and retired players) gets an initials
avatar. Our `Player.id` is Balldontlie's id, so a one-time name→NBA-person-id
mapping supplies the image key.

## 2. Data

- Prisma: `Player.nbaPersonId Int?` (new migration; null = no headshot).
- Mapping script `bun run map:headshots` (`src/lib/headshots/map.ts`):
  1. Fetch a static NBA player index. Primary source: NBA's CDN static player
     index (probe at implementation; `cdn.nba.com` is a CDN host, distinct
     from the tarpitted `stats.nba.com`). Fallback source: the static player
     list bundled in the `nba_api` GitHub repository (raw.githubusercontent).
     Either yields `(personId, fullName)` pairs; the script validates shape
     with zod before use.
  2. Match against our 603 current players (those with game logs) by
     `normalizeName(fullName)` (reuse `src/lib/demo/names.ts`). Ambiguous
     (duplicate normalized names on either side) → leave null and log.
  3. `updateMany`/per-row update of `nbaPersonId`; idempotent; logs
     matched/unmatched counts and unmatched names.
- Headshot URL: `https://cdn.nba.com/headshots/nba/latest/1040x760/<personId>.png`
  (built by a pure `headshotUrl({ nbaPersonId })` helper).

## 3. UI

- `PlayerAvatar` (`src/components/PlayerAvatar/`, client): props
  `{ fullName: string; nbaPersonId: number | null; size: "sm" | "lg" }`.
  - With `nbaPersonId`: `next/image` (`cdn.nba.com` added to
    `images.remotePatterns` in `next.config.ts`), alt = fullName, rounded;
    `onError` state flips to the initials fallback.
  - Without: initials circle (first letters of first/last name), background
    `--color-surface`, border token, muted text; sizes: sm 32px (table), lg
    96px (player header).
- `/players` table: avatar (`sm`) before the name in the Name cell; query
  layer `PlayerRow` gains `nbaPersonId`.
- `/players/[playerId]` header: avatar (`lg`) beside the name block;
  page select gains `nbaPersonId`.

## 4. Testing

- `map.test.ts`: matching logic — exact match sets id, unmatched stays null,
  duplicate-name ambiguity stays null (mocked fetch + prisma).
- `headshotUrl` test.
- `PlayerAvatar.test.tsx`: renders img with CDN src when id present; initials
  when null; error → initials (fire `error` event on the img).
- Page/table tests updated for the avatar's presence (alt text per player).

## 5. Out of scope

- Headshots for retired/historical players; periodic re-mapping automation;
  self-hosting images.
