import { type ReactNode } from "react";

import styles from "@/components/SeriesChart/SeriesChart.module.scss";

// One titled figure in a player chart's panel grid.
type ChartPanelProps = { title: string; children: ReactNode };

export function ChartPanel({ title, children }: ChartPanelProps) {
  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>{title}</h3>
      {children}
    </section>
  );
}
