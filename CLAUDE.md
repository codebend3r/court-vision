# CLAUDE.md

Court Vision is a fantasy-basketball stats app: Next.js App Router, React 19, Prisma on Supabase Postgres, Supabase auth. The repo is an Nx + Bun-workspaces monorepo. Its sport-agnostic logic is being extracted into shared `@vision/*` libs, so that sibling apps (rink-vision, diamond-vision, field-vision) can reuse it.

## Workflow

- Never commit, push, merge, create a branch, or open a PR until I tell you to.

## Structure

- `apps/court-vision/` is the Next app. It holds the UI, server actions, the Prisma schema and generated client, Supabase auth, and the Balldontlie sync CLIs. It stays one full-stack app with no separate backend.
- `libs/vision-core/` (`@vision/core`) holds sport-agnostic logic. It is framework-free: no React, Next, Prisma, Supabase, nuqs or zustand, and no other `@vision/*` lib. Import a module by path (`@vision/core/util/logger`); there are no barrel files.
- `libs/vision-testing/` (`@vision/testing`) holds the bun:test preload, env stubs and jest-dom matcher types.
- Libs ship TypeScript source: `exports` in their `package.json` point at `./src/**.ts`, and apps compile them through `transpilePackages`. Libs have no build step.
- This Next.js version differs from older ones. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code.
- Nx (core only, no plugins) runs each project's `package.json` scripts.
  - At the root, `bun run build`, `bun run test` and `bun run typecheck` fan out with `nx run-many`.
  - For one project, use `bunx nx run <project>:<target>` or `bun run --cwd <dir> <script>`.
- Paths below are relative to the project that owns them. Example: `styles/globals.scss` means `apps/court-vision/src/styles/globals.scss`.

## Imports

- Never use relative paths, not even for same-directory siblings or co-located style sheets. oxlint enforces this.
  - **In an app:** `@/*` maps to that app's `src/`. `@generated/*` and `@public/*` map to its `generated/` and `public/` dirs.
  - **In a lib:** use the lib's own `#<name>/*` subpath alias, declared in `package.json` `imports`. `@/` is banned in libs.
  - **Across packages:** use a `@vision/<name>/<entry>` export.
- SCSS `@use` follows the same rule: `@use "@/styles/mixins" as *`.

## Tooling

- All scripts run through Bun (`bun install`, `bun run …`). Never invoke npm or yarn.
- Pin every dependency to an exact version, with no `^` or `~`. The root `bunfig.toml` enforces this with `exact = true`. Workspace siblings are the one exception: they use `workspace:*`.
- Run tests with `bun run test`, never bare `bun test`. The unit-tester skill explains why.
- Tests are co-located: `lib/foo.ts` ↔ `lib/foo.test.ts`, `components/Foo/Foo.tsx` ↔ `components/Foo/Foo.test.tsx`.

## React

- Never use default exports if it can be avoided; prefer named exports.
- Always import React methods, constants and types from `react`, e.g. `import { useState } from 'react'`.
- Prefer the latest React features when possible.
- Prefer the `use` hook pattern for state management.
- Always use zustand for global state.

## TypeScript

- Always use type aliases. Never use interfaces, including in `declare global` augmentations.
- Use type guards wherever possible, and unit test every type guard function.
- Never use `any`. Prefer type narrowing or type guards.
- Never cast types, and never double cast (`as any as string`).
- If a type can't be inferred and narrowing isn't an option, use `unknown`.

## SCSS/CSS

- Use SCSS modules (`*.module.scss`) for component styles.
- Use the global stylesheet (`styles/globals.scss`) only for design tokens and true typographic primitives.
- Layout is container-driven. The container sets width and height and positions its children, so a child moved to a different container can lay out differently there.
- Prefer CSS grid with `gap` for spacing. Avoid margins for spacing. Flex is the second choice.
- Avoid plain divs, meaning divs with no class or id.
- Always use the token values from `styles/globals.scss` for font sizes, colors, padding, margin, gap and border radius.

## Code style

- Prefer immutable data structures and operations.
- Prefer `reduce` over `for` loops. Never use `for/in` or `for/of`; use `Array.prototype` methods (`map`, `filter`, `reduce`, `flatMap`).
- Prefer double-bang (`!!value`) for boolean conversion.
- Prefer short-circuit `&&` over a ternary whose else branch is `null` or `undefined`, especially in JSX.
  - Do: `{isActive && <Badge />}`. Don't: `{isActive ? <Badge /> : null}`.
  - Make the condition a real boolean (`!!count && …`) so a bare `0` never renders.
- Prefer optional chaining (`?.`), and always pair it with nullish coalescing (`??`) to supply a fallback.
- Prefer a single object parameter over positional ones, so argument order doesn't matter. Do: `doSomething({ foo, bar })`. Don't: `doSomething(foo, bar)`.

## Accessibility (WCAG AA)

- Use semantic HTML before ARIA: a native `button`, never a clickable `div`. Add ARIA only to fill a gap, and never override a native role.
- Everything must be operable by keyboard, with a visible `:focus-visible` style. Modals, drawers and menus move focus in, trap it, restore it to the trigger on close, and close on `Escape`.
- Every control needs an accessible name:
  - form fields get a `label`, with `aria-describedby` for hints and errors;
  - icon-only buttons get an `aria-label`;
  - decorative icons get `aria-hidden="true"`, and decorative images `alt=""`.
- Announce async changes (toasts, status, form errors) with `aria-live` or `role="alert"`.
- Text needs at least 4.5:1 contrast, and large text and UI elements 3:1, measured against the `globals.scss` tokens. Never signal meaning by color alone.
- Respect `prefers-reduced-motion` and size with `rem`. Each page has one `h1` with no skipped heading levels, and the document sets `lang`.

## Data sources

- Live NBA stats come from the [Balldontlie API](https://docs.balldontlie.io/). Consult its endpoint reference whenever you touch the adapter in `apps/court-vision/src/lib/balldontlie/`. Auth is `BALLDONTLIE_API_KEY` in `apps/court-vision/.env`, and endpoint availability depends on the plan tier.
- Design specs and implementation plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`. Check them before extending an existing feature.

## Redesign conventions

These come from the 2026-08 redesign; the spec is `docs/superpowers/specs/redesign-2026-08.md`.

- Every pressable control uses the keycap mixins (`keycap`, `keycap-engaged`, `keycap-danger`, `keycap-press` in `styles/mixins.scss`). Never invent a new button treatment.
- The retro extrusion (`retro-extrude`) is opt-in by role: page titles (`h1`), the wordmark, and large readout numbers. Never apply it to headings wholesale, and never add glows.
- Tables share one pattern: `table-wrapper` + `data-table` + `numeric-cell`. Cell padding is `var(--row-y) var(--row-x)`, never hardcoded.
- Dashboard panels use `panel-shell` + `panel-title`.
- There are six themes, set on `data-theme` and registered in `lib/theme/themes.ts`.
  - A theme may only redefine color tokens. Spacing, radii, type and shadow geometry are shared constants.
  - Team identity colors (`TeamChip`) never borrow theme tokens.
- Every screen opens with `PageHeader` (eyebrow, title, description, actions, rule). Page actions use `PageAction`.
