"use client";

import { useEffect, useState } from "react";

import { useTheme } from "@/lib/theme/ThemeProvider";

import styles from "./TokenSwatch.module.scss";

export function TokenSwatch({ token }: { token: string }) {
  const { theme } = useTheme();
  const [value, setValue] = useState("");

  useEffect(() => {
    // getComputedStyle is a browser-only API unavailable during SSR, so the
    // computed token value can only be read post-mount; re-running on
    // `theme` re-reads the CSS custom property after a toggle.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a browser-only computed style, not a subscribable external store
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
