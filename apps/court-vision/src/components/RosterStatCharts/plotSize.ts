export const ROW_HEIGHT = 26;
export const CHART_PADDING = 8;

// The plot's box, known before the chart loads, so the placeholder holds the
// exact room the chart then fills and nothing moves when it arrives.
export const plotHeight = ({ count }: { count: number }): number =>
  count * ROW_HEIGHT + CHART_PADDING * 2;
