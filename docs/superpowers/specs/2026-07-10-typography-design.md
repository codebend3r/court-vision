# Typography system — design

Date: 2026-07-10
Status: Approved (pairing chosen by user from live mockups: option B)
Depends on: theme spec (`2026-07-10-theme-design-route-design.md`)

## 1. Goal

A professional, futuristic type system: **Chakra Petch** (display) +
**IBM Plex Sans** (body/UI), self-hosted via `next/font/google`, applied with
senior-level restraint — a refined scale, tracking rules, and numeric
alignment — across every page.

## 2. Fonts

- `next/font/google` in `src/app/layout.tsx`:
  - `Chakra_Petch` weights 400/500/700, `variable: "--font-display-next"`.
  - `IBM_Plex_Sans` weights 400/500/600, `variable: "--font-body-next"`.
  - Both `subsets: ["latin"]`, `display: "swap"`; variables className on
    `<html>`.
- `globals.scss` semantic tokens (components keep using tokens, never raw
  family names):
  - `--font-sans: var(--font-body-next), ui-sans-serif, system-ui, sans-serif;`
    (body/UI — replaces the old system stack).
  - `--font-display: var(--font-display-next), var(--font-sans);` (headings,
    wordmark, big numerals).

## 3. Scale and treatments

- New token `--font-size-xs: 0.75rem` (micro-labels). Existing sm/md/lg/xl
  unchanged.
- New tracking tokens: `--tracking-tight: -0.01em` (display headings),
  `--tracking-wide: 0.12em` (uppercase micro-labels).
- Global primitives (`globals.scss`): `h1, h2, h3 { font-family:
var(--font-display); font-weight: 700; line-height: 1.15; letter-spacing:
var(--tracking-tight); }`.
- **Micro-label treatment** (component SCSS, one shared recipe): uppercase +
  `--font-size-xs` + `--tracking-wide` + muted color. Applied to: table
  headers (`/players`), chart panel headings ("Counting stats", "Shooting
  percentages"), the player-page meta line, SideNav links, and `/design`
  section labels.
- **Numerals**: `font-variant-numeric: tabular-nums` on the players table
  body and the chart tooltip values; big stat numerals (future stat tiles)
  use `--font-display`.
- **Wordmark**: Chakra Petch 700, uppercase, `letter-spacing: 0.08em` —
  "COURT VISION" as a HUD-style mark.

## 4. Files

`src/app/layout.tsx`, `src/styles/globals.scss`, plus treatment touch-ups in
`SiteHeader.module.scss`, `SideNav.module.scss`, `src/app/players/page.module.scss`,
`src/app/players/[playerId]/page.module.scss`,
`PlayerStatChart.module.scss` (+ its axis `fontSize` stays 12px). `/design`'s
typography section picks the fonts up automatically; add a row naming the two
families.

## 5. Sequencing + testing

- Lands AFTER theme Tasks 2-3 (they touch adjacent files; avoid concurrent
  edits).
- Tests: minimal — existing suites must stay green (type changes are CSS);
  one wordmark test update if the text becomes uppercase via CSS (it should:
  `text-transform`, so the accessible name is unchanged → no test changes).
  Visual verification via screenshots both themes.

## 6. Out of scope

- A mono font for code, variable-font animation, per-page type overrides.
