# Player season dropdown

**Date:** 2026-07-15
**Status:** Approved

## Problem

The player detail page (`app/players/[playerId]`) fetches every game log the
player has (2020-21 through 2025-26 after the multi-season backfill), so the
chart, game-log table, and header games count all span the whole career. The
header "Season averages" card is hardcoded to `2025-26`.

## Goal

Scope the page to one season at a time, defaulting to the player's most recent
season with data. A dropdown in the header lets the user pick any season the
player appears in, or a career view aggregating everything since 2020-21.

## Decisions

- **Career ranks:** hidden. The career card shows averages only (no "Nth in
  NBA" pills); per-season views keep ranks against that season's qualified
  pool.
- **Default selection:** the player's most recent season with data — not
  necessarily the current league season. The dropdown lists only seasons the
  player actually played, plus Career.

## Design

### URL contract

- New `season` param joins `mode`/`span` in `lib/stats/searchParams.ts`:
  `?season=2024-25 | … | career`.
- Valid values are the league seasons derivable from the balldontlie backfill
  constants (2020-21 → current) plus the `career` sentinel; validated with
  `parseAsStringLiteral`, **no nuqs default**. Absent/invalid resolves
  server-side via `resolveSeasonSelection({ requested, playerSeasons })` →
  `requested ?? playerSeasons[0] ?? SEASON_LABEL`.
- A hand-edited URL for a league season the player did not play is honored and
  renders the existing empty state; the dropdown stays visible to recover.

### Data flow (RSC page)

1. Query the player's own `PlayerSeasonStats` rows (`playerId`, Regular
   Season), newest first → available seasons (deduped) + career totals source.
2. Resolve the selection.
3. **Season view:** game logs filtered `{ playerId, season }`; header-card
   pool = all players' season rows for that season (today's query with a
   dynamic season); ranks unchanged.
4. **Career view:** all logs; card line built by summing the player's own
   season rows (`buildCareerAverageLine` in `lib/players/seasonAverages.ts`) —
   per-game averages = summed totals / summed games, percentages = summed
   made / summed attempted, `rank: null` on every stat, no pool query.

### UI

- New `SeasonSelect` client component: native `<select>` (SCSS module, token
  values, styled like the existing `PlayersSearchControls` select), options =
  player's seasons newest-first plus "Career", bound to the `season` param via
  `useQueryStates` with `shallow: false` + transition (same pattern as
  `PlayerStatFilters`).
- It replaces the static season text in the header meta line
  ("2025-26 · 58 games") so it stays reachable even when the selected season
  has no logs. Games count reflects the selection. When the player has no
  season rows at all, the static text renders instead (current empty state
  unchanged).
- `SeasonStatCard` gains an optional `title` prop (default "Season
  averages"). Career passes "Career averages" and a season label showing the
  actual data span (e.g. "2020-21 – 2025-26") so the 2020 data floor is
  visible rather than implying a full career.
- Span filter label "Season" is renamed "All" since the window now means
  "entire selection" (reads correctly for both a season and career).
- Mode/span filters are otherwise untouched and apply within the selection.

### Cleanup

- The page's local `SEASON`/`SEASON_TYPE` constants are replaced by
  `SEASON_LABEL`/`SEASON_TYPE` from `lib/balldontlie/constants`. The
  Experience fact keeps using the league-current label (not the selection).

## Testing

Co-located, following existing patterns:

- `lib/stats/searchParams.test.ts` — season literals parse, junk → null,
  `resolveSeasonSelection` precedence (requested > latest played > league
  current).
- `lib/players/seasonAverages.test.ts` — career aggregation sums rows,
  weights percentages by attempts, emits `rank: null`, drops stats with zero
  attempts.
- `SeasonSelect.test.tsx` — options render newest-first plus Career; change
  writes the `season` param.
- `SeasonStatCard.test.tsx` — title prop override.
- `PlayerStatFilters.test.tsx` — span label now "All".
- `page.test.tsx` — logs query filtered to the resolved season by default;
  `?season=career` renders the career card without rank pills; dropdown
  renders when seasons exist.

## Out of scope

- Playoffs / season-type selection.
- Career ranks against a league-wide career pool.
- Changes to the /players list pages.
