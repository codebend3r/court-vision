import { CHART_REFERENCE_STROKE, chartReferenceLineProps } from "@vision/ui/charts/palette";

// How every trend chart draws the league's average: the shared reference line
// (thin, dotted, axis ink), the same dash the League average switch shows as
// its legend mark, so the line and its switch read as one thing everywhere.

// The row field every chart's league-average line reads.
export const AVERAGE_KEY = "average";

export const AVERAGE_LINE_LABEL = "League average";

// The line's colour, for a tooltip row or legend swatch naming it.
export const AVERAGE_LINE_COLOR = CHART_REFERENCE_STROKE.stroke;

type AverageLineProps = ReturnType<typeof chartReferenceLineProps> & {
  dataKey: typeof AVERAGE_KEY;
  name: string;
};

// Everything a recharts `Line` needs to draw the average: spread it on.
export const averageLineProps = (): AverageLineProps => ({
  ...chartReferenceLineProps(),
  dataKey: AVERAGE_KEY,
  name: AVERAGE_LINE_LABEL,
});
