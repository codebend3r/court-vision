# Standings Charts — Design

Date: 2026-08-01
Branch: `league-containers`

## Summary

Add a **cumulative-wins line chart** beneath every standings block on `/teams`,
for all three views: division (6 charts), conference (2 charts), league (1
chart). Each chart draws one line per team in its block — X axis is games
played, Y axis is cumulative wins — with hover/click highlighting to keep
dense blocks readable.

## Data

- `TeamGameResult` (`lib/teams/stats.ts`) gains `gameDate: Date` so results
  can be ordered chronologically per team.
- `getTeamStats` (`lib/teams/loader.ts`) already fetches every distinct
  `(team, game)` result row to build records; it now also returns those rows
  as `results`, ordered by `gameDate`. No new queries.
- New pure module `lib/teams/trend.ts`:
  - `buildCumulativeWins({ results, abbrs })` → recharts-friendly rows
    `Array<{ game: number } & Record<abbr, number>>`, where each team's value
    is its win total after its Nth game. Teams with fewer games played simply
    stop early (no padding). Rows exist up to the max games played in the
    block. Unit tested (accumulation, loss-only stretches, missing teams,
    empty results).

## Component

`components/StandingsTrendChart/StandingsTrendChart.tsx` (client) +
`.module.scss` + `.test.tsx`, following the existing recharts conventions
(dashboard trend charts):

- recharts `LineChart`: one thin line per team, colored from the team's
  palette (fall back to the chart palette cycle when a team color is
  unavailable), no dots, `type="monotone"`.
- **Highlight interaction:** hovering a line or its legend chip emphasizes
  that team (full opacity + thicker stroke) and dims the rest; clicking or
  tapping a legend chip **pins** the highlight (`aria-pressed`), click-again
  or Escape unpins. Legend chips are real `button`s (keyboard focusable,
  `TeamChip` + name), laid out in a wrapping grid with `gap`.
- Tooltip: team name, game number, wins (only for the highlighted team when
  a highlight is active; otherwise nearest line).
- Axes/grid styled with `--color-border` / `--color-text-muted` tokens;
  chart container height fixed per block (`~16rem`), width fluid.
- `prefers-reduced-motion`: no animated line drawing.
- A visually hidden sentence per chart summarizes the block leader ("Best
  record: {team}, {wins} wins through {games} games.").

## Page wiring

`app/teams/page.tsx` renders `<StandingsTrendChart …>` directly below each
group's `<ol>`, inside the same `section.group`, passing that block's teams
(abbr, name, color) and the series rows built from the group's abbrs. The
season line above the blocks already names the season; charts inherit that
scope implicitly.

## Error handling & edges

- No game results yet (fresh season / empty DB): the chart renders nothing —
  the block shows only the standings list (no empty chart frame).
- A team with zero games simply has no line; it still appears in the legend,
  muted, so blocks stay visually consistent.

## Testing

- `lib/teams/trend.test.ts` — accumulation math and edge cases.
- `StandingsTrendChart.test.tsx` — renders a line + legend chip per team,
  hover/pin toggles highlight state (`aria-pressed`), Escape unpins, hidden
  summary sentence present.
- `app/teams/page.test.tsx` — chart count per view (6 / 2 / 1) and no chart
  when results are empty.

## Out of scope

- Games-above-.500 or rolling-win% variants.
- Date-based X axis, season pickers, playoff overlays.
- Charts on the `/team` detail page.
