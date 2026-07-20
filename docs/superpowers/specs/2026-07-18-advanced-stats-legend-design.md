# Advanced stats tooltips + legend

Explain what each Advanced Stats column means and how it is calculated, without
leaving the table. Approved direction: **Concept D** — header tooltips for the
in-context question plus a collapsible legend panel for the full read-through.

## Shared stat metadata

`src/lib/players/advancedStatMeta.ts` is the single source of truth. One entry
per `AdvancedMetricKey` (15 total), in table column order:

- `key` — the `AdvancedMetricKey` (`pie`, `pace`, …)
- `label` — the column abbreviation shown in the header ("TS%")
- `fullName` — spelled out ("True Shooting Percentage")
- `description` — one plain-English sentence on what it measures
- `formula` — a readable calculation string (`PTS ÷ (2 × (FGA + 0.44 × FTA))`)

`ADVANCED_STAT_COLUMNS` in `app/players/page.tsx` is replaced by this list, so
the header row, body cells, tooltips, and legend all render from the same data.
Formulas are the readable simplified forms; PIE and USG% carry honest
simplifications ("player events ÷ total game events") with the description
providing the intuition. Definitions match NBA.com/Balldontlie advanced stats.

## Tooltip surface

Hovering or keyboard-focusing an advanced column header reveals a bubble:
accent-colored `LABEL — FULL NAME` line, the description, and the formula in
mono on a recessed chip. The trigger is the whole `<th>` (CSS
`:hover`/`:focus-within`, no client JS); clicking the header still sorts.

- Bubble drops below the header, right-aligned to its cell, so it never
  escapes the table's left/right edges (advanced columns start ~5 columns in).
- Visual box shares a `tooltip-bubble` mixin with `InfoTip` (extracted to
  `styles/mixins.scss`) so the two tooltip styles cannot drift.
- Hidden state is `display: none` (revealed with `@starting-style` +
  `transition-behavior: allow-discrete` for the fade) so hidden bubbles never
  create phantom scroll area inside `.tableScroller`. Browsers without
  discrete-display transitions get an instant reveal — acceptable degradation.
- The sort link gets `aria-describedby` pointing at the bubble
  (`role="tooltip"`), so screen readers announce the explanation.
- Known edge: with very short result sets (1–2 rows) an open bubble can extend
  past the table bottom and be clipped by the scroller. Accepted; default page
  size is 50.

## Legend surface

`src/components/AdvancedStatsLegend/AdvancedStatsLegend.tsx` — a `<details>`
disclosure card rendered directly under the table scroller (above the bottom
pager) on the Advanced tab only, collapsed by default:

- Summary row: chevron + "What do these stats mean?" (chevron rotates when
  open).
- Expanded: a `<dl>` of all 15 stats in table column order, laid out in a
  responsive multi-column grid (`auto-fit, minmax`): mono accent abbreviation,
  bold full name, description, mono formula.
- No open-state persistence.

## Scope

Advanced tab only. Regular Stats columns can adopt the same pattern later.

## Testing

- `advancedStatMeta.test.ts` — every `AdvancedMetricKey` appears exactly once
  with non-empty `label`/`fullName`/`description`/`formula`; labels unique.
- `AdvancedStatsLegend.test.tsx` — renders the summary and all 15 terms.
- `page.test.tsx` (existing advanced coverage) — headers expose tooltip text
  via `aria-describedby`.
