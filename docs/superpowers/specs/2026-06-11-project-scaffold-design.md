# Court Vision — Project Scaffold Design

**Author:** CJ (with Claude)
**Date:** 2026-06-11
**Status:** Implemented (commit `733f310` on branch `scaffold`)
**Branch:** `scaffold`

---

## 1. Overview

Stand up the Court Vision repository as a Next.js (App Router) + TypeScript project with the full engineering toolchain mandated by the PRD (§9–§10): Prisma, Vitest, ESLint, Prettier, Husky-managed git hooks, and CI. This is the foundation every feature branch builds on. **No product features** (leaderboard, charts, heat score, NBA sync) are in scope here — only the framework, data-layer wiring, quality gates, and a minimal "it runs and tests pass" baseline.

## 2. Decisions (locked during brainstorming)

| Topic           | Decision                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build tool      | Next.js native bundler (Turbopack). "Vite" only appears as Vitest's underlying config — no separate Vite build.                                                  |
| Styling         | **SCSS modules** (`*.module.scss`) + a single `src/styles/globals.scss` for design tokens & typographic primitives. **No Tailwind** (per CLAUDE.md CSS section). |
| Source layout   | `src/` holds `app`, `components`, `lib`, `styles`. `prisma/`, `public/`, configs, `.github/`, `.husky/` stay at root. Alias `@/*` → `src/*`.                     |
| Database        | **Config only, no DB.** Prisma schema + client singleton + `.env.example` placeholder. No docker-compose, no migration run.                                      |
| Testing         | **Unit + component.** Vitest + React Testing Library + jsdom, with one sample lib unit test and one sample component test.                                       |
| CI              | **GitHub Actions now**, running all four gates on PRs, mirroring local hooks.                                                                                    |
| Package manager | Bun (1.3.x). All deps **exact-pinned** (no `^`/`~`) per CLAUDE.md.                                                                                               |

## 3. Non-Goals

shadcn/ui, TanStack Table, Recharts/visx, NBA data-source integration, sync jobs, heat-score logic, and any feature/page code. Those land in later feature branches.

## 4. Approach

Bootstrap with create-next-app non-interactively to inherit Next's canonical config, then layer on the rest and re-pin versions:

```
bunx create-next-app@latest /tmp/cv-scaffold \
  --typescript --eslint --app --src-dir --no-tailwind \
  --import-alias "@/*" --use-bun --empty --yes
```

This resolved to **Next.js 16** + React 19. Then: add `sass` + SCSS, add Prisma 7, add Vitest + RTL, add Husky + lint-staged, add CI, and rewrite `package.json` dependency versions to exact pins. Rationale: we get Next's blessed `tsconfig`/eslint flat-config baseline without hand-rolling it, while keeping control over the conventions create-next-app doesn't enforce.

**Gotcha — non-empty directory:** create-next-app aborts when the target dir contains files outside its small allowlist (it tolerates `.git`/`.gitignore` but not `PRD/`, `CLAUDE.md`, `docs/`, `.nvmrc`). So we ran create-next-app in a temp dir and `rsync`-merged its output into the repo, excluding `.git`, `node_modules`, `.gitignore`, and the generated `CLAUDE.md`/`AGENTS.md`/`README.md`.

## 5. Directory layout

```
.
├── prisma/
│   └── schema.prisma           # postgres datasource (no url) + prisma-client generator
├── prisma.config.ts            # Prisma 7 CLI config: schema path, migrations, datasource url
├── generated/prisma/           # generated Prisma client (gitignored, alias @generated/*)
├── public/                     # static assets (root-mandated by Next)
├── src/
│   ├── app/
│   │   ├── layout.tsx          # imports @/styles/globals.scss
│   │   └── page.tsx            # renders <Hello/>
│   ├── components/
│   │   └── Hello/
│   │       ├── Hello.tsx
│   │       ├── Hello.module.scss
│   │       └── Hello.test.tsx  # sample component test (RTL)
│   ├── lib/
│   │   ├── prisma.ts           # typed client singleton (pg driver adapter)
│   │   ├── math.ts             # sample util (sum via reduce)
│   │   └── math.test.ts        # sample unit test
│   └── styles/
│       └── globals.scss        # design tokens + typographic primitives
├── .github/workflows/ci.yml
├── .husky/{pre-commit,pre-push}
├── eslint.config.mjs
├── vitest.config.ts
├── vitest.setup.ts             # imports @testing-library/jest-dom/vitest
├── next.config.ts
├── tsconfig.json               # strict; paths @/* and @generated/*
├── .prettierrc / .prettierignore
├── .env.example
├── package.json
└── bun.lock
```

`vitest.setup.ts` lives at root (not in `src/`) to keep `src/` to exactly the four agreed folders. The generated Prisma client lives in a gitignored root-level `generated/` for the same reason (it is build output, not authored source).

## 6. Dependencies (all exact-pinned)

**Runtime:** `next`, `react`, `react-dom`, `@prisma/client`, `@prisma/adapter-pg`

**Dev:** `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `sass`, `prisma`, `dotenv`, `eslint`, `eslint-config-next`, `eslint-config-prettier`, `prettier`, `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `husky`, `lint-staged`

## 7. Configuration

### TypeScript (`tsconfig.json`)

create-next-app baseline: `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`. Paths extended with `"@/*": ["./src/*"]` and `"@generated/*": ["./generated/*"]`.

### ESLint (`eslint.config.mjs`)

Next 16 flat config (no `FlatCompat`): `defineConfig` from `eslint/config`, spreading `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, then `eslint-config-prettier` to disable formatting-conflicting rules, then `globalIgnores([..., "generated/**"])`. ESLint and Prettier run **separately** — Prettier is the sole formatter. The `lint` script uses `--max-warnings 0` so warnings are a hard gate.

### Prettier (`.prettierrc`, `.prettierignore`)

Project-wide formatting authority (semis, double quotes, trailing commas, printWidth 100). Ignores build output, `bun.lock`, `next-env.d.ts`, `generated/`, `prisma/migrations/`.

### Vitest (`vitest.config.ts`)

`@vitejs/plugin-react`; `resolve.tsconfigPaths: true` (Vite 4 resolves tsconfig paths natively — no `vite-tsconfig-paths` plugin needed). `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]`. `vitest.setup.ts` imports `@testing-library/jest-dom/vitest` (registers matchers + types on Vitest's `expect`). Tests import `describe/it/expect` explicitly from `vitest`.

### Prisma 7 (`prisma/schema.prisma`, `prisma.config.ts`, `src/lib/prisma.ts`)

Prisma 7 removed the Rust query engine and the in-schema `url`. The new `prisma-client` generator emits TypeScript to an explicit `output`, the connection URL moves to `prisma.config.ts`, and `PrismaClient` requires a driver adapter.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" }, // empty-string fallback so `generate` works with no DB
});
```

`src/lib/prisma.ts` is a singleton that **does not cast types** (CLAUDE.md forbids `as`/`as unknown as`). It uses global declaration-merging and the Postgres driver adapter:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });

export const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
```

`@prisma/adapter-pg` bundles `pg`, so no separate `pg` dependency is needed.

### Environment

`.env.example` (committed) holds a placeholder `DATABASE_URL`. **Gotcha:** `.gitignore` ignores `.env*`, which would also ignore `.env.example` — a `!.env.example` negation tracks the template.

## 8. package.json scripts

```
dev          next dev
build        next build
start        next start
lint         eslint . --max-warnings 0
format       prettier --write .
format:check prettier --check .
typecheck    tsc --noEmit
test         vitest run
test:watch   vitest
db:generate  prisma generate
db:migrate   prisma migrate dev
prepare      husky                 # installs git hooks on bun install
postinstall  prisma generate       # ensures the generated client exists after install (local + CI)
```

## 9. Git hooks (Husky v9 + lint-staged)

**`.husky/pre-commit`**

```
bunx lint-staged
bun run typecheck
bun run test
```

**`.husky/pre-push`**

```
bun run format:check
bun run lint
bun run typecheck
bun run test
```

**lint-staged** (`.lintstagedrc.json`)

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{js,jsx,mjs,cjs,json,scss,css,md}": ["prettier --write"]
}
```

Per PRD §10, pre-commit runs the full Vitest suite (not just staged). lint-staged scopes only the format/lint pass for speed.

## 10. CI (`.github/workflows/ci.yml`)

On `pull_request` and pushes to `main`: checkout → `oven-sh/setup-bun` → `bun install --frozen-lockfile` → `bunx prisma generate` → `format:check` → `lint` → `typecheck` → `test`. Same four gates as the local hooks. `prisma generate` runs explicitly so the generated client exists before typecheck (belt-and-suspenders alongside `postinstall`).

## 11. Sample code (toolchain proof)

- `src/lib/math.ts`: `sum` implemented with `reduce` + co-located `math.test.ts`.
- `src/components/Hello/Hello.tsx`: component using an SCSS module + co-located `Hello.test.tsx` (RTL).
- `src/styles/globals.scss`: starter design tokens (color, spacing, radius, font-size custom properties) and base typography.

These exist only to prove the unit + component test paths and the SCSS pipeline; they can be deleted/replaced when real features land.

## 12. Acceptance criteria — verified

1. `bun install` succeeds; git hooks install; the Prisma client generates. ✅
2. `bun run dev` serves the placeholder page (HTTP 200, renders `<Hello/>` with a scoped SCSS-module class). ✅
3. `bun run build` succeeds (Next 16 / Turbopack, static prerender of `/`). ✅
4. `bun run lint` (0 warnings), `bun run typecheck`, `bun run format:check`, `bun run test` (3/3) all pass. ✅
5. The pre-commit hook ran its gates on the scaffold commit and passed. ✅
6. No dependency in `package.json` carries a `^` or `~`. ✅
7. No `any`, no type casts in authored code. ✅

## 13. As-built deltas from the original draft

The draft assumed older framework versions; the live versions differed:

- **Next.js 16** (not 15): ESLint uses the new `eslint/config` flat format, not `FlatCompat`/`@eslint/eslintrc`. create-next-app `--empty` generates no `globals.css`.
- **Prisma 7** (not 5/6): no Rust engine; `prisma-client` generator with explicit `output`; URL in `prisma.config.ts` (not schema); `PrismaClient` requires a driver adapter (`@prisma/adapter-pg`). Added `dotenv`. `env()` from `prisma/config` throws eagerly when the var is missing, so we use `process.env.DATABASE_URL ?? ""` to keep `generate`/`install` working in a no-DB scaffold.
- **Vitest 4 / Vite**: tsconfig paths resolve natively (`resolve.tsconfigPaths`), so `vite-tsconfig-paths` was dropped.

## 14. Follow-ups / notes

- CLAUDE.md references a `cv-commit-format` skill that is **not installed**; commits follow the inline Commits convention (`CV:` subject + bullet body) until/unless that skill is added.
- A `README.md` (CLAUDE.md says it "covers stack, layout, and routes") does not yet exist — out of scope for this scaffold, a natural next chore.
- Live DB, docker-compose, and the first real Prisma migration are deferred until data-model work begins.
