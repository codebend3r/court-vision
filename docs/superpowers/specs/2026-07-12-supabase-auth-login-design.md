# Supabase Auth Login — Design

**Date:** 2026-07-12
**Status:** Approved
**Topic:** Email/password login on Supabase Auth, with a per-user `Profile` foundation for future fantasy teams, watchlists, and gated content.

## Goal

Add user login to Court Vision so people can sign up, confirm their email, sign in, and sign out. Lay the minimal user-identity foundation (a `Profile` with a `tier` and a unique `username`) that future features hang off of, without building those features yet.

Out of scope (future work): fantasy teams, watchlists, exclusive/gated content, custom SMTP, OAuth providers, password reset.

## Decisions (as brainstormed)

- **Auth method:** email + password.
- **Email confirmation:** required before first login (Supabase default).
- **Scope:** auth + a `Profile` table carrying `tier`. No fantasy/watchlist tables yet (YAGNI).
- **Username:** required at signup, unique (case-insensitive), shown in the header when signed in.
- **Header:** top-right button — "Sign in" when signed out; an `@username` dropdown (→ Sign out) when signed in.
- **Architecture:** Approach A — `@supabase/ssr` owns auth; Prisma owns the `Profile` table; the two meet where a Postgres trigger seeds a `Profile` row from a new `auth.users` row.

## Architecture (Approach A)

Supabase Auth (GoTrue) owns `auth.users` and the entire email/password/confirmation machinery. We add a `Profile` table as a Prisma model whose primary key equals the auth user's UUID. Sessions are cookie-based via `@supabase/ssr`; `middleware.ts` refreshes them. Server code reads the session from a Supabase server client, then reads/writes `Profile` through Prisma using the `postgres` role — the same server-side data-access pattern the app already uses for players.

This keeps a single data-access story (Prisma for app data), reuses the established out-of-band-SQL habit (RLS was applied the same way) for the trigger + functional index, and uses the canonical App Router auth integration.

### Why not the alternatives

- **Pure Supabase (skip Prisma for user data):** splits the data layer (players via Prisma, profile via supabase-js), loses Prisma typing for `Profile`, diverges from the existing read pattern.
- **Custom session over Supabase JWTs:** unnecessary complexity; `@supabase/ssr` already solves cookie/session refresh correctly.

## Data model

### Prisma `Profile` model (new migration)

| Field         | Type                       | Notes                                                                                                    |
| ------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `id`          | `String @id @db.Uuid`      | Equals `auth.users.id`.                                                                                  |
| `email`       | `String`                   | Mirrored from auth for display/convenience.                                                              |
| `username`    | `String @unique`           | Required. Case-insensitive uniqueness enforced by a functional index (below), not this constraint alone. |
| `tier`        | `String @default("free")`  | Gating hook: `free` \| `pro`. Server/admin-writable only.                                                |
| `displayName` | `String?`                  | Optional friendly name.                                                                                  |
| `createdAt`   | `DateTime @default(now())` |                                                                                                          |
| `updatedAt`   | `DateTime @updatedAt`      |                                                                                                          |

`Profile` has no relations yet; future `FantasyTeam` / `WatchlistItem` models will reference `Profile.id`.

### Out-of-band SQL (via `prisma db execute` against `DIRECT_URL`)

Applied outside repo migrations because it touches the `auth` schema and Postgres-role-specific constructs — the same channel used for the existing RLS policies.

1. **`handle_new_user()` trigger** on `auth.users` (AFTER INSERT): inserts
   `public."Profile" (id, email, username)` reading
   `new.id`, `new.email`, and `new.raw_user_meta_data->>'username'`.
   Runs in the same transaction as the auth insert, so the username is reserved at signup time (before email confirmation). A duplicate username makes the insert fail, which fails the signup — surfaced to the user as "username taken".
2. **Functional unique index** `create unique index on public."Profile" (lower(username));` — the real, case-insensitive uniqueness guard; wins any race.
3. **RLS on `Profile`:** enable RLS; owner-only `SELECT`/`UPDATE` policies for `authenticated` (`auth.uid() = id`), no `INSERT`/`DELETE` for `anon`/`authenticated`. Defense-in-depth — the server still reads via Prisma/postgres, which bypasses RLS. `tier` is never client-writable.

### Supabase dashboard config

- Enable the **Email** auth provider.
- Keep **Confirm email** on.
- Set **Site URL** and the **redirect allowlist** to include the `/auth/confirm` callback for local dev and any deployed origin.

## Auth flows, routes & UI

Route group `src/app/(auth)/` for the pages, plus callback route handlers.

- **`/login`** — client component form (email + password) → `supabase.auth.signInWithPassword`. On success redirect to `/` (honor a `?next=` param if present). Inline errors for bad credentials / unconfirmed email.
- **`/signup`** — client form (email + username + password). Submits to a **server action** that:
  1. validates format with zod,
  2. checks username availability (Prisma query on `lower(username)`),
  3. calls `supabase.auth.signUp` passing `{ options: { data: { username } } }`.
     Because confirmation is on, no session is returned → render a **"check your email"** state.
- **`/auth/confirm`** — route handler that exchanges the emailed token for a session (`verifyOtp` / code exchange) then redirects to `/`. This is the URL embedded in the confirmation email.
- **`/auth/signout`** — POST route handler → `supabase.auth.signOut()` → redirect to `/`.

**Username availability check:** a small server route (e.g. `GET /api/username-available?u=`) queried debounced from the signup form. The functional unique index remains the source of truth; the check is UX only, and the signup server action maps a unique-violation to "That username is taken."

**Username rules (zod):** 3–20 chars, `[a-z0-9_]`, plus a reserved-name blocklist (`admin`, `login`, `signup`, `auth`, etc.).

**Header (`SiteHeader`, becomes a server component reading the session):**

- Signed out → **"Sign in"** button (top-right).
- Signed in → button showing **`@username`** opening a small dropdown: username → **Sign out** (room for an "Account" link later). Sign out posts to `/auth/signout`.

## Session handling, middleware & helpers

- **`src/lib/supabase/`** via `@supabase/ssr`:
  - `client.ts` — browser client (form components).
  - `server.ts` — server client bound to Next's cookie store (server components, actions, route handlers).
  - `middleware.ts` — helper that refreshes the auth cookie per request.
- **`src/middleware.ts`** — invokes the refresh helper; matcher excludes static assets. No route _gating_ yet (nothing to protect); the pattern is in place for later.
- **`src/lib/auth/session.ts`** — server helpers:
  - `getUser()` → Supabase auth user or `null`.
  - `getProfile()` → the Prisma `Profile` (`tier`, `username`, …) for the current user or `null`. Single seam future gating reads from (`profile?.tier === "pro"`).
- **Env** (added to `.env`, documented in README): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key `sb_publishable_JFGtdul178hds6E3XfGuPw_RiBJOxbo`, URL `https://invmrcgjbdgfemrytlfp.supabase.co`).

## Testing & rollout

### Automated (Vitest + Testing Library, co-located)

- **Unit:** zod username/password validators; `getProfile`/tier helper logic with the Supabase client mocked; the "username taken" unique-violation → error-message mapping.
- **Component:** login & signup forms (validation errors render; submit calls the right method / server action); `SiteHeader` renders "Sign in" vs. the `@username` dropdown for the two states.

### Not unit-tested (manual QA against the real project)

The live Supabase Auth round-trip and the DB trigger are verified by hand:

1. Sign up with a new email + username → see "check your email".
2. Confirmation email arrives → click link → `/auth/confirm` lands you signed-in on `/`.
3. Header shows `@username`; dropdown → Sign out returns to signed-out state.
4. Duplicate username is rejected (availability check + hard failure).
5. Unconfirmed-email login attempt shows the right error.

### Rollout order

1. Prisma `Profile` migration.
2. Out-of-band SQL: trigger + functional unique index + RLS (via `prisma db execute` against `DIRECT_URL`).
3. Supabase dashboard: enable email provider, confirm-email on, Site URL + redirect allowlist.
4. App code: Supabase clients, middleware, session helpers, routes, forms, header.
5. Manual QA checklist above.

## Dependencies

- Add `@supabase/ssr` and `@supabase/supabase-js`, pinned to exact versions (per CLAUDE.md).
