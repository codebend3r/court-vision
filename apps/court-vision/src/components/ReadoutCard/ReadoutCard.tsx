import { type ReactNode } from "react";

import styles from "@/components/ReadoutCard/ReadoutCard.module.scss";

export type ReadoutSentiment = "up" | "down" | "neutral";

// A dashboard readout (spec §10): uppercase label, a big extruded figure —
// one of the two roles allowed to carry the retro extrusion — and a mono
// note colored by sentiment.
export function ReadoutCard({
  label,
  value,
  note,
  sentiment = "neutral",
}: {
  label: string;
  value: ReactNode;
  note?: string;
  sentiment?: ReadoutSentiment;
}) {
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
export function ReadoutRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
