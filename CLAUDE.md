# CLAUDE.md

Operating rules for this repo. The README covers stack, layout, and routes; this file is conventions only.

## Structure

- Source lives under `src/` (`src/app`, `src/components`, `src/lib`, `src/styles`); `prisma/`, `public/`, config files, `.github/`, and `.husky/` stay at the repo root. Path references below (e.g. `styles/globals.scss`, `lib/foo.ts`) are under `src/`, and the `@/*` import alias maps to `src/*` (`@public/*` and `@generated/*` map to the root `public/` and `generated/` dirs).
- Import via aliases, never parent-relative paths (`../`); lint enforces this. Same-directory `./` imports (co-located styles, tests) are fine.

## Workflow

- Never create a new branch unless explicitly asked to. Work on the current branch by default.
- Auto-commit each logical change without asking. Subject must start with `CV:` (see the `cv-commit-format` skill).

## Tooling

- All scripts run through Bun: `bun install`, `bun dev`, `bun run test`, `bun run build`, `bun run lint`. Never invoke npm or yarn.
- Pin every `package.json` dependency to an exact version, with no `^` or `~`.

## Typescript

- Always use type aliases. Never use TypeScript interfaces anywhere, including `declare global` augmentations; lint enforces this (`@typescript-eslint/consistent-type-definitions`).
- Use type guards wherever possible.
- Never use `any` types; prefer type narrowing or type guards
- Never under any circumstance cast types and never double cast: `as any as string`
- If type can't be inferred and type narrowing is not an option, use `unknown` types

## CSS

- Use SCSS modules (`*.module.scss`) for component styles
- Only use global stylesheets (`styles/globals.scss`) for design tokens and true typographic primitives
- Use a container driven approach, meaning the container will define the width and height and the children will be positioned within it, this means if/when the children are moved to different containers they may be laid out differently depending on what the container specificies
- Prefer using CSS display grid for layout with the gap property for spacing between grid items; avoid using margins for spacing
- Second preferred display value is flex
- Avoid using plain divs; meaing divs with no class or id defined
- Always use token values from `styles/globals.scss` when defining font sizes, colors, and other design tokens like padding, margin, gap, and border radius

## Code style

- Prefer `reduce` over `for` loops when possible. Never use `for/in` or `for/of` loops; reach for `Array.prototype` methods (`map`, `filter`, `reduce`, `flatMap`, etc.) when the value is an array.
- Prefer double-bang (`!!value`) for boolean conversion.
- Prefer short-circuit (`&&`) over a ternary when the else branch is `null` or `undefined`, especially in React rendering. Do: `{isActive && <Badge />}`. Don't: `{isActive ? <Badge /> : null}`. Guard the condition so it is a real boolean (`!!count && ...`), never a bare number that could render `0`.
- Prefer optional chaining (`?.`). When optional chaining is used, ALWAYS pair it with nullish coalescing (`??`) to supply a fallback.
- Prefer a single configurable object parameter over multiple positional parameters so argument order doesn't matter. Don't: `doSomething(foo, bar, hello)`. Do: `doSomething({ foo, bar, hello })`.

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
