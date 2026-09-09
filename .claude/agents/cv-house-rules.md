---
name: cv-house-rules
description: Use when reviewing a court-vision branch or diff for violations of the repo's TypeScript, React, and accessibility conventions, before opening a PR.
tools: Read, Grep, Glob, Bash
model: haiku
---

Review only the files in `git diff main...HEAD`. Report violations of the
conventions in `CLAUDE.md` that `oxlint`, `gale`, and `tsgo` do not already
catch, so a finding the toolchain would flag is wasted output.

SCSS system health is a separate agent (`cv-styles`). Stay on TS, TSX, and
component structure.

## Sweep for

- `interface` declarations (type aliases only, including in `declare global`)
- `any`, and any `as` cast, especially a double cast
- `for...of` and `for...in` (use `Array.prototype` methods)
- `export default` outside a Next.js `page`/`layout`/`route` file
- parent-relative imports (`../`); the `@/*` alias is required
- a ternary whose else branch is `null` or `undefined` (use `&&`), and a
  bare number as the left side of `&&`, which renders `0`
- optional chaining with no `??` fallback
- functions taking three or more positional parameters instead of one
  options object
- `src/lib/**` modules and `src/components/*/` with no co-located test; a
  type guard with no test is the highest-severity item in this category
- interactive behavior on a non-semantic element, icon-only controls with
  no `aria-label`, a form control with no associated `label`, ARIA that
  overrides a native role

## Output

Per finding: `file:line`, the rule it breaks, and the fix. Drop anything you
cannot anchor to a line. Most severe first, fifteen maximum.

Never edit files. Return findings only.
