# Typography System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chakra Petch (display) + IBM Plex Sans (body) via next/font, with a senior-level scale: tracking tokens, micro-label recipe, tabular numerals, uppercase HUD wordmark.

**Architecture:** next/font/google loads both faces in the root layout and exposes CSS variables; globals.scss maps them into semantic tokens (`--font-sans`, `--font-display`) plus new size/tracking tokens and heading primitives; component modules apply one shared micro-label recipe.

**Tech Stack:** next/font/google, SCSS tokens.

**Spec:** `docs/superpowers/specs/2026-07-10-typography-design.md` (authoritative for names/values).

## Global Constraints

- Current branch; no `any`/`as` casts; SCSS tokens only; no classless divs; Bun; `CV:` commits; pre-commit gate.
- Font config verbatim: `Chakra_Petch` weights `["400","500","700"]`, `variable: "--font-display-next"`; `IBM_Plex_Sans` weights `["400","500","600"]`, `variable: "--font-body-next"`; both `subsets: ["latin"]`, `display: "swap"`; variable classNames applied to `<html>`.
- Token mappings verbatim (globals.scss): `--font-sans: var(--font-body-next), ui-sans-serif, system-ui, sans-serif;` `--font-display: var(--font-display-next), var(--font-sans);` `--font-size-xs: 0.75rem;` `--tracking-tight: -0.01em;` `--tracking-wide: 0.12em;`

---

### Task 1: Fonts, tokens, primitives

**Files:**

- Modify: `src/app/layout.tsx`, `src/styles/globals.scss`
- Test: none new (CSS-level); full suite + build must stay green.

**Steps:**

- [ ] In `layout.tsx`:

```tsx
import { Chakra_Petch, IBM_Plex_Sans } from "next/font/google";

const displayFont = Chakra_Petch({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-next",
});

const bodyFont = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body-next",
});
```

and `<html lang="en" suppressHydrationWarning className={`${displayFont.variable} ${bodyFont.variable}`}>`.

- [ ] In `globals.scss`: replace the `--font-sans` value with the mapping above; add `--font-display`, `--font-size-xs`, `--tracking-tight`, `--tracking-wide` tokens; add heading primitives after the `a` block:

```scss
h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: var(--tracking-tight);
}
```

- [ ] `bun run test` + `bun run build` green (fonts download at build — if the sandbox blocks fonts.googleapis.com during build, report it rather than switching to CDN links).
- [ ] Commit — `CV: load Chakra Petch + IBM Plex Sans and type tokens`

---

### Task 2: Treatments across components

**Files:**

- Modify: `SiteHeader.module.scss` (wordmark: `font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.08em;`), `SideNav.module.scss` (links get the micro-label recipe), `src/app/players/page.module.scss` (`th` micro-label recipe; `tbody` gets `font-variant-numeric: tabular-nums`), `src/app/players/[playerId]/page.module.scss` (meta line micro-label recipe), `src/components/PlayerStatChart/PlayerStatChart.module.scss` (panel `h3` micro-label recipe; tooltip values `tabular-nums`), `src/app/design/page.module.scss` (section labels recipe; add a "Typefaces" row listing the two family names — coordinate with the shipped /design page structure, adding a small static section to `src/app/design/page.tsx` naming "Chakra Petch — display" and "IBM Plex Sans — body" in their own faces).
- Micro-label recipe (repeat in each module; SCSS modules can't share without a mixin file — add `src/styles/mixins.scss` with `@mixin micro-label { text-transform: uppercase; font-size: var(--font-size-xs); letter-spacing: var(--tracking-wide); color: var(--color-text-muted); }` and `@use "@/styles/mixins" as *;` in each consuming module):

**Steps:**

- [ ] Add `mixins.scss`; apply per file list above. Verify `@use` path resolves (Next SCSS supports the alias via `sassOptions`? If the `@/` alias fails in SCSS, use relative paths `../../styles/mixins` — check `next.config.ts` first).
- [ ] Update `/design` page + its test for the new "Typefaces" section heading.
- [ ] `bun run system-check` + `bun run build`; screenshot header/players/design pages for eyeball pass (controller does this at verification).
- [ ] Commit — `CV: apply display/micro-label/numeral treatments across components`

## Self-review notes

Spec §2→Task 1 (fonts/tokens); §3→Tasks 1 (primitives, tokens) + 2 (recipe, numerals, wordmark); §4 file list covered; §5 sequencing honored (runs after theme Task 3). Names consistent with spec.
