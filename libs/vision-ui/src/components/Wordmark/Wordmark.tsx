import styles from "#ui/components/Wordmark/Wordmark.module.scss";

// A two-word stacked wordmark for any *-vision app: the sport word in text
// color over "Vision" in the accent, extruded as one, so it re-inks with the
// theme.
export const Wordmark = ({ lead }: { lead: string }) => (
  <span className={styles.wordmark}>
    <span className={styles.lead}>{lead}</span>
    <span className={styles.trail}>Vision</span>
  </span>
);
