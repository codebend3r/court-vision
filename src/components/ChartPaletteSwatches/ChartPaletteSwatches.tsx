"use client";

import { getStatMeta } from "@/components/PlayerStatChart/statMeta";
import { useTheme } from "@/lib/theme/ThemeProvider";

import styles from "./ChartPaletteSwatches.module.scss";

export function ChartPaletteSwatches() {
  const { theme } = useTheme();
  const statMeta = getStatMeta({ theme });

  return (
    <div className={styles.root}>
      {statMeta.map((meta) => (
        <div key={meta.key} className={styles.chip}>
          <span className={styles.dot} style={{ backgroundColor: meta.color }} />
          <span className={styles.label}>{meta.label}</span>
        </div>
      ))}
    </div>
  );
}
