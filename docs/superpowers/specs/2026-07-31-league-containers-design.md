# League Containers + User Settings — Design

Date: 2026-07-31
Branch: `league-containers`

## Summary

Introduce **League Containers**: a user can own multiple leagues, each with its own
fantasy teams, starred (watchlisted) players, and fantasy setup — H2H with any
configuration of categories, H2H Points (linear), or Rotisserie. Leagues absorb the
existing global **My Teams** (localStorage) and **Starred** (DB watchlist) features.
Also introduce a **Settings** page for logged-in users: preferred fantasy value
formula, app-wide font-size scale with a live preview, and a Theme placeholder
section.

One league is **active** at a time (persisted per profile). Existing routes keep
their URLs and scope to the active league.

## Data model (Prisma + Supabase RLS)

All new tables follow the `WatchlistPlayer` precedent: owner `profileId`, cascade
deletes, and a hand-written RLS migration using `auth.uid() = "profileId"`.

### `League`

- `id` (cuid), `profileId` (→ `Profile`, cascade)
- `name`, `slug` — `@@unique([profileId, slug])`
- `scoringType` — `"h2h_categories" | "h2h_points" | "roto"`
- `teamCount Int @default(12)` (2–30), `rosterSlots Int @default(13)` (1–25) —
  same bounds as the existing fantasy search params
- `scoringConfig Json` — validated shape per `scoringType` (below)
- `createdAt`, `updatedAt`
- Cap: **max 10 leagues per profile**, enforced in a transaction (watchlist-cap
  pattern), returning a typed result.

### `LeagueTeam` + `LeagueTeamSlot`

- `LeagueTeam`: `id` (cuid), `leagueId` (cascade), `profileId` (denormalized for
  RLS), `name`, `slug` (`@@unique([leagueId, slug])`), `createdAt`
- `LeagueTeamSlot`: `id` (cuid), `teamId` (cascade), `profileId`, `slotType`
  (values from existing `SLOT_META` in `lib/fantasyTeams/slots.ts`), `playerId Int?`
  (→ `Player`), `position Int` for ordering
- Replaces the localStorage `FantasyTeam { id, name, slots }` shape.

### `LeagueWatchlistPlayer`

- `@@id([leagueId, playerId])`, plus `profileId`, `createdAt`,
  `@@index([leagueId, createdAt(sort: Desc)])`
- Replaces the global `WatchlistPlayer` table. The 50-player cap becomes
  **per league** (`MAX_WATCHLIST = 50` unchanged).

### `Profile` additions

- `activeLeagueId String?` (→ `League`, `onDelete: SetNull`)
- `preferredFormula String?` — a `FantasyMethodKey` from
  `lib/valuation/registry.ts`; `null` means the current default behavior
- `fontScale String @default("default")` — `"sm" | "default" | "lg" | "xl"`

### `scoringConfig` shapes

Stored as JSON because the valuation engine already consumes these as whole
objects. Each shape is validated by a **type guard** (unit tested, no casts):

- `h2h_categories`: `{ categories: CategoryKey[], weights?: Partial<Record<CategoryKey, number>> }`
  (subset of the 9 keys in `lib/valuation/categories.ts`)
- `h2h_points`: `{ scoring: PointsScoring }` — same keys as
  `DEFAULT_POINTS_SCORING` / `SCORED_KEYS` in `lib/valuation/methods/points.ts`
- `roto`: `{ categories: CategoryKey[] }`

## Migration of existing data

1. **Schema migration** (`prisma migrate dev`): create the three league tables and
   the `Profile` columns.
2. **RLS migration**: hand-written SQL (like
   `prisma/migrations/20260731143800_watchlist_rls/`) enabling RLS + owner
   policies on all three tables.
3. **Data migration** (SQL, same migration series): for every profile with
   `WatchlistPlayer` rows, create a default league — name **"My League"**, slug
   `my-league`, `h2h_categories` with all 9 categories, defaults 12/13 — set it as
   `activeLeagueId`, copy watchlist rows into `LeagueWatchlistPlayer`, then **drop
   `WatchlistPlayer`**.
4. **`ensureDefaultLeague()`** server helper: creates + activates "My League" on
   demand for profiles that reach a league-scoped page with no leagues (new
   signups, empty profiles).
5. **localStorage teams**: a one-time client migrator component (rendered in the
   root layout alongside `WatchlistHydrator`) reads the persisted
   `court-vision-fantasy-teams` store; if it has teams and the default league has
   none, it imports them via server action into the default league, then clears
   the localStorage key.

## Navigation & routes

### SideNav

- New entry **Leagues** → `/leagues` (alias rule for `/leagues/*`), added to
  `NAV_ENTRIES` in `components/SideNav/SideNav.tsx`; existing `SideNav.test.tsx`
  updated.
- New **active-league switcher** section in the side menu: shows the active
  league's name; expanding it lists the profile's leagues; selecting one calls the
  `setActiveLeague` server action (optimistic zustand update). Includes a link to
  `/leagues` for management.

### Routes

- `/leagues` — league cards: name, scoring-type badge, team/slot counts, active
  marker; actions: create, edit, delete, set active.
- `/leagues/create` — setup form: name, scoring type, then per-type config
  (category picker + weights, points table, teams/slots steppers) reusing the
  `FantasyControls` control patterns and `control-*` mixins.
- `/leagues/[leagueSlug]` — view/edit the same setup for one league.
- `/settings` — see below.
- All new pages are auth-gated per-page (`getProfile()` → `redirect("/login")`,
  the existing pattern) and `force-dynamic` where they read data.

### Existing pages, league-scoped

- `/my-teams` (+ `/create`, `/[teamSlug]`) and `/watchlist` keep their URLs but
  read/write the **active league's** teams and stars; each shows the active league
  name.
- **Fantasy Value tab**: when a fantasy URL param is absent, its default is seeded
  from the active league (`teams`, `slots`, excluded categories `x`, weights `w`,
  points scoring `s`) and from `preferredFormula` (`sort`). Explicit URL params
  always win, so shared links keep meaning what they said. No new scoring engines
  in this phase — league config only drives existing valuation defaults.

## Settings page (`/settings`)

Linked from the `AccountMenu` dropdown. Three sections:

1. **Fantasy** — preferred value formula picker listing registry methods with
   `available: true`, using their existing `label`/`description` copy. Persists to
   `Profile.preferredFormula`; drives the fantasy tab's default sort and any
   surface that picks a default method (e.g. team insights).
2. **Appearance** — one app-wide font-size scale: **Small / Default / Large /
   X-Large**, with a **live preview panel** beside the controls (sample heading,
   body text, and a stats-table row that re-render at the hovered/selected scale
   before saving). Persisted to `Profile.fontScale`; applied as
   `data-font-scale="..."` on `<html>` in the root layout (server-rendered from
   the profile — no flash, no init script). `globals.scss` re-declares the
   `--font-size-*` tokens under each `[data-font-scale="..."]` selector; existing
   components pick the change up through tokens.
3. **Theme** — placeholder section rendering "Something soon." The header
   `ThemeToggle` is untouched.

Saves are immediate server actions with optimistic store updates. Retro design
language throughout (`retro-button`, `control-radio`/`control-field`, tokens
only).

## State & code layout

- `src/lib/leagues/` — `actions.ts` (`createLeague`, `updateLeague`,
  `deleteLeague`, `setActiveLeague`, `createLeagueTeam`, `updateTeamRoster`,
  `deleteLeagueTeam` — all single-object params), `queries.ts`, `guards.ts`
  (+ `guards.test.ts`), `constants.ts` (caps), `store.ts` — non-persisted zustand
  (DB is truth) holding the profile's leagues and active league id; hydrated from
  the root layout (alongside `WatchlistHydrator`).
- `src/lib/settings/` — `actions.ts` (`updatePreferences`), `guards.ts` (+ tests)
  for `preferredFormula` / `fontScale` values.
- `src/lib/watchlist/` — keeps owning star/unstar actions, queries, and the
  starred-ids store, all become league-scoped (operating on the active league's
  `LeagueWatchlistPlayer` rows); trend + alert features unchanged in behavior.
- `src/lib/fantasyTeams/store.ts` is retired; `slots.ts` (`SLOT_META`), `slug.ts`,
  `players.ts`, `insights.ts` are kept and reused. Team components
  (`MyTeamsList`, `TeamBuilder`, `TeamEditor`, `TeamMatchup`, `HomeTeamPanel`)
  read/write through the league store + server actions.
- Components: `LeagueSwitcher/`, `LeagueCard/`, `LeagueForm/` (create/edit),
  `SettingsSections/` (or per-section components), `FontScalePreview/` — each with
  co-located `.module.scss` and `.test.tsx`.

## Error handling & edge cases

- Caps enforced in transactions with typed results (existing `starPlayer`
  pattern): 10 leagues/profile, 50 stars/league, roster ≤ `rosterSlots`.
- Deleting the active league: `activeLeagueId` falls back to the most recently
  updated remaining league; if none remain, league-scoped pages show a
  create-a-league prompt.
- Invalid/stale `scoringConfig` JSON: guards reject, UI falls back to the
  scoring type's defaults instead of crashing.
- Slug collisions within a profile/league get a numeric suffix (existing
  `fantasyTeams/slug.ts` behavior).
- Logged-out users never see leagues or settings (SideNav is already gated;
  pages redirect).

## Testing

- Unit tests (all through `bun run test`): scoring-config + preference type
  guards, slug generation, league store, cap logic.
- Component tests: `SideNav` (updated entries + switcher), `LeagueForm` per
  scoring type, `FontScalePreview`, settings sections.
- Existing watchlist and team tests updated to the league-scoped APIs.

## Out of scope

- Shared / multi-user leagues (schema keeps `profileId` ownership only).
- Roto standings and H2H matchup/projection engines per scoring type.
- Theme customization beyond the placeholder section.
- SGP availability and auction values (tracked separately in the valuation PRD).

## Implementation notes (2026-08-01)

Deviations from this design as actually built, found during the Task 15
verification pass:

- `deleteLeague` only reassigns `activeLeagueId` when the deleted league
  _was_ the active one; forged/foreign ids return `{ status: "error" }`
  instead of the unconditional fallback promotion this doc's "Error handling"
  section implies.
- Team saves navigate to `/my-teams` on success, not back to the team's own
  edit page as prior UX did.
- No dedicated zustand store for league teams — server components pass team
  props down and re-fetch on navigation; only leagues and the watchlist have
  stores (already called out as a judgment call in Task 15's self-review
  notes, formalized here).
- `ensureDefaultLeague` accepts an optional `{ profile }` param so callers
  that already resolved the session can skip a second lookup.
- `importLegacyTeams` hardening: validation now matches `saveLeagueTeam`
  exactly (trimmed names, 1–60 roster slots per team, ≤50 teams), the count
  check runs inside the transaction, and `ensureDefaultLeague` failures map
  to `{ status: "error" }` instead of throwing.
- `LeagueSwitcher`'s menu implements the full ARIA menu keyboard pattern
  (roving `tabindex`, Arrow/Home/End navigation, Escape restores focus to the
  trigger, blur/outside-click closes) — more than the spec's rough sketch
  called for.
- List surfaces (`/leagues`, `/my-teams`) wait for server confirmation before
  removing a row optimistically, and announce failures via `role="alert"`
  rather than failing silently.
- Migrations were applied via `prisma migrate diff` + `db execute` +
  `migrate resolve` rather than `prisma migrate dev`, because the shadow
  database can't replay migrations that reference `auth.uid()` (no `auth`
  schema exists there). `bun run db:migrate` will hit Prisma error P3006
  until a `SHADOW_DATABASE_URL` pointing at a database with a stub `auth`
  schema is provisioned, or this workflow is adopted as the standard path.
