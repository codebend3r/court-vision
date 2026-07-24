# Court Vision — building with this design system

Court Vision is a **dark-first** fantasy-basketball UI. Every component is already
styled; you compose them with props and add layout glue with the shared tokens.
Never restyle a component's internals or hand-roll a lookalike.

## Setup & theming

- **Tokens are global.** All design tokens live as CSS custom properties on
  `:root` in the shipped stylesheet, so colors, spacing, and fonts apply as soon
  as the stylesheet is loaded. No wrapper is needed for a component to look right.
- **Dark-first.** The default `:root` is the dark theme. A light theme exists under
  `:root[data-theme="light"]`. Set `data-theme="dark"` (or `"light"`) on the root
  element; paint your own page shell with `background: var(--color-bg)` and
  `color: var(--color-text)` so it matches the components.
- **`ThemeProvider`** (exported) is only required when you use the theme-aware
  components — `ThemeToggle`, `TokenSwatch`, `ChartPaletteSwatches`. They call a
  `useTheme` hook and throw if rendered outside it. Everything else renders
  standalone.
- Several components (`SeasonSelect`, `PlayersTabs`, `PlayerStatFilters`,
  `FantasyValueView`, `PlayerStatChart`) read URL query state; in a real app wrap
  the tree in a nuqs adapter. In isolated previews they no-op safely.

## Styling idiom: tokens, not utility classes

There is **no utility-class system and no styling props** — components carry their
own CSS. For your own layout glue, use CSS grid with `gap` and reference these
tokens via `var(--*)` (matching the app's own conventions: grid over flexbox,
`gap`/padding over margins):

| Family | Tokens |
|---|---|
| Surfaces | `--color-bg`, `--color-surface`, `--color-border` |
| Text | `--color-text`, `--color-text-muted` |
| Accents | `--color-accent`, `--color-accent-strong`, `--color-highlight`, `--color-accent-purple` |
| Status | `--color-win`, `--color-loss` |
| Positions | `--color-position-g`, `--color-position-f`, `--color-position-c` |
| Spacing | `--space-1` `--space-2` `--space-3` `--space-4` `--space-6` `--space-8` (0.25→2rem) |
| Radius | `--radius-sm` `--radius-md` `--radius-lg` `--radius-full` |
| Type scale | `--font-size-xs` `--font-size-sm` `--font-size-md` `--font-size-lg` `--font-size-xl` |
| Fonts | `--font-sans` (body), `--font-display` (headings, retro long-shadow), `--font-mono` |
| Weights | `--font-weight-regular` `--font-weight-medium` `--font-weight-semibold` `--font-weight-bold` |

## Where the truth lives

Read `_ds/court-vision/styles.css` (it imports `_ds_bundle.css` with every token
definition and every component's compiled styles) before inventing any value, and
each component's `.d.ts` (its `<Name>Props` API) and `.prompt.md` (usage) before
composing it.

## Idiomatic snippet

```tsx
// A player row: pre-styled DS components, token-based layout glue.
<div style={{ display: "grid", gridAutoFlow: "column", justifyContent: "start",
              gap: "var(--space-3)", alignItems: "center",
              background: "var(--color-surface)", padding: "var(--space-4)",
              borderRadius: "var(--radius-md)", color: "var(--color-text)" }}>
  <PlayerAvatar fullName="Nikola Jokic" nbaPersonId={203999} size="sm" teamAbbr="DEN" />
  <span style={{ fontWeight: "var(--font-weight-semibold)" }}>Nikola Jokic</span>
  <PositionTag position="C" />
  <TeamChip team="DEN" size="sm" />
</div>
```
