# design-sync notes (court-vision)

Court Vision is a **Next.js app, not a component library** — there is no shipped
`dist/`. The sync builds one from source.

## Build pipeline (buildCmd = `node .design-sync/build/build.mjs`)

Inputs live in `.design-sync/build/` (committed):

- **`vite.config.mts`** — Vite library build → `ds-dist/index.mjs` (browser ESM,
  React externalized, SCSS modules + `globals.scss` tokens compiled) + `ds-dist/style.css`
  (the converter's `cssEntry`; it becomes `_ds_bundle.css`). Key settings:
  - `resolve.alias` maps `@/` → `src/`, and `next/link` / `next/navigation` /
    `next/image` → browser shims in `shims/`.
  - `commonjsOptions.esmExternals: true` **plus** shims for `use-sync-external-store/*`
    (CJS, `require("react")`) → without both, the IIFE throws
    `Dynamic require of "react" is not supported` and nothing mounts.
  - `define` inlines `process.env.NEXT_PUBLIC_*` (SiteFooter reads the app version).
  - `publicDir: false` so the app's `public/` isn't copied into `ds-dist/`.
- **`tsconfig.ds.json`** — `tsc --emitDeclarationOnly` → `types/**/*.d.ts`, the type
  tree the converter reads for `<Name>Props`. Best-effort (tolerant of app-wide type
  errors). `findTypesRoot` picks up the root `types/` dir.
- **`entry.ts`** — the component barrel + `fonts.scss` + `globals.scss` imports.
- **`provider.tsx` → `PreviewProvider`** — wraps previews in `NuqsTestingAdapter` +
  `ThemeProvider` **and a dark `--color-bg` surface** (the converter's card template
  hardcodes `body{background:#fff}`; this DS is dark-first, so bare-text components
  are invisible on white without it).

## Discovery / props

- `componentSrcMap` lists all 31 components explicitly (no shipped `.d.ts` to auto-discover
  from). **`SiteHeader` is intentionally excluded** — it's an `async` server component
  that reads the auth session; it cannot render client-side.
- Props come from `types/`. Components with an explicit `export type <Name>Props`
  get full props; inline-typed ones (e.g. `SeasonStatCard`, `TeamMatchup`,
  `AdvancedStatsLegend`) emit an empty `<Name>Props` — add `cfg.dtsPropsFor.<Name>`
  if a fuller contract is wanted.

## Fonts

Brand fonts (Chakra Petch, IBM Plex Sans/Mono) load via a **remote Google Fonts
`@import`** in `build/fonts.scss` (`[FONT_REMOTE]`, informational). System fallback
if the design host blocks the CDN. Self-host woff2 via `cfg.extraFonts` for fully
offline fidelity.

## Known render warns (benign — do not re-investigate)

- `[RENDER_THIN] SeasonSelect: variants render identically` — the two cells select
  different seasons (2024-25 vs 2022-23); a `<select>`'s measured output is identical.
  Confirmed correct visually.
- `[FONT_REMOTE]` — expected (see Fonts).

## Preview scope

- **16 authored** previews in `.design-sync/previews/` (primitives + key data views).
- **13 ship on the converter's auto-render** (feature components that render fine
  with smart-default props).
- **2 floor cards**: `PlayerGameLogTable`, `PlayerStatChart` — need bespoke game-log /
  chart data; authorable on a later sync. `FantasyValueView` ships auto-render because
  its real valuation engine needs full statistical lines (`sq`/`cross`).
- `FantasyValueLegend` preview force-opens the `<details>` (post-mount `setAttribute`)
  so the card shows the method table.
- `PlayerAvatar` headshots load from the NBA CDN; they fall back to initials when the
  network/CSP blocks them (as in headless capture).

## App-config edits this sync made (outside `.design-sync/`)

- `.gitignore` — ignore `.ds-sync/`, `ds-bundle/`, `ds-dist/`, `types/`, `.design-sync/.cache/`, etc.
- `tsconfig.json` `exclude` and `.oxlintrc.json` `ignorePatterns` — added
  `.design-sync`, `.ds-sync`, `ds-dist`, `types` so the sync artifacts (which import
  the virtual `court-vision` package) don't break `bun run typecheck` / `lint`.

## Render check environment

- Playwright drove the **system Google Chrome** via
  `DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  (installed `playwright` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, no 150MB download).

## Re-sync risks

- **DS source changed** → re-run `buildCmd` before the driver (Vite + tsc emit).
- **Preview data** is hand-authored realistic NBA data (not live) — stable, but roster
  facts (teams, ids) can go stale across seasons; harmless to previews.
- The **CJS/react shim set** is tied to `use-sync-external-store`; if zustand/nuqs bump
  and pull a different SUS package, re-check for new `__require("react")` in `ds-dist/index.mjs`.
- The pre-commit hook (`.lintstagedrc.json`) references `eslint`/`prettier` while the
  repo uses oxlint/oxfmt; committing may need `--no-verify` if the hook is broken.
