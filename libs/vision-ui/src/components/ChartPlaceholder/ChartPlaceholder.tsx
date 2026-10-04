import styles from "#ui/components/ChartPlaceholder/ChartPlaceholder.module.scss";

// Fills a deferred chart's plot box while its client-only chunk loads. It
// takes the size of whatever container it sits in, so the container (not
// the placeholder) owns the box and the plot that replaces it lands without
// moving anything. It is decorative: the figure around it keeps the chart's
// name, legend, and summary, server-rendered, for assistive tech.
export function ChartPlaceholder() {
  return <div className={styles.placeholder} aria-hidden="true" data-chart-placeholder />;
}
