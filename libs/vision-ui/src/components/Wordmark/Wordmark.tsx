import styles from "#ui/components/Wordmark/Wordmark.module.scss";

// A two-word stacked wordmark for any *-vision app: the sport word in text
// color over "Vision" in the accent, extruded as one, so it re-inks with the
// theme. The space between the words is never laid out (the grid drops
// whitespace text), but it makes the text read as "<Lead> Vision" to assistive
// tech instead of one run-together word.
type WordmarkProps = { lead: string };

export const Wordmark = ({ lead }: WordmarkProps) => (
  <span className={styles.wordmark}>
    <span className={styles.lead}>{lead}</span> <span className={styles.trail}>Vision</span>
  </span>
);
