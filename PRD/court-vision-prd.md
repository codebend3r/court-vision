# Court Vision

### Product Requirements Document (v1 / MVP)

**Author:** CJ
**Status:** Draft
**Last updated:** June 2026

---

## 1. Overview

Court Vision is a free, public web app that helps serious fantasy basketball managers find players who are trending in the specific statistical categories they care about. Instead of forcing users to dig through raw box scores, Court Vision surfaces "who is hot right now" at a glance and lets users drill into any player's performance over any time window, visualized through clean trend charts.

The product is built for standard 9-category leagues and is opinionated toward category grinders: people who manage their roster category by category and need to know, for example, "who is quietly putting up rebounds over the last two weeks."

---

## 2. Problem Statement

Serious category-league managers already have tools (BasketballMonster, Hashtag Basketball), but those tools tend to be dense, dated in design, and built around static rankings rather than momentum. A manager who is weak in a single category (say rebounds) has to manually sift through tables to find players who are consistently producing in that category right now.

There is no clean, modern, free tool that lets a grinder:

1. Pick a category they are weak in
2. Instantly see which available players are trending up or producing consistently in that category
3. Confirm the trend visually with a chart, over a time window they control

Court Vision fills that gap.

---

## 3. Target User

**Primary persona: The Category Grinder**

- Plays in standard 9-cat head-to-head or roto leagues
- Actively manages the waiver wire and streams players
- Thinks in terms of category strengths and weaknesses, not just overall value
- Comfortable with stats and charts; wants signal, not hand-holding
- Currently uses spreadsheets or paid tools and is open to a faster, cleaner option

**Out of scope for v1:** casual players, points-league-only managers, and DFS players. The design should not actively exclude them, but their needs do not drive v1 decisions.

---

## 4. Goals and Non-Goals

### Goals

- Make category trends readable at a glance, with charts doing the heavy lifting
- Let users filter to any player, any of the 9 categories, over any time window
- Default to a league-wide "who's hot" leaderboard so value surfaces immediately
- Ship a lean, fast, modern v1 with no account required

### Non-Goals (v1)

- User accounts, watchlists, and saved rosters (planned for a later phase)
- Live in-game stat updates (planned for a later phase)
- Points-league scoring and DFS tooling
- League sync / integration with Yahoo, ESPN, Sleeper, etc.
- Projections and rest-of-season forecasting

---

## 5. The 9 Categories

Court Vision is built around the standard 9-cat set:

| Counting stats            | Efficiency stats   | Negative stat  |
| ------------------------- | ------------------ | -------------- |
| Points (PTS)              | Field Goal % (FG%) | Turnovers (TO) |
| Rebounds (REB)            | Free Throw % (FT%) |                |
| Assists (AST)             |                    |                |
| Steals (STL)              |                    |                |
| Blocks (BLK)              |                    |                |
| Three-Pointers Made (3PM) |                    |                |

Efficiency categories (FG%, FT%) are handled differently from counting stats in trend logic, since volume matters (a player shooting 100% on one attempt is not "hot" at FT%). See section 7.

---

## 6. Core Features (v1)

### 6.1 Who's Hot Leaderboard (default landing view)

The home screen is a league-wide leaderboard ranking players by how hot they are right now.

- Default sort: an overall "heat" score across all 9 categories
- One-tap re-sort by any single category (e.g. sort by REB heat only)
- Each row shows the player, team, position, and a compact sparkline plus the category deltas driving their heat
- Time window selector applies to the whole board (default: last 10 games)
- Filters: position, team, and a toggle for "show only rostered-rate under X%" style availability proxy (availability data is a later enhancement; v1 may approximate via a simple games-played / minutes filter)

### 6.2 Custom Category Focus

The signature workflow. A user picks one or more categories they want to improve and the board re-ranks to highlight players trending up or performing consistently in just those categories.

Example: select REB. The board now surfaces players whose rebounding is rising or steadily high, regardless of their overall fantasy value.

### 6.3 Flexible Time Windows

Every view supports a time-window control:

- Last 10 games
- Last 30 days
- Season to date
- Career
- Custom range (date picker or last-N games)

The window drives both the leaderboard ranking and the player charts.

### 6.4 Player Trend Charts

Clicking a player opens a detail view with the chart at its center. Two chart modes:

- **Cumulative mode:** running total of a category over the window. A steadily rising line signals a player accumulating well. Useful for counting categories.
- **Average mode:** per-game average over the window. A flat, high line with few dips signals consistency. A line trending upward signals a player heating up.

Users can overlay a category against the player's own season baseline and against a league/positional reference line, so "good" is always in context. Multiple categories can be charted at once for a quick profile read.

### 6.5 Clean, Modern UI

Design is a first-class feature, not a coat of paint. Principles:

- Sleek, modern, low-clutter; charts and numbers are the hero
- Fast: instant filtering and sorting, no full-page reloads
- Responsive: works well on desktop and mobile
- Accessible color use for hot/cold encoding (not red/green alone)

---

## 7. Hot / Cold Detection Logic

The "heat" score quantifies what the charts show visually. Proposed v1 approach:

- For counting categories (PTS, REB, AST, STL, BLK, 3PM): compare the player's per-game average over the selected window against their own season baseline, normalized so categories are comparable. A positive, statistically meaningful delta = hot.
- For efficiency categories (FG%, FT%): weight by attempt volume so small samples do not produce noise. A player must clear a minimum attempts threshold in the window to register a trend.
- For turnovers (TO): inverted, since fewer is better.
- Overall heat score: a normalized composite across the 9 categories, with the ability to weight or isolate categories per the user's focus selection.

This logic should live server-side and be tunable, since the exact formula will be iterated on after launch.

---

## 8. Data and Sync Strategy

### Source

NBA Stats API (official, free, no auth) as the primary source, with Balldontlie as a candidate fallback / cleaner REST option. Final choice pending a spike on filtering and historical coverage.

### Storage

A PostgreSQL database stores normalized player and game-log data. Storing our own snapshots (rather than hitting the source API on every request) is what makes arbitrary time-window filtering fast and cheap.

### Sync

- A scheduled job (cron) pulls updated stats once or twice daily for v1
- Each sync writes per-game logs so any window (10 games, 30 days, season, career) can be computed from stored data
- Live in-game updates are explicitly out of scope for v1 and deferred to a later phase (would require frequent polling or websockets and adds meaningful complexity)

---

## 9. Tech Stack

- **Framework:** Next.js (App Router) with TypeScript
- **Runtime and package manager:** Bun, used as the package manager and script runner (in place of npm) for faster installs and a single fast toolchain
- **Data fetching:** server-side, keeping any source keys/headers off the client
- **Database:** PostgreSQL
- **Data layer:** an ORM such as Prisma for typed access and migrations
- **UI components:** a modern component library (e.g. shadcn/ui) for speed and a clean default look
- **Tables:** TanStack Table for sortable, filterable data grids
- **Charts:** a charting library suited to financial-style line/area charts (e.g. Recharts or visx)
- **Hosting:** Vercel or similar, with the sync job running as a scheduled task

---

## 10. Engineering Standards and Quality Guardrails

Court Vision treats code quality as a product feature. The following guardrails are enforced locally and in CI, so a clean, consistent codebase is the default rather than an afterthought.

### Tooling

- **Prettier:** the single source of truth for code formatting. No style debates; formatting is automatic and consistent across the codebase.
- **ESLint:** static analysis for code quality and correctness, catching bugs and enforcing conventions beyond formatting. Configured to integrate with Prettier so the two do not conflict.
- **TypeScript check:** a strict `tsc --noEmit` type check as a hard gate. Type errors block merges; the codebase stays fully typed end to end.
- **Vitest:** the test runner for unit and component tests, executed via Bun (`bun run vitest`). Fast, modern, and a natural fit for a TypeScript project, with the hot/cold scoring logic as a priority target for test coverage.

### Enforcement

- All four checks (Prettier, ESLint, TypeScript, Vitest) run in CI on every pull request and must pass before merge. All scripts are run through Bun (e.g. `bun run lint`, `bun run typecheck`, `bun run test`).
- **Git hooks (managed via Husky):** local hooks enforce the same standards before code leaves a developer's machine, so problems are caught early rather than in CI.
  - **Pre-commit hook:** runs Prettier (formatting), ESLint, the TypeScript check, and Vitest before a commit is allowed, so nothing unformatted, lint-failing, type-broken, or test-failing gets committed. `lint-staged` can scope formatting and linting to staged files for speed.
  - **Pre-push hook:** runs the full suite (Prettier, ESLint, TypeScript check, Vitest) again as a final gate before pushing, guaranteeing the branch is clean before it reaches the remote and CI.
- The heat-score and time-window aggregation logic, being the analytical core of the product, carries the highest expectation for test coverage.

---

## 11. Success Metrics

Even as a free tool, success should be measurable:

- Engagement: returning weekly active users during the NBA season
- Depth: percentage of sessions that use the category-focus filter (the signature feature)
- Performance: leaderboard and chart interactions feel instant (target sub-200ms client re-sort)
- Retention signal: users coming back around waiver days

---

## 12. Future Phases (post-v1)

Roughly in priority order:

1. **Accounts and watchlists:** save players to track, personalize the board
2. **Availability data:** real rostered-percentage so the board reflects true waiver targets
3. **Live in-game stats:** real-time updates during games
4. **League sync:** import your roster from Yahoo / ESPN / Sleeper to filter to available players automatically
5. **Points-league support:** broaden beyond 9-cat
6. **Monetization:** likely a free tier plus a paid tier for advanced filters, alerts, and live data

---

## 13. Open Questions and Risks

- **Data source reliability:** the NBA Stats API is unofficial in practice and can rate-limit or change. Mitigation: store our own data and keep a fallback source.
- **Heat formula tuning:** the exact "hot" definition will need real-season iteration; ship it tunable.
- **Availability proxy:** without true rostered-percentage in v1, "who's actually available" is approximate.
- **Scope creep:** the lean v1 must resist pulling watchlists/accounts/live data forward.

---

_End of document._
