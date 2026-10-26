import { type ReactNode } from "react";

import styles from "@/components/SeriesTooltip/SeriesTooltip.module.scss";

export type SeriesTooltipRow = {
  key: string;
  label: string;
  color: string;
  // Already formatted, dash included for a missing value.
  value: string;
};

// The hover card the player-page charts and the Fantasy tab's chart rows
// share: a muted header naming the hovered point, one "Label: value" line per
// series behind a colour dot, and an optional status footnote (a missed game,
// say).
type SeriesTooltipProps = {
  header: ReactNode;
  rows: readonly SeriesTooltipRow[];
  status?: string;
};

export function SeriesTooltip({ header, rows, status }: SeriesTooltipProps) {
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipHeader}>{header}</p>
      {rows.map((row) => (
        <p key={row.key} className={styles.tooltipRow}>
          <span className={styles.dot} style={{ backgroundColor: row.color }} />
          {row.label}: {row.value}
        </p>
      ))}
      {!!status && <p className={styles.tooltipStatus}>{status}</p>}
    </div>
  );
}
