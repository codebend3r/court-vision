"use client";

import { useId } from "react";

import { useTheme } from "@/lib/theme/ThemeProvider";
import { THEME_META } from "@/lib/theme/themes";

import styles from "@/components/SettingsTheme/SettingsTheme.module.scss";

// Six theme cards (spec §10 settings): a five-swatch strip of the theme's own
// palette, its name, and a one-line note on what it is for. Selection applies
// instantly through the same provider the header swatches use, and persists
// to localStorage there.
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
              {[meta.bg, meta.surface, meta.accent, meta.accentStrong, meta.text].map(
                (color, index) => (
                  <span
                    key={`${meta.id}-${index}`}
                    className={styles.swatch}
                    style={{ background: color }}
                  />
                ),
              )}
            </span>
            <span className={styles.name}>{meta.label}</span>
            <span className={styles.note}>{meta.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
