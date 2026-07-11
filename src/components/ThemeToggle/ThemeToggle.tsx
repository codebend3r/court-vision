"use client";

import { useTheme } from "@/lib/theme/ThemeProvider";

import styles from "@/components/ThemeToggle/ThemeToggle.module.scss";

export function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme();

  const ariaLabel = mounted
    ? theme === "dark"
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle theme";
  const label = mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme";

  return (
    <button type="button" className={styles.toggle} onClick={toggleTheme} aria-label={ariaLabel}>
      {label}
    </button>
  );
}
