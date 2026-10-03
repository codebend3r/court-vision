import styles from "#ui/components/Wordmark/Wordmark.module.scss";

// A two-word stacked wordmark for any *-vision app: the sport word in text
// color over "Vision" in the accent, both extruded, so it re-inks with the
// theme. `hero` is the large, centered lockup for a landing page title.
export const Wordmark = ({
  lead,
  trail = "Vision",
  size = "compact",
}: {
  lead: string;
  trail?: string;
  size?: "compact" | "hero";
}) => (
  <span className={size === "hero" ? styles.hero : styles.compact}>
    <span className={styles.lead}>{lead}</span>
    <span className={styles.trail}>{trail}</span>
  </span>
);
