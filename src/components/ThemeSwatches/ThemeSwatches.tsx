"use client";

import { useTheme } from "@/lib/theme/ThemeProvider";
import { THEME_META } from "@/lib/theme/themes";

import styles from "@/components/ThemeSwatches/ThemeSwatches.module.scss";

// The header theme strip: six 20px buttons, each a 135° diagonal split of
// that theme's background and accent, with the active one outlined. Replaces
// the old two-state ThemeToggle.
export function ThemeSwatches() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.strip} role="group" aria-label="Theme">
      {THEME_META.map((meta) => (
        <button
          key={meta.id}
          type="button"
          className={styles.swatch}
          style={{ background: `linear-gradient(135deg, ${meta.bg} 50%, ${meta.accent} 50%)` }}
          aria-label={`Switch to ${meta.label} theme`}
          aria-pressed={theme === meta.id}
          title={meta.label}
          onClick={() => setTheme({ theme: meta.id })}
        />
      ))}
    </div>
  );
}
