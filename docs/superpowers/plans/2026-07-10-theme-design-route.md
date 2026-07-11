# Theme + /design Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the app to the navy/neon palette with a light/dark toggle (system default, persisted) and a `/design` style-guide route.

**Architecture:** Dark token values stay in `:root`; light overrides live under `:root[data-theme="light"]`. A pre-paint inline script stamps `data-theme` from localStorage/OS preference; a client `ThemeProvider` exposes `{ theme, toggleTheme }`; a header `ThemeToggle` flips it. Charts get per-theme series/chrome via `getStatMeta`/`getChartChrome`. `/design` renders token swatches (computed values), chart palettes, type/spacing/radius scales.

**Tech Stack:** Next.js 16 App Router, React 19 context, SCSS tokens, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-10-theme-design-route-design.md` (token hex table in §2 is authoritative; chart palettes in §4 are validator-passed — copy exactly).

## Global Constraints

- Current branch only (no new branch). No `any`, no `as` casts. `?.` with `??`; `!!` for boolean conversion; no `for/of`; single object param for new functions. SCSS tokens only (raw hexes allowed ONLY as chart/JS constants with a token-naming comment). Tests co-located; Bun only; `CV:` commits; pre-commit runs the gate.
- Spec §2 hex table verbatim — dark: bg `#131629`, surface `#1c2138`, border `#2a3050`, text `#e8eaf6`, muted `#8b93b5`, accent `#3fc3e8`, accent-strong `#ff2e7e`, highlight `#ff9f3c`; light: `#f7f8fc` `#ffffff` `#dfe3f0` `#171b2e` `#5a6280` `#0e7fa8` `#d6206a` `#b35c00`.
- Chart sets §4 verbatim — dark `#3987e5 #199e70 #c98500 #008300 #9085e9 #e66767 #d55181`, light `#2a78d6 #1baf7a #eda100 #008300 #4a3aa7 #e34948 #e87ba4`; shooting = slots 1-3; stat→slot order identical in both themes.

---

### Task 1: Tokens + theme machinery

**Files:**

- Modify: `src/styles/globals.scss` (token values + light block), `src/app/layout.tsx` (pre-paint script, `suppressHydrationWarning`, ThemeProvider wrap), `src/components/SiteHeader/SiteHeader.tsx` (+ ThemeToggle island), `src/components/SideNav/SideNav.module.scss` (active → `--color-accent-strong`)
- Create: `src/lib/theme/ThemeProvider.tsx`, `src/components/ThemeToggle/ThemeToggle.tsx` + `.module.scss`
- Test: `src/lib/theme/ThemeProvider.test.tsx`, `src/components/ThemeToggle/ThemeToggle.test.tsx`

**Interfaces (produced, used by Tasks 2-3):**

- `type Theme = "dark" | "light"`; `ThemeProvider({ children })`; `useTheme(): { theme: Theme; toggleTheme: () => void }` (throws outside provider) — all from `@/lib/theme/ThemeProvider`.

- [ ] **Step 1: Failing tests.** `ThemeProvider.test.tsx`: probe component rendering `useTheme().theme` in a span + a toggle button calling `toggleTheme`. Cases: (a) default theme "dark" when no attribute; (b) `document.documentElement.dataset.theme = "light"` before render → theme "light"; (c) click toggle → span shows "light", `document.documentElement.dataset.theme === "light"`, `window.localStorage.getItem("theme") === "light"`; (d) `renderHook`-style: `useTheme` outside provider throws (wrap in `expect(() => render(<Probe/>)).toThrow("useTheme must be used within ThemeProvider")`). Reset `dataset.theme`/localStorage in `afterEach` (plus `cleanup`). `ThemeToggle.test.tsx`: inside provider, button has `aria-label "Switch to light theme"` under dark; click → attribute flips and aria-label becomes "Switch to dark theme".
- [ ] **Step 2: RED** — `bun run test -- src/lib/theme src/components/ThemeToggle`.
- [ ] **Step 3: Implement.**

`ThemeProvider.tsx`:

```tsx
"use client";

import { ReactNode, createContext, useContext, useState } from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readInitialTheme = (): Theme =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "light"
    ? "light"
    : "dark";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      window.localStorage.setItem("theme", next);
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeContextValue => {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
};
```

`layout.tsx` — `<html lang="en" suppressHydrationWarning>`, inline pre-paint script as the FIRST child of `<head>` (raw script, not next/script):

```tsx
const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;
```

```tsx
<html lang="en" suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
  </head>
  <body>
    <ThemeProvider>
      <SiteHeader />
      <div className={styles.shell}>
        <SideNav />
        <div className={styles.content}>{children}</div>
      </div>
    </ThemeProvider>
  </body>
</html>
```

`globals.scss`: replace the 6 color token values in `:root` with the spec §2 dark column, ADD `--color-accent-strong` + `--color-highlight`, then append:

```scss
:root[data-theme="light"] {
  --color-bg: #f7f8fc;
  --color-surface: #ffffff;
  --color-border: #dfe3f0;
  --color-text: #171b2e;
  --color-text-muted: #5a6280;
  --color-accent: #0e7fa8;
  --color-accent-strong: #d6206a;
  --color-highlight: #b35c00;
}
```

`ThemeToggle.tsx` (client): `const { theme, toggleTheme } = useTheme();` → `<button type="button" className={styles.toggle} onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>{theme === "dark" ? "Light" : "Dark"}</button>`. SCSS: surface bg, border token, radius-sm, font-size-sm, muted text.

`SiteHeader.tsx`: header becomes a flex/grid row (`justify-content: space-between` style in module) — wordmark left, `<ThemeToggle />` right. Header file itself stays a server component (no "use client"; the toggle is the client island). `SideNav.module.scss`: `.active { color: var(--color-accent-strong); ... }`.

- [ ] **Step 4: GREEN** — focused, then full `bun run test`.
- [ ] **Step 5: Commit** — `CV: retheme tokens + light mode machinery (provider, toggle, pre-paint stamp)`

---

### Task 2: Theme-aware charts

**Files:**

- Modify: `src/components/PlayerStatChart/statMeta.ts`, `src/components/PlayerStatChart/PlayerStatChart.tsx`, `src/components/PlayerStatChart/statMeta.test.ts` (create if absent), `src/components/PlayerStatChart/PlayerStatChart.test.tsx` (wrap renders in ThemeProvider)
- Test: co-located as above

**Interfaces:**

- Consumes: `Theme`, `useTheme` (Task 1).
- Produces: `getStatMeta(args: { theme: Theme }): StatMeta[]` (same `StatKey`/labels/panels as today; per-theme `color`); `getChartChrome(args: { theme: Theme }): { grid: string; axis: string; endLabel: string }`; `DEFAULT_ACTIVE_KEYS` unchanged. The static `STAT_META` export is REMOVED — grep for consumers (only PlayerStatChart.tsx and its tests) and update them.

- [ ] **Step 1: Failing tests** (`statMeta.test.ts`): (a) `getStatMeta({ theme: "dark" })` colors equal the §4 dark list in stat order pts..tov + fgPct/fg3Pct/ftPct = slots 1-3; (b) light likewise; (c) key/label/panel identical across themes (`map((m) => m.key)` deep-equal). Chrome: dark `{ grid: "#2a3050", axis: "#8b93b5", endLabel: "#8b93b5" }`, light `{ grid: "#dfe3f0", axis: "#5a6280", endLabel: "#5a6280" }` (values mirror `--color-border`/`--color-text-muted` — comment the token names).
- [ ] **Step 2: RED**, **Step 3: Implement** — statMeta refactor:

```ts
const SERIES_BY_THEME: Record<Theme, readonly string[]> = {
  dark: ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181"],
  light: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4"],
};
```

`getStatMeta` builds the 10 entries mapping counting stats to slots 0-6 and shooting to slots 0-2, per theme. `PlayerStatChart.tsx`: `const { theme } = useTheme();` then `const statMeta = getStatMeta({ theme });` and `const chrome = getChartChrome({ theme });` — replace the hardcoded grid/axis/end-label hexes with `chrome.*`. Update `PlayerStatChart.test.tsx`: wrap every `render` in `<ThemeProvider>` (jsdom default = dark; existing color-independent assertions unchanged).

- [ ] **Step 4: GREEN** focused + full suite. **Step 5: Commit** — `CV: theme-aware chart palettes and chrome`

---

### Task 3: /design route + TokenSwatch + nav entry

**Files:**

- Create: `src/app/design/page.tsx`, `src/app/design/page.module.scss`, `src/components/TokenSwatch/TokenSwatch.tsx` + `.module.scss` + test, `src/components/ChartPaletteSwatches/ChartPaletteSwatches.tsx` + `.module.scss` (client, uses `useTheme` + `getStatMeta`), `src/app/design/page.test.tsx`
- Modify: `src/components/SideNav/SideNav.tsx` (add `{ href: "/design", label: "Design" }` to `NAV_ENTRIES`), `src/components/SideNav/SideNav.test.tsx` (assert Design link), `README.md` (routes row `| \`/design\` | \`src/app/design/page.tsx\` | Design-system reference: tokens, chart palettes, type/spacing/radius |`+ layout-tree entries for the two new component dirs and`src/app/design/`)

**Interfaces:**

- Consumes: `useTheme`, `getStatMeta` (Tasks 1-2).
- `TokenSwatch({ token }: { token: string })` — client; renders a tile whose background is `var(<token>)`, the token name, and the computed value from `getComputedStyle(document.documentElement).getPropertyValue(token)` (read in `useEffect` into state, keyed on `useTheme().theme` so it re-reads on toggle; render the value in a `<code>`; empty string until effect runs — fine).

`page.tsx` (server component, static — no `force-dynamic`): five `<section>`s each with an `<h2>`: "Colors" (8 `TokenSwatch`es: `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-strong`, `--color-highlight`), "Chart palettes" (`<ChartPaletteSwatches />` — renders the counting seven + shooting three as labeled color chips from `getStatMeta`), "Typography" (samples: one line each at `var(--font-size-sm/md/lg/xl)` labeled with the token name), "Spacing" (for `--space-1..8`: a bar `width: var(--space-N)` with label — explicit list, no loops needed beyond `map` over a literal array), "Radius" (three `--radius-*` tiles). All styling in `page.module.scss` from tokens; no classless divs.

- [ ] **Step 1: Failing tests.** `page.test.tsx`: renders the five `h2` headings and all 8 token names (mock nothing; TokenSwatch renders name synchronously). `TokenSwatch.test.tsx`: inside ThemeProvider, shows the token name; sets a CSS var on documentElement via `document.documentElement.style.setProperty("--color-bg", "#123456")` and asserts the computed value text appears after effect (jsdom supports getPropertyValue on inline styles). `SideNav.test.tsx`: add Design-link assertion (href `/design`).
- [ ] **Step 2: RED**, **Step 3: Implement**, **Step 4: GREEN** focused + `bun run system-check` + `bun run build` (expect `/design` static ○).
- [ ] **Step 5: Commit** — `CV: add /design style-guide route + nav entry`

---

## Self-review notes

- Spec §2 → Task 1 (token table verbatim, incl. SideNav accent-strong); §3 → Task 1 (script, provider, toggle, suppressHydrationWarning); §4 → Task 2 (both series sets + chrome, stat-order invariant test); §5 → Task 3 (five sections, computed-value swatches, nav entry); §6 tests distributed per task; §7 respected (no extras).
- Known accepted quirk (documented for reviewers): with light theme active, server HTML renders dark-theme chart hexes and the client corrects on hydration — the chart SVG mounts client-side via ResponsiveContainer anyway, so no visible flash; `suppressHydrationWarning` covers the `<html>` attribute only.
- Names consistent: `Theme`, `useTheme`, `getStatMeta({ theme })`, `getChartChrome({ theme })`, `TokenSwatch({ token })`.
