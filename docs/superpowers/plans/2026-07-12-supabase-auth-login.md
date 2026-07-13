# Supabase Auth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password login on Supabase Auth with a Prisma `Profile` (unique username + `tier`) foundation, plus a top-right header sign-in / `@username` control.

**Architecture:** `@supabase/ssr` owns auth (cookie sessions refreshed in `middleware.ts`); Prisma owns a `Profile` table keyed to `auth.users.id`. A Postgres trigger seeds a `Profile` from each new `auth.users` row (reserving the username at signup). Server code reads the session via a Supabase server client, then reads/writes `Profile` through Prisma (postgres role, bypasses RLS).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma 7 (`@prisma/adapter-pg`), Supabase Postgres + Auth, `@supabase/ssr` 0.12.0, `@supabase/supabase-js` 2.110.2, zod 4, Vitest + Testing Library, SCSS modules, Bun.

## Global Constraints

- All scripts run through **Bun** (`bun install`, `bun run test`, etc.). Never npm/yarn.
- Pin every `package.json` dependency to an **exact** version (no `^`/`~`).
- **No `any`**, no type casts; use type guards / `unknown`. Optional chaining always paired with `??`. Prefer `!!` for boolean coercion. Prefer `Array.prototype` methods over loops; never `for/in`/`for/of`. Single object param over positional args.
- SCSS modules for component styles; use design tokens from `styles/globals.scss` for color/size/spacing/radius. Container-driven layout, grid-with-gap first, avoid class-less `div`s.
- Tests co-located (`Foo.tsx` ↔ `Foo.test.tsx`, `foo.ts` ↔ `foo.test.ts`).
- `@/*` import alias maps to `src/*`; generated Prisma client imports from `@generated/prisma/client`.
- Commit after each logical change; subject starts with `CV:`. No Claude/Co-Authored-By attribution trailers.
- Supabase project `invmrcgjbdgfemrytlfp`; URL `https://invmrcgjbdgfemrytlfp.supabase.co`; publishable key `sb_publishable_JFGtdul178hds6E3XfGuPw_RiBJOxbo`. `.env` `DATABASE_URL` = transaction pooler (runtime), `DIRECT_URL` = session pooler (migrations).

---

## File Structure

- `src/lib/supabase/client.ts` — browser Supabase client.
- `src/lib/supabase/server.ts` — cookie-bound server Supabase client.
- `src/lib/supabase/middleware.ts` — `updateSession` cookie-refresh helper.
- `src/middleware.ts` — Next middleware calling `updateSession`.
- `src/lib/auth/username.ts` (+ `.test.ts`) — zod username schema, reserved blocklist, normalize.
- `src/lib/auth/session.ts` (+ `.test.ts`) — `getUser()`, `getProfile()`.
- `src/lib/auth/signup.ts` (+ `.test.ts`) — signup server action + unique-violation → error mapping.
- `src/app/api/username-available/route.ts` — availability GET route.
- `src/app/(auth)/login/page.tsx`, `LoginForm.tsx` (+ `.test.tsx`), `login.module.scss`.
- `src/app/(auth)/signup/page.tsx`, `SignupForm.tsx` (+ `.test.tsx`), `signup.module.scss`.
- `src/app/(auth)/auth.module.scss` — shared auth-page shell styles.
- `src/app/auth/confirm/route.ts` — email-confirmation callback.
- `src/app/auth/signout/route.ts` — POST sign-out.
- `src/components/AccountMenu/AccountMenu.tsx` (+ `.test.tsx`), `AccountMenu.module.scss` — client dropdown.
- `src/components/SiteHeader/SiteHeader.tsx` — becomes async server component reading session.
- `prisma/schema.prisma` — add `Profile` model.
- `prisma/migrations/<ts>_add_profile/migration.sql` — Profile table.
- `prisma/sql/profile_auth.sql` — out-of-band trigger + functional index + RLS (applied via `prisma db execute`).
- `.env`, `README.md` — env vars + docs.

---

## Task 1: Dependencies, env, and Supabase clients

**Files:**

- Modify: `package.json` (deps), `.env` (env vars)
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`

**Interfaces:**

- Produces: `createClient()` (browser) from `client.ts`; `createClient()` (async, server) from `server.ts`; `updateSession(request: NextRequest): Promise<NextResponse>` from `supabase/middleware.ts`.

- [ ] **Step 1: Install pinned deps**

Run: `bun add @supabase/ssr@0.12.0 @supabase/supabase-js@2.110.2`
Expected: both appear in `package.json` `dependencies` with exact versions (no `^`). If Bun adds a caret, edit to exact.

- [ ] **Step 2: Add env vars to `.env`**

Append:

```
NEXT_PUBLIC_SUPABASE_URL="https://invmrcgjbdgfemrytlfp.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_JFGtdul178hds6E3XfGuPw_RiBJOxbo"
```

- [ ] **Step 3: Browser client** — create `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  );
}
```

- [ ] **Step 4: Server client** — create `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 5: Session-refresh helper** — create `src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser(). Keep this call.
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 6: Next middleware** — create `src/middleware.ts`

```typescript
import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 7: Verify typecheck + lint + build**

Run: `bun run typecheck && bun run lint`
Expected: pass. (No new tests — these modules wrap SDK config and are exercised by later tasks + manual QA.)

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock src/lib/supabase src/middleware.ts
git commit -m "CV: add @supabase/ssr clients and session-refresh middleware"
```

---

## Task 2: Prisma `Profile` model, migration, and auth SQL

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_profile/migration.sql`, `prisma/sql/profile_auth.sql`

**Interfaces:**

- Produces: `Profile` model on the Prisma client — `{ id: string; email: string; username: string; tier: string; displayName: string | null; createdAt: Date; updatedAt: Date }`.

- [ ] **Step 1: Add the model** to `prisma/schema.prisma` (after `Player`)

```prisma
model Profile {
  id          String   @id @db.Uuid
  email       String
  username    String   @unique
  tier        String   @default("free")
  displayName String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: Create the migration SQL** — `prisma/migrations/<timestamp>_add_profile/migration.sql`

Use a UTC timestamp folder name in the existing format (e.g. `20260712NNNNNN_add_profile`). Contents:

```sql
-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");
```

- [ ] **Step 3: Apply the migration against Supabase (DIRECT_URL)**

Run:

```bash
DATABASE_URL=$(grep '^DIRECT_URL' .env | cut -d'"' -f2) bunx prisma migrate deploy
```

Expected: "1 migration applied" (the `_add_profile` migration). Then `bun run db:generate` regenerates the client.

- [ ] **Step 4: Author the out-of-band auth SQL** — `prisma/sql/profile_auth.sql`

```sql
-- Case-insensitive uniqueness (source of truth; wins races).
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_username_lower_key"
  ON public."Profile" (lower(username));

-- Seed a Profile row whenever a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."Profile" (id, email, username, "updatedAt")
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'username',
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: defense-in-depth. Server reads via postgres (bypasses RLS).
ALTER TABLE public."Profile" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile owner can read" ON public."Profile";
CREATE POLICY "Profile owner can read" ON public."Profile"
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profile owner can update" ON public."Profile";
CREATE POLICY "Profile owner can update" ON public."Profile"
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

- [ ] **Step 5: Apply the auth SQL**

Run:

```bash
DATABASE_URL=$(grep '^DIRECT_URL' .env | cut -d'"' -f2) bunx prisma db execute --file prisma/sql/profile_auth.sql
```

Expected: success, no error.

- [ ] **Step 6: Verify schema in DB**

Run:

```bash
DATABASE_URL=$(grep '^DIRECT_URL' .env | cut -d'"' -f2) bunx prisma db execute --stdin <<'SQL'
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
SQL
```

Expected: no error (trigger exists).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/sql
git commit -m "CV: add Profile model, migration, and auth trigger/RLS SQL"
```

---

## Task 3: Username validation

**Files:**

- Create: `src/lib/auth/username.ts`, `src/lib/auth/username.test.ts`

**Interfaces:**

- Produces: `normalizeUsername(value: string): string`; `usernameSchema` (zod, min 3 / max 20 / `^[a-z0-9_]+$` / not reserved); `isValidUsername(value: string): boolean`.

- [ ] **Step 1: Write the failing test** — `src/lib/auth/username.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { isValidUsername, normalizeUsername, usernameSchema } from "./username";

describe("username", () => {
  it("normalizes case and trims", () => {
    expect(normalizeUsername("  SteveN_1 ")).toBe("steven_1");
  });

  it("accepts a valid username", () => {
    expect(usernameSchema.safeParse("court_vision7").success).toBe(true);
  });

  it("rejects too short, bad chars, and reserved names", () => {
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("has space")).toBe(false);
    expect(isValidUsername("Has-Dash")).toBe(false);
    expect(isValidUsername("admin")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/auth/username.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/lib/auth/username.ts`

```typescript
import { z } from "zod";

const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "login",
  "logout",
  "signup",
  "signin",
  "signout",
  "auth",
  "api",
  "settings",
  "account",
  "profile",
  "courtvision",
  "support",
]);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(3, "Username must be at least 3 characters.")
      .max(20, "Username must be at most 20 characters.")
      .regex(/^[a-z0-9_]+$/, "Use only lowercase letters, numbers, and underscores.")
      .refine((value) => !RESERVED.has(value), "That username is reserved."),
  );

export function isValidUsername(value: string): boolean {
  return usernameSchema.safeParse(value).success;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/auth/username.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/username.ts src/lib/auth/username.test.ts
git commit -m "CV: add username validation schema and helpers"
```

---

## Task 4: Session helpers

**Files:**

- Create: `src/lib/auth/session.ts`, `src/lib/auth/session.test.ts`

**Interfaces:**

- Consumes: `createClient()` from `@/lib/supabase/server`; `prisma` from `@/lib/prisma`.
- Produces: `getUser(): Promise<User | null>`; `getProfile(): Promise<Profile | null>` (Prisma `Profile` for the current auth user).

- [ ] **Step 1: Write the failing test** — `src/lib/auth/session.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { profile: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { getProfile } from "./session";

describe("getProfile", () => {
  beforeEach(() => {
    getUser.mockReset();
    findUnique.mockReset();
  });

  it("returns null when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getProfile()).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("looks up the profile by auth user id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "uuid-1" } } });
    findUnique.mockResolvedValue({ id: "uuid-1", username: "steve", tier: "free" });
    const profile = await getProfile();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "uuid-1" } });
    expect(profile?.username).toBe("steve");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/auth/session.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/lib/auth/session.ts`

```typescript
import type { Profile } from "@generated/prisma/client";
import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }
  return prisma.profile.findUnique({ where: { id: user.id } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/auth/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "CV: add getUser/getProfile server session helpers"
```

---

## Task 5: Username availability route + signup action

**Files:**

- Create: `src/app/api/username-available/route.ts`, `src/lib/auth/signup.ts`, `src/lib/auth/signup.test.ts`

**Interfaces:**

- Consumes: `usernameSchema`, `normalizeUsername` from `@/lib/auth/username`; `prisma`; `createClient` from `@/lib/supabase/server`.
- Produces: `isUsernameTaken(username: string): Promise<boolean>`; `signUp(input: { email: string; username: string; password: string }): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing test** — `src/lib/auth/signup.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpFn = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: signUpFn } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { profile: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

import { signUp } from "./signup";

describe("signUp", () => {
  beforeEach(() => {
    signUpFn.mockReset();
    findFirst.mockReset();
  });

  it("rejects an invalid username before hitting Supabase", async () => {
    const result = await signUp({ email: "a@b.com", username: "no", password: "password123" });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("at least 3") });
    expect(signUpFn).not.toHaveBeenCalled();
  });

  it("rejects a taken username", async () => {
    findFirst.mockResolvedValue({ id: "x" });
    const result = await signUp({ email: "a@b.com", username: "steve", password: "password123" });
    expect(result).toEqual({ ok: false, error: "That username is taken." });
    expect(signUpFn).not.toHaveBeenCalled();
  });

  it("maps a Supabase unique violation to the taken message", async () => {
    findFirst.mockResolvedValue(null);
    signUpFn.mockResolvedValue({
      error: { message: "duplicate key value violates unique constraint" },
    });
    const result = await signUp({ email: "a@b.com", username: "steve", password: "password123" });
    expect(result).toEqual({ ok: false, error: "That username is taken." });
  });

  it("succeeds on a clean signup", async () => {
    findFirst.mockResolvedValue(null);
    signUpFn.mockResolvedValue({ error: null });
    const result = await signUp({ email: "a@b.com", username: "steve", password: "password123" });
    expect(result).toEqual({ ok: true });
    expect(signUpFn).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "password123",
      options: { data: { username: "steve" } },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/auth/signup.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/lib/auth/signup.ts`

```typescript
"use server";

import { z } from "zod";

import { normalizeUsername, usernameSchema } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  email: z.string().email("Enter a valid email."),
  username: usernameSchema,
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function isUsernameTaken(username: string): Promise<boolean> {
  const existing = await prisma.profile.findFirst({
    where: { username: { equals: normalizeUsername(username), mode: "insensitive" } },
    select: { id: true },
  });
  return !!existing;
}

type SignUpResult = { ok: true } | { ok: false; error: string };

export async function signUp(input: {
  email: string;
  username: string;
  password: string;
}): Promise<SignUpResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, username, password } = parsed.data;

  if (await isUsernameTaken(username)) {
    return { ok: false, error: "That username is taken." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return { ok: false, error: "That username is taken." };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/auth/signup.test.ts`
Expected: PASS.

- [ ] **Step 5: Availability route** — `src/app/api/username-available/route.ts`

```typescript
import { NextResponse, type NextRequest } from "next/server";

import { isUsernameTaken } from "@/lib/auth/signup";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = request.nextUrl.searchParams.get("u") ?? "";
  const username = normalizeUsername(raw);

  if (!isValidUsername(username)) {
    return NextResponse.json({ available: false, valid: false });
  }

  const taken = await isUsernameTaken(username);
  return NextResponse.json({ available: !taken, valid: true });
}
```

- [ ] **Step 6: Verify typecheck + tests**

Run: `bun run typecheck && bun run test src/lib/auth`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/signup.ts src/lib/auth/signup.test.ts src/app/api/username-available
git commit -m "CV: add signup action + username availability route"
```

---

## Task 6: Login & signup pages

**Files:**

- Create: `src/app/(auth)/auth.module.scss`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/LoginForm.tsx`, `src/app/(auth)/login/LoginForm.test.tsx`, `src/app/(auth)/login/login.module.scss`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/signup/SignupForm.tsx`, `src/app/(auth)/signup/SignupForm.test.tsx`, `src/app/(auth)/signup/signup.module.scss`

**Interfaces:**

- Consumes: `createClient` from `@/lib/supabase/client`; `signUp` from `@/lib/auth/signup`.
- Produces: `/login` and `/signup` routes.

- [ ] **Step 1: Write the failing test** — `src/app/(auth)/login/LoginForm.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const push = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    push.mockReset();
  });

  it("shows an error on bad credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(push).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test "src/app/(auth)/login/LoginForm.test.tsx"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `LoginForm`** — `src/app/(auth)/login/LoginForm.tsx`

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

import styles from "./login.module.scss";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {!!error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className={styles.alt}>
        No account? <Link href="/signup">Create one</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 4: Implement `/login` page** — `src/app/(auth)/login/page.tsx`

```tsx
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/session";

import authStyles from "../auth.module.scss";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getUser();
  if (user) {
    redirect("/");
  }
  const { next } = await searchParams;
  return (
    <main className={authStyles.shell}>
      <h1 className={authStyles.title}>Sign in</h1>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}
```

- [ ] **Step 5: Styles** — create `src/app/(auth)/auth.module.scss` and `src/app/(auth)/login/login.module.scss` using tokens from `styles/globals.scss` (grid layout, `gap`, token colors/radii/spacing). Minimal example for `login.module.scss`:

```scss
.form {
  display: grid;
  gap: var(--space-4);
  max-width: 22rem;
}

.field {
  display: grid;
  gap: var(--space-1);
}

.error {
  color: var(--color-danger);
}

.alt {
  color: var(--color-text-muted);
}
```

For `auth.module.scss`:

```scss
.shell {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
  justify-items: start;
}

.title {
  font-family: var(--font-display);
}
```

> Before writing these, open `src/styles/globals.scss` and use the actual token names defined there (spacing/color/radius). If a referenced token name differs, use the real one.

- [ ] **Step 6: Signup test** — `src/app/(auth)/signup/SignupForm.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpAction = vi.fn();

vi.mock("@/lib/auth/signup", () => ({ signUp: (...a: unknown[]) => signUpAction(...a) }));

import { SignupForm } from "./SignupForm";

describe("SignupForm", () => {
  beforeEach(() => signUpAction.mockReset());

  it("shows the check-email state on success", async () => {
    signUpAction.mockResolvedValue({ ok: true });
    render(<SignupForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/username/i), "steve");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("shows an error when the username is taken", async () => {
    signUpAction.mockResolvedValue({ ok: false, error: "That username is taken." });
    render(<SignupForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/username/i), "steve");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/that username is taken/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run signup test to verify it fails**

Run: `bun run test "src/app/(auth)/signup/SignupForm.test.tsx"`
Expected: FAIL (module not found).

- [ ] **Step 8: Implement `SignupForm`** — `src/app/(auth)/signup/SignupForm.tsx`

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { signUp } from "@/lib/auth/signup";

import styles from "./signup.module.scss";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await signUp({ email, username, password });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.sent}>
        <h2>Check your email</h2>
        <p>We sent a confirmation link to {email}. Click it to finish creating your account.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Username</span>
        <input
          type="text"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {!!error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className={styles.alt}>
        Have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 9: Implement `/signup` page** — `src/app/(auth)/signup/page.tsx`

```tsx
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/session";

import authStyles from "../auth.module.scss";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    redirect("/");
  }
  return (
    <main className={authStyles.shell}>
      <h1 className={authStyles.title}>Create your account</h1>
      <SignupForm />
    </main>
  );
}
```

- [ ] **Step 10: Signup styles** — `src/app/(auth)/signup/signup.module.scss` (mirror `login.module.scss`, adding a `.sent` block laid out with grid + gap + tokens).

```scss
.form {
  display: grid;
  gap: var(--space-4);
  max-width: 22rem;
}

.field {
  display: grid;
  gap: var(--space-1);
}

.error {
  color: var(--color-danger);
}

.alt {
  color: var(--color-text-muted);
}

.sent {
  display: grid;
  gap: var(--space-3);
  max-width: 28rem;
}
```

- [ ] **Step 11: Run auth page tests + typecheck**

Run: `bun run test "src/app/(auth)" && bun run typecheck`
Expected: pass.

- [ ] **Step 12: Commit**

```bash
git add "src/app/(auth)"
git commit -m "CV: add login and signup pages"
```

---

## Task 7: Confirm & sign-out route handlers

**Files:**

- Create: `src/app/auth/confirm/route.ts`, `src/app/auth/signout/route.ts`

**Interfaces:**

- Consumes: `createClient` from `@/lib/supabase/server`.
- Produces: `GET /auth/confirm`, `POST /auth/signout`.

- [ ] **Step 1: Implement `/auth/confirm`** — `src/app/auth/confirm/route.ts`

```typescript
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function isOtpType(value: string | null): value is EmailOtpType {
  return (
    value === "signup" ||
    value === "email" ||
    value === "recovery" ||
    value === "invite" ||
    value === "email_change"
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (!!tokenHash && isOtpType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=confirm", origin));
}
```

- [ ] **Step 2: Implement `/auth/signout`** — `src/app/auth/signout/route.ts`

```typescript
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: pass; both routes compile as route handlers.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth
git commit -m "CV: add email-confirm and sign-out route handlers"
```

---

## Task 8: Header account control

**Files:**

- Create: `src/components/AccountMenu/AccountMenu.tsx`, `src/components/AccountMenu/AccountMenu.test.tsx`, `src/components/AccountMenu/AccountMenu.module.scss`
- Modify: `src/components/SiteHeader/SiteHeader.tsx`, `src/components/SiteHeader/SiteHeader.module.scss`

**Interfaces:**

- Consumes: `getProfile` from `@/lib/auth/session`.
- Produces: `AccountMenu` client component `{ username: string }` rendering a dropdown with a sign-out form posting to `/auth/signout`.

- [ ] **Step 1: Write the failing test** — `src/components/AccountMenu/AccountMenu.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AccountMenu } from "./AccountMenu";

describe("AccountMenu", () => {
  it("shows the username and reveals sign out on click", async () => {
    render(<AccountMenu username="steve" />);
    const trigger = screen.getByRole("button", { name: /@steve/i });
    expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/AccountMenu/AccountMenu.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `AccountMenu`** — `src/components/AccountMenu/AccountMenu.tsx`

```tsx
"use client";

import { useState } from "react";

import styles from "./AccountMenu.module.scss";

export function AccountMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.menu}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        @{username}
      </button>
      {open && (
        <div className={styles.dropdown} role="menu">
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signout}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/AccountMenu/AccountMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Styles** — `src/components/AccountMenu/AccountMenu.module.scss` (position `.dropdown` absolutely under a `position: relative` `.menu`; tokens for color/radius/spacing; grid/gap inside the dropdown).

```scss
.menu {
  position: relative;
  display: grid;
}

.trigger {
  font-family: var(--font-display);
}

.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.signout {
  width: 100%;
}
```

> Confirm token names against `styles/globals.scss` and the existing `SiteHeader.module.scss` before finalizing.

- [ ] **Step 6: Update `SiteHeader`** — `src/components/SiteHeader/SiteHeader.tsx` (make it an async server component)

```tsx
import Image from "next/image";
import Link from "next/link";

import { AccountMenu } from "@/components/AccountMenu/AccountMenu";
import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
import { getProfile } from "@/lib/auth/session";

import mark from "../../../public/court-vision-mark.jpg";

import styles from "./SiteHeader.module.scss";

export async function SiteHeader() {
  const profile = await getProfile();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        <Image src={mark} alt="" width={32} height={32} className={styles.mark} priority />
        Court Vision
      </Link>
      <div className={styles.actions}>
        <ThemeToggle />
        {profile ? (
          <AccountMenu username={profile.username} />
        ) : (
          <Link href="/login" className={styles.signIn}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 7: Header styles** — add `.actions` (grid, `grid-auto-flow: column`, `gap`, `align-items: center`) and `.signIn` to `src/components/SiteHeader/SiteHeader.module.scss` using existing tokens. Read the current file first and append.

- [ ] **Step 8: Confirm `SiteHeader` is awaited in layout**

`src/app/layout.tsx` renders `<SiteHeader />`. Since it's now async, confirm the layout is a Server Component (it is — no `"use client"`). Next renders async Server Components directly; no change needed. Run `bun run build` to confirm.

- [ ] **Step 9: Run tests + full checks**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/AccountMenu src/components/SiteHeader
git commit -m "CV: add header sign-in link and @username account menu"
```

---

## Task 9: Docs + full system check + manual QA

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Document env + auth** in `README.md` — add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the env section, and a short "Auth" note (Supabase email/password, confirm-email on, `Profile` table seeded by the `on_auth_user_created` trigger, `prisma/sql/profile_auth.sql` applied out-of-band).

- [ ] **Step 2: Supabase dashboard config (manual, one-time)**

In the Supabase dashboard for `invmrcgjbdgfemrytlfp`:

- Authentication → Providers → **Email**: enabled, **Confirm email** ON.
- Authentication → URL Configuration → **Site URL** = `http://localhost:46644` (dev); add deployed origin later.
- **Redirect URLs**: add `http://localhost:46644/**`.
- Confirm the email template's confirmation URL points at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (default Supabase "Confirm signup" template uses `token_hash` + `type`).

- [ ] **Step 3: Full system check**

Run: `bun run system-check`
Expected: prettier + typecheck + lint + test + build all pass.

- [ ] **Step 4: Manual QA against the real project** (documented checklist; requires the dashboard config above)

1. `bun dev`, open `/signup`, register a new email + username → see "Check your email".
2. Open the confirmation email → click link → land signed-in on `/`; header shows `@username`.
3. Click `@username` → **Sign out** → header shows **Sign in**.
4. `/login` with the confirmed credentials → signed in.
5. Attempt signup with the same username (different email) → "That username is taken."
6. Attempt `/login` before confirming a fresh account → Supabase "Email not confirmed" error surfaces.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "CV: document Supabase auth setup and env vars"
```

---

## Self-Review Notes

- **Spec coverage:** Data model (T2), out-of-band trigger/index/RLS (T2), Supabase config (T9), login/signup/confirm/signout routes (T6/T7), username availability + reserved list (T3/T5), session/middleware/helpers (T1/T4), header control (T8), tests (T3–T8), rollout order (T1→T9). All spec sections mapped.
- **Type consistency:** `signUp` input/return, `getProfile(): Promise<Profile | null>`, `AccountMenu({ username })`, `isUsernameTaken(username)`, `usernameSchema`/`normalizeUsername`/`isValidUsername` used consistently across tasks.
- **Known verification points during execution:** (a) exact token names in `styles/globals.scss`; (b) that `prisma migrate deploy` accepts the hand-written migration on the pooler/DIRECT_URL; (c) Prisma `Profile` type import path `@generated/prisma/client`.
