"use client";

import { useEffect, useState } from "react";
import styles from "@/components/TokenSwatch/TokenSwatch.module.scss";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function TokenSwatch({ token }: { token: string }) {
  const { theme } = useTheme();
  const [value, setValue] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: theme intentionally retriggers the computed-style read.
  useEffect(() => {
    // getComputedStyle is a browser-only API unavailable during SSR, so the
    // computed token value can only be read post-mount; re-running on
    // `theme` re-reads the CSS custom property after a toggle.
    setValue(getComputedStyle(document.documentElement).getPropertyValue(token));
  }, [theme, token]);

  return (
    <div className={styles.swatch}>
      <div className={styles.tile} style={{ background: `var(${token})` }} />
      <p className={styles.name}>{token}</p>
      <code className={styles.value}>{value}</code>
    </div>
  );
}
