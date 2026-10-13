"use client";

import { useId } from "react";

import { useTheme } from "#ui/components/ThemeProvider/ThemeProvider";
import { THEME_META } from "#ui/theme/themes";

import styles from "#ui/components/SettingsTheme/SettingsTheme.module.scss";

// The five tokens a card's strip samples, left to right.
const STRIP_TOKENS = [
  "--color-bg",
  "--color-surface",
  "--color-accent",
  "--color-accent-strong",
  "--color-text",
] as const;

// Six theme cards (spec §10 settings): a five-swatch strip of the theme's own
// palette, its name, and a one-line note on what it is for. Each swatch
// carries the card's `data-theme`, so it reads that theme's tokens while the
// card itself stays in the page's theme. Selection applies instantly through
// the same provider the header swatches use, and persists to localStorage
// there.
export function SettingsTheme() {
  const headingId = useId();
  const { theme, setTheme } = useTheme();

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Theme
      </h2>
      <div className={styles.cards} role="group" aria-label="Theme">
        {THEME_META.map((meta) => (
          <button
            key={meta.id}
            type="button"
            className={styles.card}
            aria-pressed={theme === meta.id}
            onClick={() => setTheme({ theme: meta.id })}
          >
            <span className={styles.strip} aria-hidden="true">
              {STRIP_TOKENS.map((token) => (
                <span
                  key={token}
                  className={styles.swatch}
                  data-theme={meta.id}
                  style={{ background: `var(${token})` }}
                />
              ))}
            </span>
            <span className={styles.name}>{meta.label}</span>
            <span className={styles.note}>{meta.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
