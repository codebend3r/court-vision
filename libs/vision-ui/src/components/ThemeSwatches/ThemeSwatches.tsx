"use client";

import { useTheme } from "#ui/components/ThemeProvider/ThemeProvider";
import { THEME_META } from "#ui/theme/themes";

import styles from "#ui/components/ThemeSwatches/ThemeSwatches.module.scss";

// The header theme strip: six 20px buttons, each a 135° diagonal split of
// that theme's background and accent, with the active one outlined. Replaces
// the old two-state ThemeToggle. The split is an inner chip carrying the
// theme's `data-theme`, so it reads that theme's tokens while the button's own
// border and outline stay in the page's theme.
export function ThemeSwatches() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.strip} role="group" aria-label="Theme">
      {THEME_META.map((meta) => (
        <button
          key={meta.id}
          type="button"
          className={styles.swatch}
          aria-label={`Switch to ${meta.label} theme`}
          aria-pressed={theme === meta.id}
          title={meta.label}
          onClick={() => setTheme({ theme: meta.id })}
        >
          <span className={styles.chip} data-theme={meta.id} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
