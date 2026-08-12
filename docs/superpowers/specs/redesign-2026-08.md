# Handoff: Court Vision redesign

## Overview

A full visual redesign of Court Vision (`codebend3r/court-vision`) — a fantasy-basketball stats app for serious league managers. The redesign covers all 12 screens, introduces a six-theme system, a user-configurable text size, a new logo and icon family, and replaces the current ambient retro styling with a deliberate one.

The goal it was designed against: **page-to-page consistency, clear hierarchy, legibility at small sizes, and making the retro treatment feel intentional** — while staying consistent across every theme.

## About the design files

The files in this bundle are **design references created in HTML**. They are prototypes showing intended look and behaviour, not production code to copy directly.

The task is to **recreate these designs in the existing Next.js codebase** using its established patterns — the App Router, SCSS modules co-located with components, and the token layer in `src/styles/globals.scss`. Do not port the HTML or its inline styles; translate the specifications below into SCSS modules and React components that match how the repo already works.

The prototypes were built with the published `court-vision` component library loaded as a browser bundle, so a few components (`AdvancedStatsLegend`, `FantasyValueLegend`) render as the real upstream components. In the app those already exist — keep using them.

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, and interaction states are final and exact. Recreate the UI pixel-perfectly using the codebase's existing SCSS module patterns. Every value in this document is literal.

---

## 1. The core change: retro becomes deliberate

This is the single most important part of the redesign; everything else follows from it.

**Today:** `src/styles/globals.scss` applies a 10-step `text-shadow` extrusion to every `h1, h2, h3, h4, h5`. On a 32px page title it reads as intentional; on a 12px panel heading it smears the glyphs and hurts legibility. Because it fires on tag name rather than on purpose, the retro styling reads as accidental.

**Redesign:** the global heading rule is removed. The extrusion is reserved for exactly two roles:

1. Page titles (`h1`) and the wordmark
2. Large readout numbers (the stat figures on dashboard/detail cards)

Everything else that carried a shadow now carries none.

In its place, retro **depth** moves onto things the user can press. Every interactive control shares one mechanic — described in §4 — so the style is expressed through behaviour rather than decoration.

Implementation: delete the blanket `h1–h5` extrusion from `globals.scss` and replace it with an opt-in class or mixin (`.u-extrude` / `@include retro-extrude`), applied only at the two roles above.

---

## 2. Theme architecture

Six themes. **A theme may only redefine colour tokens.** Spacing, radii, type scale, shadow geometry, borders, and layout are hard constants shared by all themes — that is what keeps the look and feel consistent no matter which theme is active.

Set via `data-cv-theme` on the root element (the repo already uses `data-theme`; keep that attribute name and extend its value set).

### Shared constants (never themed)

```scss
--retro-1: 1px 1px 0 var(--color-retro-shadow);
--retro-2: 1px 1px 0 var(--color-retro-shadow), 2px 2px 0 var(--color-retro-shadow);
--retro-4:
  1px 1px 0 var(--color-retro-shadow), 2px 2px 0 var(--color-retro-shadow),
  3px 3px 0 var(--color-retro-shadow), 4px 4px 0 var(--color-retro-shadow);

// Text extrusion (em-based so it tracks font size)
--extrude:
  0.03em 0.03em var(--color-retro-shadow), 0.06em 0.06em var(--color-retro-shadow),
  0.09em 0.09em var(--color-retro-shadow), 0.12em 0.12em var(--color-retro-shadow),
  0.15em 0.15em var(--color-retro-shadow), 0.18em 0.18em var(--color-retro-shadow);

// SVG equivalent — chained 1px drop-shadows compound into one solid extrusion
// that follows the path outline. Use this for the logo and any extruded SVG.
--extrude-svg: drop-shadow(1px 1px 0 var(--color-retro-shadow))
  drop-shadow(1px 1px 0 var(--color-retro-shadow)) drop-shadow(1px 1px 0 var(--color-retro-shadow))
  drop-shadow(1px 1px 0 var(--color-retro-shadow));
```

### Theme token sets

Dark is the existing shipped theme — keep the current values from `globals.scss`. The five new themes:

**Light**

```
--color-bg:#f7f8fc   --color-surface:#ffffff   --color-border:#dfe3f0
--color-text:#171b2e   --color-text-muted:#5a6280
--color-accent:#0b749a   --color-accent-strong:#d6206a   --color-highlight:#b35c00
--color-win:#0f8a4f   --color-loss:#c9283e
--color-position-g:#0c7560   --color-position-f:#9a5b00   --color-position-c:#7b3fb0
--color-control-bg:#ffffff   --color-control-placeholder:#7c86a6
--color-focus-ring:rgba(14,127,168,0.28)
--color-accent-purple:#7b3fb0   --color-retro-shadow:#bfe0ea
color-scheme: light
```

**High contrast** (WCAG AAA body text)

```
--color-bg:#000000   --color-surface:#0b0e1a   --color-border:#7d86b4
--color-text:#ffffff   --color-text-muted:#cfd4ec
--color-accent:#6fe3ff   --color-accent-strong:#ff74ae   --color-highlight:#ffc978
--color-win:#68f5b0   --color-loss:#ff939c
--color-position-g:#6fe3ff   --color-position-f:#ffc978   --color-position-c:#cbb2ff
--color-control-bg:#000000   --color-focus-ring:rgba(111,227,255,0.55)
--color-accent-purple:#c3aeff   --color-retro-shadow:#1d5b6d
color-scheme: dark
```

**Colorblind-safe** (blue/amber; no red-green pairing)

```
--color-bg:#0f1220   --color-surface:#191d2e   --color-border:#2e3650
--color-text:#eef1f8   --color-text-muted:#98a1bd
--color-accent:#5aa9ff   --color-accent-strong:#ffb02e   --color-highlight:#e4e8f4
--color-win:#5aa9ff   --color-loss:#ff9d2e
--color-position-g:#5aa9ff   --color-position-f:#ffb02e   --color-position-c:#c9cede
--color-control-bg:#0b0e1a   --color-focus-ring:rgba(90,169,255,0.34)
--color-accent-purple:#8f9bff   --color-retro-shadow:#26507f
color-scheme: dark
```

Note: `--color-win` and `--color-loss` are deliberately blue/amber here, not green/red. Anywhere the app encodes win/loss or good/bad **by colour alone**, add a redundant cue (sign, arrow, or label) so this theme works.

**Amber CRT** (low-light drafting)

```
--color-bg:#120d05   --color-surface:#1d1409   --color-border:#402f14
--color-text:#ffd694   --color-text-muted:#b58c50
--color-accent:#ffa726   --color-accent-strong:#ff7043   --color-highlight:#ffd95e
--color-win:#bcd63f   --color-loss:#ff7043
--color-position-g:#ffd95e   --color-position-f:#ff9040   --color-position-c:#d7b06a
--color-control-bg:#0b0703   --color-focus-ring:rgba(255,167,38,0.34)
--color-accent-purple:#e0a94a   --color-retro-shadow:#6a4413
color-scheme: dark
```

**Team accent** (accent follows the user's club — values shown are the default red)

```
--color-bg:#14161c   --color-surface:#1e222b   --color-border:#333844
--color-text:#f1f2f6   --color-text-muted:#9aa0b2
--color-accent:#ff3b5c   --color-accent-strong:#ffd166   --color-highlight:#ffd166
--color-win:#4cc98a   --color-loss:#ff6b6b
--color-position-g:#7fb8ff   --color-position-f:#ffd166   --color-position-c:#c9a4ff
--color-control-bg:#0e1015   --color-focus-ring:rgba(255,59,92,0.32)
--color-accent-purple:#a08cff   --color-retro-shadow:#6b1c2c
color-scheme: dark
```

For team accent, `--color-accent` and `--color-retro-shadow` should be derived from the selected team's primary colour. `--color-retro-shadow` is a darkened, desaturated form of the accent — roughly 40% lightness of it. Everything else stays fixed.

### Team colours are not themed

Team identity (`TeamChip`, roster avatars) uses each NBA club's real primary colour and computes its own foreground for contrast. It must never borrow a theme token, or the same team would change colour between themes. Keep the existing `TeamChip` colour map; the redesign adds a WCAG relative-luminance check to pick black or white text:

```js
const chan = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const contrastText = (hex) => {
  const [r, g, b] = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16) / 255).map(chan);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05) / 0.05 >= 4.5 ? "#000000" : "#FFFFFF";
};
```

---

## 3. Text size and density

### Text size (user-facing, Settings only)

Four steps on `data-font-scale`, applied to the root. It rescales the whole type scale, so tables and controls scale too — not just body copy.

| Scale     | xs         | sm         | md        | lg       | xl      |
| --------- | ---------- | ---------- | --------- | -------- | ------- |
| `sm`      | 0.6875rem  | 0.8125rem  | 0.9375rem | 1.125rem | 1.5rem  |
| `default` | (existing) | (existing) | 1rem      | 1.25rem  | 1.75rem |
| `lg`      | 0.8125rem  | 0.9375rem  | 1.125rem  | 1.375rem | 2rem    |
| `xl`      | 0.875rem   | 1rem       | 1.25rem   | 1.5rem   | 2.25rem |

Persist to the user's settings alongside the existing appearance preferences in `src/lib/settings/types.ts`.

### Density (internal — currently not user-facing)

Table row rhythm, on `data-density`:

```scss
[data-density="compact"] {
  --row-y: var(--space-2);
  --row-x: var(--space-3);
}
[data-density="comfortable"] {
  --row-y: var(--space-3);
  --row-x: var(--space-4);
} // default
[data-density="roomy"] {
  --row-y: var(--space-4);
  --row-x: var(--space-6);
}
```

All table cell padding must be `var(--row-y) var(--row-x)` — never hardcoded — so density is a one-attribute change.

---

## 4. The keycap: one interactive mechanic

Every pressable control in the app shares this. It generalises what `PlayerStatFilters` already does today.

**At rest (unselected):** 1px border in `--color-border`, background `--color-bg`, text `--color-text`, `box-shadow: var(--retro-1)`.

**Engaged (selected/active):** 1px border in `--color-accent`, background `--color-accent`, text `--color-bg`, `transform: translate(-1px,-1px)`, `box-shadow: var(--retro-4)` — the key lifts off its own extrusion.

**Danger variant:** 1px dashed `--color-loss`, transparent background, text `--color-loss`, no shadow.

Shared base:

```scss
display: inline-grid;
grid-auto-flow: column;
align-items: center;
gap: var(--space-2);
padding: var(--space-2) var(--space-3);
border-radius: var(--radius-sm);
font-family: var(--font-display);
font-size: var(--font-size-sm);
font-weight: var(--font-weight-bold);
text-transform: uppercase;
letter-spacing: var(--tracking-wide);
cursor: pointer;
transition:
  transform var(--duration-fast) var(--ease-out),
  box-shadow var(--duration-fast) var(--ease-out);
```

Applies to: stat-view tabs, page actions, filter toggles, pagination, theme cards, font-size options, formula options, nav rail caps, and the sign-in button. Build it once as a `Key` component (or SCSS mixin with `--on` / `--off` / `--danger` modifiers) and use it everywhere.

**Active-press behaviour** (sign-in button and any primary action): `transform: translate(2px,2px); box-shadow: var(--retro-2);` — it presses into the shadow.

---

## 5. Page header — identical on all 12 screens

The largest consistency win. Every screen opens with the same block:

```
<eyebrow>          — uppercase, --font-size-xs, --tracking-wide,
                     --font-weight-semibold, colour --color-accent
<h1>               — --font-display, --font-size-xl, --font-weight-bold,
                     line-height 1.1, --tracking-tight, text-shadow: var(--extrude)
<description>      — --font-size-sm, --color-text-muted, max-width 64ch, text-wrap: pretty
<actions>          — right-aligned keycaps, aligned to the baseline of the title block
<rule>             — 2px high, background --color-accent, box-shadow 0 2px 0 var(--color-retro-shadow)
```

Container: `padding: var(--space-6) var(--space-6) 0`, header row is `grid-template-columns: minmax(0,1fr) auto`, `align-items: end`, `gap: var(--space-4)`.

The eyebrow is what tells the user where they are — it names the section, and the sidebar group it belongs to:

| Screen        | Eyebrow           | Title           | Actions               |
| ------------- | ----------------- | --------------- | --------------------- |
| Home          | Dashboard         | Command centre  | Open players          |
| Players       | Research          | Players         | Export CSV, Save view |
| Player detail | Research · Player | _player name_   | ★ Starred             |
| Teams         | Research          | NBA teams       | —                     |
| Team detail   | Research · Team   | _team name_     | All teams             |
| My Teams      | My league         | My teams        | New team              |
| Leagues       | My league         | Leagues         | New league            |
| Starred       | My league         | Starred players | —                     |
| Settings      | Account           | Settings        | —                     |
| Sign in       | Account           | Sign in         | —                     |

Descriptions used in the prototype are in `Court Vision - Redesign.dc.html` (`PAGES` map in the logic class). They are written to explain what the screen is for, not to fill space — keep or rewrite, but keep them one sentence.

---

## 6. Navigation

**Header** (`grid-template-columns: auto 1fr auto`, `padding: var(--space-3) var(--space-6)`, background `--color-surface`, 1px bottom border):

- Left: logo lockup (see §8)
- Centre-left: active league pill — `--radius-full`, 1px border, 6px accent dot, league name, then `12-team · 9-cat` in `--font-size-xs` muted
- Right: theme swatch strip + account pill (`cjrivas` + 24px accent-filled initials circle)

The theme swatch strip is six 20px buttons, each a 135° diagonal split of that theme's background and accent, with the active one outlined in `--color-accent` (`outline-offset: 1px`). It replaces the current `ThemeToggle`.

**Side rail** — collapsed 60px, expands to 236px on hover (`transition: width 160ms var(--ease-out)`, `box-shadow: 8px 0 24px rgb(0 0 0 / 0.28)` when open). It is absolutely positioned inside a 60px-wide relative parent so the expansion overlays content rather than reflowing it.

Items are grouped with muted uppercase group titles:

- **Research** — Home, Players, Teams
- **My league** — My Teams, Leagues, Starred
- **Settings** pinned to the bottom

Each item is `grid-template-columns: 2.25rem 1fr; gap: var(--space-3)`, so the 36px keycap stays fixed while the label is clipped by the rail's `overflow: hidden` during collapse. Group titles use the same two-column grid with an empty first cell, so they clip in step with the labels rather than sliding.

Active item: keycap in engaged state, row background `--color-bg`, label `--color-text`. Inactive: keycap at rest, label `--color-text-muted`.

---

## 7. Tables

Both the players table and the game log use one pattern.

- Wrapper: 1px border, `--radius-md`, background `--color-surface`, `overflow: hidden`, inner `overflow-x: auto`
- `border-collapse: collapse`, `font-variant-numeric: tabular-nums` on the table
- **Header:** `position: sticky; top: 0; z-index: 2`, background `--color-surface`, 1px bottom border, `--font-mono`, `--font-size-xs`, `--font-weight-semibold`, `--tracking-wide`, `white-space: nowrap`, muted
- **Sorted column header:** colour `--color-accent`, `box-shadow: inset 0 -3px 0 var(--color-accent)`, label suffixed ` ▼`
- **Sorted column cells:** `background: color-mix(in srgb, var(--color-accent) 10%, transparent)`, colour `--color-text`, `--font-weight-semibold`
- **Numeric cells:** `--font-mono`, `--font-size-sm`, right-aligned, `white-space: nowrap`, padding `var(--row-y) var(--row-x)`
- **Negative values:** colour `--color-loss`
- Rows separated by `border-top: 1px solid var(--color-border)` — no zebra striping

**Player cell** — this one needs care. It is the only flexible track in a table where every other cell is `nowrap`, so it must carry an explicit floor or wider row padding squeezes it until names overflow into the next column:

```scss
th.player,
td.player {
  min-width: 17rem;
  overflow: hidden;
}
td.player > .inner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
td.player .meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px;
  min-width: 0;
}
td.player a {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

Contents: 36px avatar, then name (`--font-size-sm`, semibold) above a row of `TeamChip` + position tag. This replaces the current separate First name / Last name / Team / Position columns — four columns become one, which is where the horizontal room for stats comes from.

**Avatar:** 2.25rem square, `--radius-sm`, 1px border, background `--color-bg`, `--font-mono` `--font-size-xs` semibold initials, and `border-left: 3px solid <team primary>` — team identity without a second chip.

**Position tag colours:** first letter of the position string selects `--color-position-g` / `-f` / `-c`; anything else falls back to `--color-text-muted`.

**Footer bar** inside the table wrapper: `grid-template-columns: auto 1fr auto` — rows-per-page select, centred `Page 1 of 23` in `--font-mono`, then Prev/Next keycaps. Disabled state is `opacity: .5; cursor: not-allowed`.

---

## 8. Logo

The chosen lockup is **the court plate beside a two-line wordmark**.

**Mark** — the floor plan seen from above, drawn on a 48-unit grid, `viewBox="0 0 48 48"`:

```html
<rect x="3" y="8" width="42" height="32" rx="3" fill="var(--color-accent)" />
<line x1="24" y1="8" x2="24" y2="40" stroke="var(--color-bg)" stroke-width="3" />
<circle cx="24" cy="24" r="7" stroke="var(--color-bg)" stroke-width="3" fill="none" />
<path d="M3 15 A 12 9 0 0 1 3 33" stroke="var(--color-bg)" stroke-width="3" fill="none" />
<path d="M45 15 A 12 9 0 0 0 45 33" stroke="var(--color-bg)" stroke-width="3" fill="none" />
```

Apply `filter: var(--extrude-svg)`. The mark re-inks per theme automatically because it is drawn in `--color-accent` with detail knocked out in `--color-bg`.

**Wordmark** — COURT over VISION, `--font-display`, bold, uppercase, `letter-spacing: 0.12em`, `line-height: 1`, `gap: 1px`. COURT in `--color-text`, VISION in `--color-accent`. Both carry `text-shadow: var(--extrude)`.

**Header lockup:** 34px mark + 14px wordmark, `gap: var(--space-3)`.
**Sign-in card:** vertical lockup — 72px mark above a centred 20px wordmark with `letter-spacing: 0.18em`.

### Detail tiers

The plate does not simply scale down. Drop detail at two thresholds:

| Size    | Contents                                    | Stroke |
| ------- | ------------------------------------------- | ------ |
| ≥32px   | plate + centre line + circle + both arcs    | 3      |
| 20–31px | plate + centre line + circle (arcs dropped) | 4      |
| <20px   | plate + centre line only                    | 6      |

Ship these as three SVG files (or one component that switches on a `size` prop) rather than letting the renderer scale one asset.

### Icon variants

- **App tile:** accent-filled rounded square (`rx="10"` on a 48 grid), plate inverted to a `--color-bg` outline inside it
- **Round avatar:** `--color-surface` circle, plate centred in the safe area
- **Monochrome:** plate filled `--color-text`, detail knocked out in `--color-bg` — for print and single-colour placements
- **Clearspace:** half the plate's height on every side

The current raster assets (`public/court-vision-mark-cropped.png`, `court-vision-logo-cropped.jpg`) are replaced by inline SVG so the logo themes with the app. Retain the raster only where an `<img>` is unavoidable (OG images, email).

---

## 9. Icon family

All icons: `viewBox="0 0 48 48"`, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, at most one accent detail each.

**Stroke weight is size-dependent:** `3.5` at 32px and above, `4` at 18–24px. Nav rail renders at 20px, so use 4 there.

Full paths are in `Court Vision - Icon Set.dc.html`. The nav set, reduced to a single path each for the 20px keycap slot:

```js
home: "M7 21 L24 8 L41 21 V41 H7 Z";
players: "M19 9 a7 7 0 1 1 0 14 a7 7 0 1 1 0-14 M6 41 v-3 a13 13 0 0 1 26 0 v3";
teams: "M17 8 L24 12 L31 8 L41 14 L36 23 L32 21 V41 H16 V21 L12 23 L7 14 Z";
myTeams: "M9 12 a3 3 0 0 1 3-3 h24 a3 3 0 0 1 3 3 v27 a3 3 0 0 1-3 3 H12 a3 3 0 0 1-3-3 Z M17 22 h14 M17 31 h9";
leagues: "M15 7 h18 v11 a9 9 0 0 1-18 0 Z M24 27 v7 M17 41 h14";
starred: "M24 6 L29.5 18 L42 19.5 L33 28 L35.5 41 L24 34.5 L12.5 41 L15 28 L6 19.5 L18.5 18 Z";
settings: "M9 14 h30 M9 24 h30 M9 34 h30 M19 10 a4 4 0 1 1 0 8 a4 4 0 1 1 0-8 M30 20 a4 4 0 1 1 0 8 a4 4 0 1 1 0-8 M16 30 a4 4 0 1 1 0 8 a4 4 0 1 1 0-8";
```

Also in the set: search, filter, sort, export, compare, trend, info, add, delete, chevron, ball, court. Each has an accent detail on the part that carries the meaning — the search handle, the sort's descending arrow, the export arrow, the trend line.

---

## 10. Screens

### Home — Command centre

Four readout cards across the top (`repeat(auto-fit, minmax(180px,1fr))`, `gap: var(--space-4)`): Watchlist 18, Roster 9/13, League rank 3rd, Team Z-Score +42.6. Each is label (xs, uppercase, muted) / value (`--font-display`, `--font-size-xl`, bold, `--extrude`, tabular) / note (`--font-mono`, xs, coloured by sentiment).

Below, a 6-column grid: Starred players (span 2), Rim Protectors roster (span 2), Conference standings (span 2), then Z-Score trend (span 3) and G-Score trend (span 3).

Every panel uses the same shell: 1px border, `--radius-md`, `--color-surface`, `padding: var(--space-4)`, and a header row (`1fr auto`) with an uppercase `--font-size-sm` bold title and a muted xs action or count, separated by a 1px bottom border and `padding-bottom: var(--space-2)`.

Charts: `preserveAspectRatio="none"`, 190px tall, zero line solid in `--color-border`, ±1σ lines dashed `2 6`. Three series distinguished by **both** colour and dash pattern (`0`, `7 4`, `2 5`) so they survive the colorblind-safe theme. A legend below names each series with its own swatch.

### Players

Stat-view tabs as keycaps (Regular / Advanced / Fantasy value / Starred) with the result count right-aligned in `--font-mono`. Filter panel below: search, games, basis, and a qualifying-minimums On/Off keycap pair. Fantasy view adds a category chip row — click to punt, ✕ to exclude; punted chips are struck through and muted, excluded chips get a dashed border.

Table per §7. Advanced and Fantasy views render the existing `AdvancedStatsLegend` / `FantasyValueLegend` components below it.

### Player detail

Six readout cards (PTS, REB, AST, FG%, STL, TOV) with league rank underneath, coloured `--color-accent-strong` at rank 1, `--color-highlight` in the top 5, muted otherwise.

Then a profile panel: 72px accent-bordered initials tile with `var(--retro-4)`, name + team chip + position + jersey, a wrapping definition list of biographical facts, and the season select with game count right-aligned. Below that, Mode and Window keycap groups, the multi-series chart, and the game log table.

Game log: Result column coloured `--color-win` / `--color-loss` and semibold; Date column is the sorted column.

### Teams

Grouping keycaps (Division / Conference / League), then division cards in `repeat(auto-fit, minmax(23rem,1fr))`. Each row is `auto minmax(0,1fr) auto 4.5rem`: team chip, name, record, then win% over a 4px progress bar filled to the win percentage.

### Team detail

Four readout cards (Record, Point diff, Assists/g, Steals/g). Roster panel on the left (`minmax(20rem,26rem)`), season stats table on the right. Each stat row shows label + description, value, then a 6px rank bar filled `(31 - rank) / 30` — green in the top 5, red at 20th or worse, accent between — with the ordinal beside it.

### My Teams

Roster grouped into Starters / Bench / Injured list. Each slot is a card in `repeat(auto-fill, minmax(15rem,1fr))`: a 2rem `--font-mono` slot badge, then player name over position. Empty slots use a dashed border, no background, muted text. Second team collapses to a single summary row.

### Leagues

One card per league: name + Active badge, scoring format, action keycaps (Active / Make active, Delete as the danger variant), then a fact grid across the bottom — Teams, Roster slots, Replacement rank, Scoring. Surfacing replacement rank matters: it is what the valuation engine derives from league size.

### Starred

Same table pattern, narrower column set: Z (sorted), G, VORP, GP, PTS, REB.

### Settings

Three panels.

1. **Theme** — six cards in `repeat(auto-fit, minmax(11rem,1fr))`, each showing a five-swatch strip of that theme's bg / surface / accent / accent-strong / text, its name, and a one-line note on what it is for. Selected card takes the engaged keycap treatment.
2. **Text size** — four keycap rows on the left (each labelled with its px body size), live preview on the right containing a wordmark, a sentence, and a small table, so the effect on tabular data is visible.
3. **Preferred value formula** — the eight formulas from `src/lib/valuation/registry.ts` as selectable cards in `repeat(auto-fit, minmax(19rem,1fr))`, each with a radio dot, name in `--font-display`, and its explanation. The existing copy is kept nearly verbatim; it is good.

### Sign in

Centred 24rem card, 1px border, `--radius-md`, `--color-surface`, `box-shadow: var(--retro-4)`. Vertical logo lockup, "Sign in" as a muted uppercase label, email and password fields, primary keycap button, then the create-account link.

---

## 11. Interactions & behaviour

- **Nav rail expand:** hover only, `width 160ms var(--ease-out)`. Add keyboard focus-within so it opens on tab.
- **Keycap press:** `transform` and `box-shadow` over `var(--duration-fast) var(--ease-out)`.
- **Screen enter:** `cv-enter` — `opacity 0 → 1`, `translateY(6px) → 0`, over `var(--duration-base) var(--ease-out)`.
- **Reduced motion:** the prototype includes `@media (prefers-reduced-motion: reduce)` collapsing all animation and transition durations to `.001ms`. Keep this.
- **Focus:** every interactive element needs a visible ring using `--color-focus-ring`. The prototype relies on the browser default; the real app should not.
- **Theme and text size** persist to user settings; theme should also honour `prefers-color-scheme` on first visit.

## 12. State

- `theme`: `'dark' | 'light' | 'contrast' | 'cvd' | 'crt' | 'team'` — persisted
- `fontScale`: `'sm' | 'default' | 'lg' | 'xl'` — persisted
- `density`: `'compact' | 'comfortable' | 'roomy'` — currently a build-time constant; persist it if you expose it
- `preferredFormula`: existing, from `src/lib/valuation/registry.ts`
- Existing URL query state (season, tab, filters, pagination) is unchanged by this redesign

## 13. Design tokens

The redesign adds no new spacing, radius, or duration tokens — it uses the existing scale from `globals.scss` throughout (`--space-1`…`--space-8`, `--radius-sm/md/lg/full`, `--duration-fast/base`, `--ease-out`, `--tracking-tight/wide`).

New tokens introduced: `--row-y`, `--row-x` (density), `--retro-1/2/4`, `--extrude`, `--extrude-svg`, and the per-theme colour sets in §2.

Fonts are unchanged: `--font-display` (Chakra Petch) for headings, wordmark, and keycaps; `--font-sans` (IBM Plex Sans) for body; `--font-mono` (IBM Plex Mono) for every number, stat label, and table header.

## 14. Assets

- `public/court-vision-mark-cropped.png`, `public/court-vision-logo-cropped.jpg` — the existing raster logo, superseded by the inline SVG mark in §8
- All icons and the logo are inline SVG drawn for this redesign; no third-party icon library is needed
- No photography or illustration is used anywhere in the redesign

## 15. Files in this bundle

| File                                  | What it is                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Court Vision - Redesign.dc.html`     | The redesign. All 12 screens, six themes, four text sizes. Open it and use the header swatches and Settings to switch.  |
| `Court Vision - Current.dc.html`      | The current site, rebuilt from the repo's own SCSS and components — the before, for comparison.                         |
| `Court Vision - Logo Options.dc.html` | Sixteen logo explorations. Turn 2 (`2a`) is the chosen direction.                                                       |
| `Court Vision - Icon Set.dc.html`     | The icon family: product icon detail tiers, app tile / avatar / monochrome variants, and all UI icons at 32px and 18px. |
| `github.md`                           | Repo mapping — every screen against the source files it was built from.                                                 |

Each `.dc.html` opens directly in a browser. The logic class at the bottom of each file holds the data and the style helper functions; the markup above it is the structure.

## 16. Suggested order of work

1. Token layer first — strip the global `h1–h5` extrusion, add the six theme blocks and the font-scale blocks to `globals.scss`. Nothing else can land cleanly before this.
2. The keycap, as one shared component or mixin.
3. Shell — header, logo, nav rail, footer.
4. The page-header block, applied to all 12 routes.
5. The table pattern — players table first, then game log, then starred.
6. Screen-by-screen, in the order of §10.
7. Settings last, since it depends on the theme and font-scale layers being real.
