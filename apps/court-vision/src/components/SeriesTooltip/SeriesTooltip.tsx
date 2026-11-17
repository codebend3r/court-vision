import { type ReactNode } from "react";
import { type TooltipPayload } from "recharts";

import styles from "@/components/SeriesTooltip/SeriesTooltip.module.scss";

// What recharts injects when it clones a `content` tooltip. Never supplied at
// JSX-authoring time, so both stay optional on every tooltip's prop type.
export type InjectedTooltipProps = { active?: boolean; payload?: TooltipPayload };

// The hovered point's own data row, or null while nothing is hovered. It is
// untyped: each tooltip narrows it to its chart's row shape.
export const hoveredRow = ({ active, payload }: InjectedTooltipProps): unknown =>
  active ? (payload?.[0]?.payload ?? null) : null;

// The footnote a hovered zero-minute game carries.
export const DNP_STATUS = "DNP / DNP-CD (0 MIN)";

// `gameDate` is stored as a UTC-midnight ISO string. Formatting it in the
// viewer's local timezone can shift the displayed date back a day for any
// timezone west of UTC, so the date is always rendered in UTC.
export const formatGameDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString(undefined, { timeZone: "UTC" });

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
