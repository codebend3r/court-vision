import { CHART_CHROME } from "@vision/ui/charts/palette";

// How every trend chart draws the league's average: a thin dotted line in the
// axis ink, the same dash the League average switch shows as its legend mark,
// so the line and its switch read as one thing on every chart.
type AverageLineStyle = { stroke: string; strokeDasharray: string; strokeWidth: number };

export const AVERAGE_LINE_STYLE: AverageLineStyle = {
  stroke: CHART_CHROME.axis,
  strokeDasharray: "3 3",
  strokeWidth: 1.5,
};

export const AVERAGE_LINE_LABEL = "League average";
