import styles from "@/components/SeriesChart/SeriesChart.module.scss";

export type SeriesLegendEntry = { key: string; label: string; color: string };

// The swatch key over a set of charts that share series colours: one square
// per series beside its name. The swatch carries identity; the label keeps
// its own ink.
type SeriesLegendProps = { entries: readonly SeriesLegendEntry[] };

export function SeriesLegend({ entries }: SeriesLegendProps) {
  return (
    <ul className={styles.legend} aria-label="Series">
      {entries.map((entry) => (
        <li key={entry.key} className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
