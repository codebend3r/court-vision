# Standings Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cumulative-wins line chart under every standings block on `/teams` (6 division / 2 conference / 1 league), with hover/pin highlighting.

**Architecture:** The team-stats loader already fetches one row per `(team, game)`; expose those rows (with `gameDate`) alongside the aggregates. A pure `buildCumulativeWins` helper turns them into recharts rows. One client component, `StandingsTrendChart`, renders per block, mirroring `WatchlistTrendChart`'s recharts conventions (`getChartChrome`, reduced-motion, custom tooltip).

**Tech Stack:** Next.js 16 App Router (server page), recharts 3, SCSS modules, bun:test + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-01-standings-charts-design.md`

## Global Constraints

- Bun only: `bun run test` (never bare `bun test`), `bun run typecheck`, `bun run lint`.
- Type aliases only; never `any`; never cast (`as`); type guards where narrowing is needed; unit test every exported helper.
- Named exports; single-object params; immutable data; array methods over loops; `?.` with `??`; `!!` booleans; `&&` over ternary-null in JSX; `@/*` imports.
- SCSS modules co-located; tokens from `styles/globals.scss` for every value; grid + `gap`, no margins for spacing; no unclassed divs.
- A11y: legend chips are real `button`s with `aria-pressed`; Escape clears the pinned highlight; sr-only summary sentence per chart; `prefers-reduced-motion` disables line animation.
- Commits: `CV: <short title>` + bullets. Commit locally; NEVER push.

---

### Task 1: Game results with dates + cumulative-wins builder

**Files:**

- Modify: `src/lib/teams/stats.ts` (add `gameDate` to `TeamGameResult`)
- Modify: `src/lib/teams/loader.ts` (select `gameDate`, return ordered `results` in `TeamsData`)
- Create: `src/lib/teams/trend.ts`, `src/lib/teams/trend.test.ts`

**Interfaces:**

- Produces: `TeamGameResult` gains `gameDate: Date`; `TeamsData` gains `results: TeamGameResult[]` (sorted by `gameDate` ascending); `type WinsRow = { game: number } & Partial<Record<string, number>>`; `buildCumulativeWins({ results, abbrs }: { results: readonly TeamGameResult[]; abbrs: readonly string[] }): WinsRow[]`.

- [ ] **Step 1: Write failing tests** `src/lib/teams/trend.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { buildCumulativeWins } from "@/lib/teams/trend";
import { type TeamGameResult } from "@/lib/teams/stats";

const result = ({
  teamAbbr,
  gameId,
  winLoss,
  date,
}: {
  teamAbbr: string;
  gameId: string;
  winLoss: string | null;
  date: string;
}): TeamGameResult => ({
  teamAbbr,
  gameId,
  teamScore: null,
  opponentScore: null,
  winLoss,
  gameDate: new Date(date),
});

describe("buildCumulativeWins", () => {
  it("accumulates wins per team in date order", () => {
    const results = [
      result({ teamAbbr: "BOS", gameId: "1", winLoss: "W", date: "2025-10-22" }),
      result({ teamAbbr: "BOS", gameId: "2", winLoss: "L", date: "2025-10-24" }),
      result({ teamAbbr: "BOS", gameId: "3", winLoss: "W", date: "2025-10-26" }),
      result({ teamAbbr: "NYK", gameId: "4", winLoss: "L", date: "2025-10-23" }),
    ];
    const rows = buildCumulativeWins({ results, abbrs: ["BOS", "NYK"] });
    expect(rows).toEqual([
      { game: 1, BOS: 1, NYK: 0 },
      { game: 2, BOS: 1 },
      { game: 3, BOS: 2 },
    ]);
  });

  it("ignores teams not in the block and null results", () => {
    const results = [
      result({ teamAbbr: "LAL", gameId: "1", winLoss: "W", date: "2025-10-22" }),
      result({ teamAbbr: "BOS", gameId: "2", winLoss: null, date: "2025-10-22" }),
      result({ teamAbbr: "BOS", gameId: "3", winLoss: "W", date: "2025-10-24" }),
    ];
    const rows = buildCumulativeWins({ results, abbrs: ["BOS"] });
    expect(rows).toEqual([
      { game: 1, BOS: 0 },
      { game: 2, BOS: 1 },
    ]);
  });

  it("returns no rows when the block has no results", () => {
    expect(buildCumulativeWins({ results: [], abbrs: ["BOS"] })).toEqual([]);
  });
});
```

Note the semantics the first test pins down: a null `winLoss` still advances that team's game count (row exists) without incrementing wins; rows run to the max games played by any team in the block; a team appears in a row only if it has played that many games.

- [ ] **Step 2: Run to verify failure**: `bun run test src/lib/teams/trend.test.ts` — module not found.

- [ ] **Step 3: Implement.** In `src/lib/teams/stats.ts`, extend the type (one added line):

```ts
export type TeamGameResult = {
  teamAbbr: string;
  gameId: string;
  teamScore: number | null;
  opponentScore: number | null;
  winLoss: string | null;
  gameDate: Date;
};
```

In `src/lib/teams/loader.ts`: add `gameDate: true` to the `gameRows` select; change `TeamsData` to `{ season: string | null; stats: TeamSeasonStats[]; results: TeamGameResult[] }`; return `results` sorted ascending (`[...gameRows].sort((a, b) => a.gameDate.getTime() - b.gameDate.getTime())`) and `{ season: null, stats: [], results: [] }` in the empty branch. `buildTeamStats` consumes the same rows unchanged.

`src/lib/teams/trend.ts`:

```ts
import { type TeamGameResult } from "@/lib/teams/stats";

export type WinsRow = { game: number } & Partial<Record<string, number>>;

// Rows for a standings block's cumulative-wins chart: row N holds each
// team's win total after its Nth game (teams that haven't played N games
// are absent from row N, so their line simply stops).
export const buildCumulativeWins = ({
  results,
  abbrs,
}: {
  results: readonly TeamGameResult[];
  abbrs: readonly string[];
}): WinsRow[] => {
  const included = new Set(abbrs);
  const byTeam = results.reduce<Map<string, number[]>>((acc, entry) => {
    if (!included.has(entry.teamAbbr)) return acc;
    const wins = acc.get(entry.teamAbbr) ?? [];
    const previous = wins[wins.length - 1] ?? 0;
    return new Map(acc).set(entry.teamAbbr, [...wins, previous + (entry.winLoss === "W" ? 1 : 0)]);
  }, new Map());
  const maxGames = [...byTeam.values()].reduce((max, wins) => Math.max(max, wins.length), 0);
  return Array.from({ length: maxGames }, (_, index) => ({
    game: index + 1,
    ...[...byTeam.entries()].reduce<Partial<Record<string, number>>>(
      (row, [abbr, wins]) => (wins[index] === undefined ? row : { ...row, [abbr]: wins[index] }),
      {},
    ),
  }));
};
```

(`results` arrive date-sorted from the loader; the reduce preserves that order per team.)

- [ ] **Step 4: Run tests + gates**: `bun run test src/lib/teams` PASS; `bun run typecheck` (the loader's callers still compile — `TeamsData` consumers destructure only what they use); `bun run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/teams
git commit -m "CV: expose dated game results and cumulative-wins rows

- TeamGameResult carries gameDate; loader returns date-ordered results
- buildCumulativeWins maps a block's results to recharts rows"
```

---

### Task 2: StandingsTrendChart component

**Files:**

- Create: `src/components/StandingsTrendChart/StandingsTrendChart.tsx`, `StandingsTrendChart.module.scss`, `StandingsTrendChart.test.tsx`
- Create: `src/lib/hooks/usePrefersReducedMotion.ts` (extracted), Modify: `src/components/WatchlistTrendChart/WatchlistTrendChart.tsx` (import the shared hook, delete its local copy)

**Interfaces:**

- Consumes: `WinsRow` from `@/lib/teams/trend`; `NBA_TEAMS`, `type TeamAbbreviation` from `@/components/TeamChip/TeamChip`; `getChartChrome` from `@/components/PlayerStatChart/statMeta`; `useTheme` from `@/lib/theme/ThemeProvider`.
- Produces: `StandingsTrendChart({ title, teams, rows })` where `teams: ReadonlyArray<{ abbr: TeamAbbreviation; name: string }>` (block order) and `rows: readonly WinsRow[]`; exported `lineColorFor({ abbr, theme }): string` for tests; shared `usePrefersReducedMotion(): boolean` hook.

- [ ] **Step 1: Extract the hook.** Move `usePrefersReducedMotion` verbatim from `WatchlistTrendChart.tsx` into `src/lib/hooks/usePrefersReducedMotion.ts` (named export, `"use client"` not needed — it's imported by client components), update `WatchlistTrendChart` to import it. Run `bun run test src/components/WatchlistTrendChart` — still green.

- [ ] **Step 2: Write failing component tests** `StandingsTrendChart.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { StandingsTrendChart } from "@/components/StandingsTrendChart/StandingsTrendChart";

const teams = [
  { abbr: "BOS", name: "Boston Celtics" },
  { abbr: "NYK", name: "New York Knicks" },
] as const;

const rows = [
  { game: 1, BOS: 1, NYK: 0 },
  { game: 2, BOS: 2, NYK: 1 },
];

afterEach(cleanup);

describe("StandingsTrendChart", () => {
  it("renders nothing without rows", () => {
    const { container } = render(
      <StandingsTrendChart title="League" teams={[...teams]} rows={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a legend chip per team and a summary sentence", () => {
    render(<StandingsTrendChart title="Atlantic" teams={[...teams]} rows={rows} />);
    expect(screen.getByRole("button", { name: /Boston Celtics/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New York Knicks/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Best record: Boston Celtics, 2 wins through 2 games\./),
    ).toBeInTheDocument();
  });

  it("pins a team on click, exposes aria-pressed, and unpins on Escape", () => {
    render(<StandingsTrendChart title="Atlantic" teams={[...teams]} rows={rows} />);
    const chip = screen.getByRole("button", { name: /Boston Celtics/ });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(chip, { key: "Escape" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("click-again unpins", () => {
    render(<StandingsTrendChart title="Atlantic" teams={[...teams]} rows={rows} />);
    const chip = screen.getByRole("button", { name: /Boston Celtics/ });
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });
});
```

(recharts renders no SVG in happy-dom's zero-size containers — the tests target the legend, state, and summary, matching how `WatchlistTrendChart.test.tsx` handles it. Read that file first and mirror any setup it does.)

- [ ] **Step 3: Run to verify failure**, then implement `StandingsTrendChart.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayloadEntry,
} from "recharts";

import { getChartChrome } from "@/components/PlayerStatChart/statMeta";
import { NBA_TEAMS, TeamChip, type TeamAbbreviation } from "@/components/TeamChip/TeamChip";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { useTheme, type Theme } from "@/lib/theme/ThemeProvider";
import { type WinsRow } from "@/lib/teams/trend";

import styles from "@/components/StandingsTrendChart/StandingsTrendChart.module.scss";

export type StandingsTrendChartProps = {
  title: string;
  teams: ReadonlyArray<{ abbr: TeamAbbreviation; name: string }>;
  rows: readonly WinsRow[];
};

// Relative luminance of a #rrggbb hex, 0 (black) – 1 (white).
const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number): number => ((value >> shift) & 0xff) / 255;
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
};

// Team primary color, swapping to secondary when the primary would vanish
// against the theme background (e.g. BKN's black line on the dark theme).
export const lineColorFor = ({ abbr, theme }: { abbr: TeamAbbreviation; theme: Theme }): string => {
  const team = NBA_TEAMS.find((entry) => entry.abbreviation === abbr);
  if (team === undefined) return "#888888";
  const primaryLum = luminance(team.primary);
  if (theme === "dark" && primaryLum < 0.08) return team.secondary;
  if (theme === "light" && primaryLum > 0.85) return team.secondary;
  return team.primary;
};

const MAX_TOOLTIP_ROWS = 6;

export function StandingsTrendChart({ title, teams, rows }: StandingsTrendChartProps) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });
  const prefersReducedMotion = usePrefersReducedMotion();
  const [pinned, setPinned] = useState<TeamAbbreviation | null>(null);
  const [hovered, setHovered] = useState<TeamAbbreviation | null>(null);

  if (rows.length === 0) return null;

  const active = pinned ?? hovered;
  const lastRow = rows[rows.length - 1];
  const leader = [...teams].sort(
    (a, b) => (lastRow?.[b.abbr] ?? -1) - (lastRow?.[a.abbr] ?? -1),
  )[0];
  const leaderWins = leader === undefined ? 0 : (lastRow?.[leader.abbr] ?? 0);

  const togglePin = ({ abbr }: { abbr: TeamAbbreviation }) =>
    setPinned((current) => (current === abbr ? null : abbr));

  return (
    <figure
      className={styles.figure}
      onKeyDown={(event) => {
        if (event.key === "Escape") setPinned(null);
      }}
    >
      {!!leader && (
        <p className={styles.summary}>
          Best record: {leader.name}, {leaderWins} wins through {rows.length} games.
        </p>
      )}
      <div className={styles.plot} aria-label={`${title} cumulative wins`} role="img">
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={[...rows]} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={chrome.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="game"
              type="number"
              domain={[1, "dataMax"]}
              stroke={chrome.axis}
              tick={{ fill: chrome.axis, fontSize: 12 }}
              allowDecimals={false}
              minTickGap={24}
            />
            <YAxis
              stroke={chrome.axis}
              tick={{ fill: chrome.axis, fontSize: 12 }}
              allowDecimals={false}
              width={32}
            />
            <Tooltip content={<ChartTooltip active={active} />} cursor={{ stroke: chrome.axis }} />
            {teams.map((team) => {
              const color = lineColorFor({ abbr: team.abbr, theme });
              const emphasized = active === null || active === team.abbr;
              return (
                <Line
                  key={team.abbr}
                  dataKey={team.abbr}
                  name={team.name}
                  type="monotone"
                  stroke={color}
                  strokeWidth={active === team.abbr ? 3 : 1.5}
                  strokeOpacity={emphasized ? 1 : 0.18}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!prefersReducedMotion}
                  connectNulls
                  onMouseEnter={() => setHovered(team.abbr)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.legend}>
        {teams.map((team) => (
          <li key={team.abbr}>
            <button
              type="button"
              className={styles.legendChip}
              aria-pressed={pinned === team.abbr}
              data-dimmed={active !== null && active !== team.abbr ? "true" : undefined}
              onClick={() => togglePin({ abbr: team.abbr })}
              onMouseEnter={() => setHovered(team.abbr)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(team.abbr)}
              onBlur={() => setHovered(null)}
            >
              <TeamChip team={team.abbr} size="sm" />
              <span className={styles.legendName}>{team.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}
```

`ChartTooltip` (same file, mirrors `WatchlistTrendChart`'s): props `{ active: TeamAbbreviation | null; active?: boolean; label?: number; payload?: readonly TooltipPayloadEntry[] }` — rename the highlight prop to `highlighted` to avoid colliding with recharts' injected `active` flag. When `highlighted` is set, filter `payload` to that series; otherwise sort entries by value descending and cap at `MAX_TOOLTIP_ROWS` with a muted `+N more` line. Header: `Game {label}`; each row: color swatch (aria-hidden), team name, wins.

`StandingsTrendChart.module.scss`: `.figure` grid `gap: var(--space-3); margin: 0;`; `.summary` visually hidden (position absolute clip pattern — copy the repo's existing sr-only idiom if one exists, else the standard clip rect); `.plot` full-width; `.legend` `display: flex; flex-wrap: wrap; gap: var(--space-2); padding: 0; margin: 0; list-style: none;`; `.legendChip` grid auto-flow column, `gap: var(--space-2)`, `--font-size-xs`, `--color-text-muted`, transparent background, `--radius-sm`, `control-focus-ring` mixin, `[data-dimmed="true"] { opacity: 0.4; }`, `[aria-pressed="true"]` gets the `selected-accent` mixin.

- [ ] **Step 4: Run** `bun run test src/components/StandingsTrendChart src/components/WatchlistTrendChart` PASS; `bun run typecheck`; `bun run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/components/StandingsTrendChart src/components/WatchlistTrendChart src/lib/hooks
git commit -m "CV: standings trend chart component

- cumulative-wins lines in team colors with hover/pin highlighting
- tooltip filters to the highlighted team; capped otherwise
- shared usePrefersReducedMotion hook"
```

---

### Task 3: Wire charts into /teams + verification

**Files:**

- Modify: `src/app/teams/page.tsx`, `src/app/teams/page.module.scss`, `src/app/teams/page.test.tsx`

**Interfaces:**

- Consumes: `buildCumulativeWins`/`WinsRow` (Task 1), `StandingsTrendChart` (Task 2), `TeamsData.results`.

- [ ] **Step 1: Extend the page.** In `TeamsPage`, destructure `results` from `getTeamStats()`. Inside the groups `map`, after the `</ol>`:

```tsx
<StandingsTrendChart
  title={group.title}
  teams={group.teams.map((team) => ({ abbr: team.abbr, name: team.name }))}
  rows={buildCumulativeWins({
    results,
    abbrs: group.teams.map((team) => team.abbr),
  })}
/>
```

`section.group` already stacks children; add `gap: var(--space-4)` to `.group` in `page.module.scss` if it lacks one.

- [ ] **Step 2: Update page tests.** Extend `src/app/teams/page.test.tsx` (read it first; it mocks `getTeamStats`): mocks must add `results: []` (or dated rows) to the mocked `TeamsData`. Add cases: with results present, division view renders 6 elements matching `role="img"` charts, conference 2, league 1; with `results: []`, no chart renders.

- [ ] **Step 3: Full gates**: `bun run test`, `bun run typecheck`, `bun run lint`. Then `bun run system-check`.

- [ ] **Step 4: Commit**

```bash
git add src/app/teams
git commit -m "CV: cumulative-wins chart under each standings block

- 6 division / 2 conference / 1 league charts on /teams
- no chart frame when a season has no results"
```

---

## Self-Review Notes (applied)

- Spec coverage: data (T1), component incl. highlight/pin/Escape/summary/reduced-motion (T2), wiring + counts + empty state (T3). Tooltip "nearest line" simplified to sorted-and-capped when unhighlighted — deviation noted here deliberately.
- Type consistency: `WinsRow` keys are team abbrs; `TeamAbbreviation` used at the component boundary; `TeamsData.results` name matches across T1/T3.
- recharts jsdom limitation handled by testing legend/state/summary, matching the existing chart test approach.
