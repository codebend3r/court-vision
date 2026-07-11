# Theme (light/dark) + /design route — design

Date: 2026-07-10
Status: Approved
Depends on: app shell (`2026-07-10-app-shell-design.md`), PlayerStatChart
(`2026-07-10-player-stats-chart-design.md`)

## 1. Goal

Retheme the app to the user-supplied palette (deep navy + neon pink/cyan/
orange), add light-mode support with a header toggle (system preference on
first visit), and ship a `/design` route that documents the design system:
color tokens + swatches, chart palettes, typography, spacing, radius — live in
both themes.

## 2. Tokens (`src/styles/globals.scss`)

Dark stays the default (`:root`); light lives under `:root[data-theme="light"]`.
Spacing, radius, and font tokens are unchanged.

| Token                                  | Dark                    | Light     |
| -------------------------------------- | ----------------------- | --------- |
| `--color-bg`                           | `#131629`               | `#f7f8fc` |
| `--color-surface`                      | `#1c2138`               | `#ffffff` |
| `--color-border`                       | `#2a3050`               | `#dfe3f0` |
| `--color-text`                         | `#e8eaf6`               | `#171b2e` |
| `--color-text-muted`                   | `#8b93b5`               | `#5a6280` |
| `--color-accent` (links/interactive)   | `#3fc3e8` (8.6:1 on bg) | `#0e7fa8` |
| `--color-accent-strong` (brand/active) | `#ff2e7e`               | `#d6206a` |
| `--color-highlight`                    | `#ff9f3c`               | `#b35c00` |

SideNav active state moves to `--color-accent-strong` (brand pink); links stay
on `--color-accent`.

## 3. Theme machinery

- `data-theme="dark" | "light"` on `<html>` (+ `suppressHydrationWarning`).
- Inline pre-paint script in the layout head (Next `<Script strategy="beforeInteractive">`
  or a raw `<script dangerouslySetInnerHTML>`): reads
  `localStorage.getItem("theme") ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")`
  and stamps the attribute — no wrong-theme flash.
- `src/lib/theme/ThemeProvider.tsx` (client): context `{ theme, toggleTheme }`;
  toggle updates state + attribute + localStorage. Initial context value reads
  the stamped attribute. `useTheme()` hook throws outside the provider.
- `ThemeToggle` (`src/components/ThemeToggle/`, client): icon/text button in
  `SiteHeader` (header itself stays a server component with a client island);
  `aria-label` "Switch to light theme"/"Switch to dark theme".

## 4. Charts under themes

`statMeta.ts` exports `getStatMeta({ theme })` and `getChartChrome({ theme })`
instead of static hexes. Series sets (validated 2026-07-10 with the dataviz
palette script against the new surfaces — both PASS):

- Dark (on `#131629`): `#3987e5 #199e70 #c98500 #008300 #9085e9 #e66767 #d55181`;
  shooting panel reuses slots 1-3.
- Light (on `#f7f8fc`): `#2a78d6 #1baf7a #eda100 #008300 #4a3aa7 #e34948 #e87ba4`.
- Chrome: grid/axis/end-label inks per theme (border + muted token values as
  literals with a comment naming the token).

`PlayerStatChart` reads `useTheme()` and derives its meta per render. Color
still follows the stat, never the toggle order.

## 5. `/design` route

`src/app/design/page.tsx` (static; no data) + `page.module.scss`, with a small
client `TokenSwatch` component (`src/components/TokenSwatch/`) that renders a
swatch for a CSS custom property and shows its **computed** value via
`getComputedStyle` (so displayed hexes can never drift from the stylesheet).
Sections:

1. **Colors** — swatch grid for the 8 color tokens (name, computed value).
2. **Chart palettes** — the 7-slot counting + 3-slot shooting sets for the
   active theme (from `getStatMeta`).
3. **Typography** — `--font-size-sm/md/lg/xl` rendered samples with token
   names.
4. **Spacing** — `--space-1..8` as labeled bars sized by the token.
5. **Radius** — `--radius-sm/md/lg` sample tiles.

The page renders under the live theme; the header toggle demos both. SideNav
gains a "Design" entry → `/design`.

## 6. Testing

- `ThemeProvider.test.tsx`: toggle flips context value, `data-theme`
  attribute, and localStorage; initial value honors a pre-stamped attribute.
- `ThemeToggle.test.tsx`: renders in provider; click toggles the attribute.
- `statMeta.test.ts`: `getStatMeta` returns the documented hex sets per theme;
  same stat→color mapping order both themes.
- `/design` page test: all five section headings render; swatch labels list
  the 8 tokens.
- Existing chart tests keep passing (default theme dark).

## 7. Out of scope

- Per-component theme overrides, additional accent usage guidelines, motion.
- Re-skinning screenshots in docs.
