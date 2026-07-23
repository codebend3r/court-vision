# CLAUDE.md

Operating rules for this repo. The README is a lean getting-started guide; this file is conventions only.

## Structure

- Source lives under `src/` (`src/app`, `src/components`, `src/lib`, `src/styles`); `prisma/`, `public/`, config files, `.github/`, and `.husky/` stay at the repo root. Path references below (e.g. `styles/globals.scss`, `lib/foo.ts`) are under `src/`, and the `@/*` import alias maps to `src/*` (`@public/*` and `@generated/*` map to the root `public/` and `generated/` dirs).
- Import via aliases, never parent-relative paths (`../`); lint enforces this. Same-directory `./` imports (co-located styles, tests) are fine.

## Workflow

- Never create a new branch unless explicitly asked to. Work on the current branch by default.
- Auto-commit each logical change without asking. Subject must start with `CV:` (see the `cv-commit-format` skill).
- PR titles must also start with `CV:` followed by a short title, exactly like commit subjects. CI (`.github/workflows/pr-title.yml`) fails any PR without it; get it right at `gh pr create` time.

## Tooling

- All scripts run through Bun: `bun install`, `bun dev`, `bun run test`, `bun run build`, `bun run lint`. Never invoke npm or yarn.
- Pin every `package.json` dependency to an exact version, with no `^` or `~`.

## React

- Never use default exports if it can be avoided, prefer named exports
- Always import all React methods, constants, and types from `react`, e.g. `import { useState } from 'react'`
- Prefer using latest features in React when possible
- Prefer using the `use` hook pattern for state management
- Prefer using zustand always for global state management

## Typescript

- Always use type aliases. Never use TypeScript interfaces anywhere, including `declare global` augmentations
- Use type guards wherever possible.
- Never use `any` types; prefer type narrowing or type guards
- Never under any circumstance cast types and never double cast: `as any as string`
- If type can't be inferred and type narrowing is not an option, use `unknown` types

## CSS

- Use SCSS modules (`*.module.scss`) for component styles
- Only use global stylesheets (`styles/globals.scss`) for design tokens and true typographic primitives
- Use a container driven approach, meaning the container will define the width and height and the children will be positioned within it, this means if/when the children are moved to different containers they may be laid out differently depending on what the container specifies
- Prefer using CSS display grid for layout with the gap property for spacing between grid items; avoid using margins for spacing
- Second preferred display value is flex
- Avoid using plain divs; meaing divs with no class or id defined
- Always use token values from `styles/globals.scss` when defining font sizes, colors, and other design tokens like padding, margin, gap, and border radius

## Code style

- Always prefer immutable data structures and operations
- Prefer `reduce` over `for` loops when possible. Never use `for/in` or `for/of` loops; reach for `Array.prototype` methods (`map`, `filter`, `reduce`, `flatMap`, etc.) when the value is an array.
- Prefer double-bang (`!!value`) for boolean conversion.
- Prefer short-circuit (`&&`) over a ternary when the else branch is `null` or `undefined`, especially in React rendering. Do: `{isActive && <Badge />}`. Don't: `{isActive ? <Badge /> : null}`. Guard the condition so it is a real boolean (`!!count && ...`), never a bare number that could render `0`.
- Prefer optional chaining (`?.`). When optional chaining is used, ALWAYS pair it with nullish coalescing (`??`) to supply a fallback.
- Prefer a single configurable object parameter over multiple positional parameters so argument order doesn't matter. Don't: `doSomething(foo, bar, hello)`. Do: `doSomething({ foo, bar, hello })`.

## Accessibility

- Use best practices for accessibility
- Use semantic HTML elements (`button`, `nav`, `main`, `header`, `ul`/`li`, `label`) before reaching for a generic element with a role; a native `button` beats a `div` with `onClick`
- Every interactive element must be reachable and operable by keyboard alone; preserve a logical tab order and never remove focus outlines without providing an equally visible `:focus-visible` style
- Associate every form control with a `label` (via `htmlFor`/`id` or wrapping); use `aria-describedby` for hints and error text
- Provide accessible names for icon-only controls with `aria-label`; mark purely decorative icons/images `aria-hidden="true"` and give meaningful images real `alt` text (empty `alt=""` when decorative)
- Add ARIA only to fill gaps native semantics can't; never override a native role, and prefer no ARIA over wrong ARIA
- Announce dynamic changes (toasts, async status, form errors) with an appropriate `aria-live` region or `role="alert"`
- Manage focus for modals, drawers, and menus: move focus in on open, trap it while open, restore it to the trigger on close, and close on `Escape`
- Meet WCAG AA contrast (4.5:1 body text, 3:1 large text and UI/graphical elements); verify against `styles/globals.scss` color tokens
- Respect `prefers-reduced-motion` and gate non-essential animation/transitions behind it
- Never convey meaning by color alone; pair it with text, an icon, or another cue
- Use relative units (`rem`) so the UI scales with user font-size settings, and keep layouts usable at 200% zoom
- Set a correct `lang` on the document and keep a single, ordered heading hierarchy (one `h1`, no skipped levels)

## Content + tests

- Tests are co-located: `lib/foo.ts` ↔ `lib/foo.test.ts`, `components/Foo/Foo.tsx` ↔ `components/Foo/Foo.test.tsx`.

## Data sources

- Live NBA stats come from the [Balldontlie API](https://docs.balldontlie.io/) — always consult that endpoint reference (e.g. [Get All Players](https://docs.balldontlie.io/#get-all-players)) when touching the adapter in `lib/balldontlie/`. Auth via `BALLDONTLIE_API_KEY` in `.env`; endpoint availability is tier-gated.

## Specs

Design specs and implementation plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`. Check them before extending an existing feature.

## Commits

- Create a commit after every logical change, batch if they are related.
- Subject must start with `CV:` followed by a short title (e.g., `CV: a short title`).
- Favor bullet points in the body. Keep it concise and easy to read.
