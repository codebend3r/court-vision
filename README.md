# Court Vision

Find fantasy basketball players trending in the categories you care about.

Court Vision pulls NBA player stats, tracks how each player is performing over recent
windows, and surfaces who is "heating up" — powering a leaderboard, trend charts, and a
weighted **heat score**.

> **Status:** in progress. The live Supabase database holds the full 2025-26 season
> (603 players, ~43k game logs via `sync:bdl`); the UI ships a themed app shell
> (light/dark), a searchable `/players` table with headshots, per-player
> season-average charts, and a `/design` style guide. The leaderboard and heat score
> are still to come. See [`docs/superpowers/specs/`](docs/superpowers/specs/) for the
> design specs.

## Stack

| Area         | Choice                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Framework    | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) + React 19       |
| Language     | TypeScript 5.9 (`strict`)                                                  |
| Styling      | SCSS modules (`*.module.scss`) + `src/styles/globals.scss` design tokens   |
| Data layer   | [Prisma 7](https://www.prisma.io/) + PostgreSQL (via `@prisma/adapter-pg`) |
| Validation   | [Zod](https://zod.dev/) at the NBA API boundary                            |
| Testing      | [Vitest 4](https://vitest.dev/) + React Testing Library (jsdom)            |
| Lint/format  | ESLint 9 (flat config) + Prettier (Prettier owns formatting)               |
| Git hooks    | Husky + lint-staged                                                        |
| Runtime / PM | [Bun](https://bun.sh/) (all scripts run through Bun)                       |
| CI           | GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))    |

## Prerequisites

- **Bun** 1.3.x — the package manager and runtime. Never use `npm` or `yarn`.
- **Node 24** — see [`.nvmrc`](.nvmrc). Only needed for tooling/editors that key off a
  Node version; the app and scripts run on Bun.
- **PostgreSQL** — only required once the data layer is exercised against a live database
  (see [Database](#database)). Not needed to run the dev server or the test suite.

## Getting started

```bash
bun install                 # installs deps, sets up git hooks, generates the Prisma client
cp .env.example .env        # then fill in DATABASE_URL when you need a database
bun dev                     # http://localhost:46644
```

`bun install` runs `prisma generate` (via `postinstall`) and installs the Husky hooks (via
`prepare`), so the generated Prisma client and quality gates are ready immediately.

### Environment

| Variable              | Required for                    | Notes                                                  |
| --------------------- | ------------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`        | Runtime queries, the live syncs | PostgreSQL connection string. See `.env.example`.      |
| `DIRECT_URL`          | `prisma migrate`                | Session-pooler connection for migrations.              |
| `BALLDONTLIE_API_KEY` | `sync:bdl`, `seed:demo`         | Balldontlie API key (per-game stats need a paid tier). |

`prisma generate`, `bun dev`, and the test suite all work without a real `DATABASE_URL` —
it's only needed for commands that actually connect to a database.

## Scripts

All scripts run through Bun (`bun run <name>`):

| Script           | Command                                    | Purpose                                            |
| ---------------- | ------------------------------------------ | -------------------------------------------------- |
| `dev`            | `next dev --port 46644`                    | Dev server on port **46644**                       |
| `build`          | `next build`                               | Production build                                   |
| `start`          | `next start`                               | Serve the production build                         |
| `lint`           | `eslint . --max-warnings 0`                | Lint (warnings are a hard failure)                 |
| `typecheck`      | `tsc --noEmit`                             | Type-check only                                    |
| `test`           | `vitest run`                               | Run the test suite once                            |
| `test:watch`     | `vitest`                                   | Watch-mode tests                                   |
| `prettier`       | `prettier --write .`                       | Format the repo                                    |
| `prettier:check` | `prettier --check .`                       | Verify formatting                                  |
| `db:generate`    | `prisma generate`                          | Regenerate the Prisma client                       |
| `db:migrate`     | `prisma migrate dev`                       | Create/apply a migration (needs `DATABASE_URL`)    |
| `sync:nba`       | `bun run src/lib/nba/sync.ts`              | Run the NBA stats sync (needs a live DB)           |
| `sync:bdl`       | `bun run src/lib/balldontlie/sync.ts`      | Run the Balldontlie stats sync (needs a live DB)   |
| `seed:demo`      | `bun run src/lib/demo/seed.ts`             | Seed all players + demo game logs into the live DB |
| `system-check`   | `run-s prettier:check typecheck lint test` | Run all quality gates locally                      |

## Project layout

```
.
├── prisma/
│   ├── schema.prisma           # Player / PlayerSeasonStats / PlayerGameLog models
│   └── migrations/             # applied to the live Supabase database
├── prisma.config.ts            # Prisma 7 CLI config (schema path, migrations, DATABASE_URL)
├── generated/prisma/           # generated Prisma client (gitignored; import via @generated/*)
├── public/                     # static assets
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── design/             # `/design` route: design-system reference (tokens, chart palettes)
│   │   ├── layout.tsx          # root layout: SiteHeader + SideNav shell around every page
│   │   └── page.tsx            # `/` route (blank landing inside the shell)
│   ├── components/             # React components (co-located SCSS module + test)
│   │   ├── ChartPaletteSwatches/  # labeled color chips for the chart stat palettes
│   │   ├── PlayerAvatar/       # NBA CDN headshot with initials fallback
│   │   ├── PlayerAvatar/       # NBA CDN headshot with initials fallback
│   │   ├── PlayerStatChart/    # two-panel Recharts season-average line chart
│   │   ├── PlayersSearchControls/  # debounced search, page size, retired toggle, pager
│   │   ├── SideNav/            # persistent side menu (Players, Design)
│   │   ├── SiteHeader/         # persistent Court Vision header
│   │   └── TokenSwatch/        # single design-token tile (swatch + name + computed value)
│   ├── lib/                    # (also: theme/ provider, players/ search, headshots/ mapping)
│   │   ├── balldontlie/        # Balldontlie adapter: client → schemas → endpoints → transform → sync
│   │   ├── demo/               # seed:demo generator (real identities/schedules, generated box scores)
│   │   ├── headshots/          # nbaPersonId mapping script (index source → match → persist)
│   │   ├── nba/                # NBA stats fetch → parse → validate → transform → persist
│   │   ├── prisma.ts           # Prisma client singleton (pg driver adapter)
│   │   └── stats/              # source-agnostic upserts + cumulative season-average series builder
│   └── styles/
│       ├── globals.scss        # design tokens (both themes) + typographic primitives
│       └── mixins.scss         # shared SCSS recipes (micro-label)
├── docs/superpowers/           # design specs + implementation plans
├── .github/workflows/ci.yml    # CI: prettier → lint → typecheck → test
└── .husky/                     # pre-commit + pre-push hooks
```

Import aliases: `@/*` → `src/*`, `@generated/*` → `generated/*`.

## Routes

Court Vision uses the Next.js **App Router** (`src/app`).

| Route                 | Source                                | Renders                                                              |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `/`                   | `src/app/page.tsx`                    | Blank landing inside the app shell (header + side menu)              |
| `/players/[playerId]` | `src/app/players/[playerId]/page.tsx` | Season-to-date average line charts for one player                    |
| `/players`            | `src/app/players/page.tsx`            | Searchable, paginated table of all players                           |
| `/design`             | `src/app/design/page.tsx`             | Design-system reference: tokens, chart palettes, type/spacing/radius |

No API route handlers exist yet; the NBA sync runs as a standalone Bun script.

## Data layer (NBA sync)

The first real data layer lives under [`src/lib/nba/`](src/lib/nba/) and pulls player stats
from the NBA Stats API (`stats.nba.com`) for the 2025–26 regular season:

```
constants → client (fetch + retry) → parse (columnar → rows) → schemas (zod)
          → endpoints → transform → persist (idempotent Prisma upserts) → sync
```

`bun run sync:nba` orchestrates the flow (player identity → season aggregates → per-game
logs by month). It's currently **code-only and proven by mocked unit tests** — running it for
real requires a live Postgres database and a `DATABASE_URL`. See
[`docs/superpowers/specs/2026-06-12-nba-player-stats-fetch-design.md`](docs/superpowers/specs/2026-06-12-nba-player-stats-fetch-design.md).

### Balldontlie adapter

Because `stats.nba.com` is unreachable from some networks, the **live** stats source is the
[Balldontlie API](https://docs.balldontlie.io/) via [`src/lib/balldontlie/`](src/lib/balldontlie/),
sharing the source-agnostic write path in `src/lib/stats/`. `bun run sync:bdl` orchestrates it
(requires `BALLDONTLIE_API_KEY` in `.env`; per-game stats are gated behind the ALL-STAR tier).
The full endpoint reference — e.g. [Get All Players](https://docs.balldontlie.io/#get-all-players) —
lives in the [Balldontlie documentation](https://docs.balldontlie.io/). See
[`docs/superpowers/specs/2026-07-10-balldontlie-player-stats-backfill-design.md`](docs/superpowers/specs/2026-07-10-balldontlie-player-stats-backfill-design.md).

`bun run map:headshots` is a one-time backfill that matches players to an NBA player-id index by
normalized name and writes `Player.nbaPersonId`, which `PlayerAvatar` uses to render CDN headshots.

## Database

Prisma 7 with a PostgreSQL datasource. The connection URL lives in `prisma.config.ts`
(read from `DATABASE_URL`), **not** in `schema.prisma`. The client is generated to
`generated/prisma/` (gitignored) and imported via the `@generated/*` alias.

```bash
bun run db:generate         # regenerate the client after editing schema.prisma
bun run db:migrate          # create/apply a migration (requires a live DATABASE_URL)
```

The schema defines `Player` (incl. `nbaPersonId` for headshots), `PlayerSeasonStats`, and
`PlayerGameLog`. Migrations under `prisma/migrations/` are applied to the live Supabase
database, which holds the full synced 2025-26 season.

## Testing

[Vitest](https://vitest.dev/) + React Testing Library (jsdom). Tests are **co-located** with
the code they cover (`lib/foo.ts` ↔ `lib/foo.test.ts`, `Foo.tsx` ↔ `Foo.test.tsx`).

```bash
bun run test                # run once
bun run test:watch          # watch mode
```

## Conventions & quality gates

Repo conventions (TypeScript, CSS, code style, commits) live in
[`CLAUDE.md`](CLAUDE.md). Highlights:

- Dependencies are **exact-pinned** (no `^`/`~`).
- No `any` and no type casts; prefer type guards and `unknown`.
- SCSS modules for components; tokens from `styles/globals.scss`.
- Commit subjects start with `CV:`.

Quality is enforced both locally and in CI:

- **pre-commit** — lint-staged (eslint --fix + prettier) → typecheck → test
- **pre-push** — prettier check → lint → typecheck → test
- **CI** — the same gates on every PR and push to `main`

Run them all at once with `bun run system-check`.
