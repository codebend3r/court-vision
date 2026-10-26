import styles from "@/components/ListTooltip/ListTooltip.module.scss";

export type ListTooltipEntry = {
  key: string;
  name: string;
  color?: string;
  // Already formatted, dash included for a missing value.
  value: string;
};

// The hover card the many-line trend charts share (standings, watchlist): a
// muted title over a swatch · name · value list, with an optional "+N more"
// line when the chart trims the list.
type ListTooltipProps = {
  title: string;
  entries: readonly ListTooltipEntry[];
  more?: number;
};

export function ListTooltip({ title, entries, more = 0 }: ListTooltipProps) {
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{title}</p>
      <ul className={styles.tooltipList}>
        {entries.map((entry) => (
          <li key={entry.key} className={styles.tooltipRow}>
            <span
              aria-hidden="true"
              className={styles.swatch}
              style={{ background: entry.color }}
            />
            <span>{entry.name}</span>
            <span className={styles.tooltipValue}>{entry.value}</span>
          </li>
        ))}
        {!!more && <li className={styles.tooltipMore}>+{more} more</li>}
      </ul>
    </div>
  );
}
