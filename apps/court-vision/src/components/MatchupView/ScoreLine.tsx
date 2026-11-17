import styles from "@/components/MatchupView/MatchupView.module.scss";

const DIVIDER = (
  <span className={styles.scoreDivider} aria-hidden="true">
    -
  </span>
);

// A won-lost-tied tally as large readout numbers. The dividers are decorative;
// `label` spells the tally out for assistive tech.
type ScoreLineProps = { label: string; won: number; lost: number; tied: number };

export function ScoreLine({ label, won, lost, tied }: ScoreLineProps) {
  return (
    <p className={styles.score} aria-label={label}>
      <span className={styles.scoreNumber}>{won}</span>
      {DIVIDER}
      <span className={styles.scoreNumber}>{lost}</span>
      {DIVIDER}
      <span className={styles.scoreNumber}>{tied}</span>
    </p>
  );
}
