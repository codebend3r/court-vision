import { type ReactNode } from "react";

import styles from "#ui/components/ReadoutCard/ReadoutCard.module.scss";

export type ReadoutSentiment = "up" | "down" | "neutral";

// A dashboard readout (spec §10): uppercase label, a big extruded figure —
// one of the two roles allowed to carry the retro extrusion — and a mono
// note colored by sentiment.
type ReadoutCardProps = {
  label: string;
  value: ReactNode;
  note?: string;
  sentiment?: ReadoutSentiment;
};

export function ReadoutCard({ label, value, note, sentiment = "neutral" }: ReadoutCardProps) {
  return (
    <article className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {!!note && (
        <p className={styles.note} data-sentiment={sentiment}>
          {note}
        </p>
      )}
    </article>
  );
}

// The row the cards sit in: `repeat(auto-fit, minmax(180px, 1fr))`.
type ReadoutRowProps = { children: ReactNode };

export function ReadoutRow({ children }: ReadoutRowProps) {
  return <div className={styles.row}>{children}</div>;
}
