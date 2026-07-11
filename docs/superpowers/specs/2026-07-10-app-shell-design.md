# App shell (header + sidenav) — design

Date: 2026-07-10
Status: Approved
Depends on: `/players` route (`2026-07-10-players-table-design.md`)

## 1. Goal

Give every page a persistent shell: a "Court Vision" header, a side menu with
one link (Players → `/players`), a blank homepage, and readable link colors on
the dark background (the player-table links currently render browser-default
blue).

## 2. Design

- **`SiteHeader`** (`src/components/SiteHeader/`, server component): full-width
  top bar; "Court Vision" wordmark as a `Link` to `/`; `--color-surface`
  background, hairline `--color-border` bottom border, `--font-size-lg`
  wordmark in `--color-text` (explicitly NOT the anchor accent — override in
  the module).
- **`SideNav`** (`src/components/SideNav/`, client — `usePathname` for the
  active state): fixed-width left column nav (`<nav>` + `<ul>`), one entry
  "Players" → `/players`; active route gets an accent-tinted style
  (`aria-current="page"`).
- **Layout** (`src/app/layout.tsx` + `src/app/layout.module.scss`): body
  renders `SiteHeader`, then a grid shell — `220px` nav column + `1fr` content
  region (`gap` tokens); pages keep rendering their own `<main>` inside the
  content region. No classless divs.
- **Blank homepage**: `src/app/page.tsx` renders an empty `<main>` only.
  `src/components/Hello/` is deleted (its only consumer was the homepage);
  home's players list/link is gone (SideNav covers it).
- **Link primitive** (`src/styles/globals.scss` — within its charter):
  `a { color: var(--color-accent); text-decoration: none; }` +
  `a:hover { text-decoration: underline; }`. ~7:1 contrast on `--color-bg`.
- **Docs**: README routes row for `/` ("Blank landing inside the app shell"),
  layout tree drops `Hello/`, gains `SiteHeader/` + `SideNav/`.

## 3. Testing

- `SiteHeader.test.tsx`: wordmark text renders and links to `/`.
- `SideNav.test.tsx`: Players link renders with href `/players`; active state
  (`aria-current`) present when `usePathname` mocks `/players`, absent on `/`.
- `page.test.tsx` (home): renders an empty main (no Hello, no players list).
- Existing suites untouched; `bun run system-check` green.

## 4. Out of scope

- More nav entries, collapsible/mobile sidebar behavior, theming.
