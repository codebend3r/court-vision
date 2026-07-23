# Court Vision

Find fantasy basketball players trending in the categories you care about.

Court Vision pulls NBA player stats (2020–2025 seasons via the Balldontlie
API, stored in Postgres through Prisma) and turns them into sortable,
filterable views for fantasy decisions.

## What's built today

- **`/players`** — three tabs over the same searchable table shell:
  - **Regular Stats** — per-game or total box-score stats, lastN game
    windows, NBA qualifying minimums.
  - **Advanced Stats** — 15 per-game advanced metrics (TS%, PIE, usage, …)
    with explain-in-place header tooltips and a legend.
  - **Fantasy Value** — the multi-method valuation engine
    (`PRD/PRD-valuation-engine.md`): one sortable column per method —
    **Z-Score**, **G-Score** (game-to-game volatility aware), **Points**
    (points-league scoring), **VORP**, and **Pos VORP** (positional
    scarcity), plus a placeholder for SGP. Punt or weight categories,
    tune league size, and every score recomputes instantly client-side;
    the whole view lives in the URL.
- **`/players/[playerId]`** — player detail with season averages, game log,
  and stat charts.
- **`/teams`** — all 30 teams grouped by division, conference, or one league
  standings list; each team links to **`/team?is=<nickname>`** (e.g.
  `/team?is=raptors`), which shows the team's season stats and where each
  ranks across the league.
- **Auth** — Supabase email/password signup/login with per-user profiles.
- Light/dark retro theme throughout.

Still to come: the heat-score trending leaderboard, SGP (needs a sourced
standings-gain table), and auction dollar values.

## Getting started

You'll need [Bun](https://bun.sh/) installed.

```bash
bun install                 # install dependencies
cp .env.example .env        # fill in the values you need
bun dev                     # http://localhost:46644
```

Then open [http://localhost:46644](http://localhost:46644) in your browser.

Useful scripts: `bun run test`, `bun run lint`, `bun run typecheck`,
`bun run build`, and the sync jobs (`bun run sync:bdl`, `bun run sync:players`)
for refreshing stats. Conventions live in `CLAUDE.md`; design specs and plans
under `docs/superpowers/`.
