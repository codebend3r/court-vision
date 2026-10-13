import { type ReactNode } from "react";

import styles from "@/components/SeriesChart/SeriesChart.module.scss";

// One titled figure in a player chart's panel grid.
export function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>{title}</h3>
      {children}
    </section>
  );
}
