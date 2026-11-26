import { describe, expect, it } from "bun:test";

import {
  CHART_CHROME,
  CHART_CURVE,
  chartAxisProps,
  chartLineProps,
  chartReferenceLineProps,
  CHART_REFERENCE_STROKE,
  getSeriesPalette,
  getTrendPalette,
} from "#ui/charts/palette";
import { THEMES } from "#ui/theme/themes";

describe("CHART_CHROME", () => {
  it("reads the live border and muted-text tokens rather than per-theme literals", () => {
    expect(CHART_CHROME).toEqual({
      grid: "var(--color-border)",
      axis: "var(--color-text-muted)",
    });
  });
});

describe("getSeriesPalette", () => {
  it("gives every theme seven distinct hues", () => {
    THEMES.forEach((theme) => {
      const palette = getSeriesPalette({ theme });
      expect(palette).toHaveLength(7);
      expect(new Set(palette).size).toBe(7);
    });
  });
});

describe("chartAxisProps", () => {
  it("draws muted 12px ticks over the chosen rule colour", () => {
    expect(chartAxisProps({ rule: "grid" })).toEqual({
      stroke: CHART_CHROME.grid,
      tick: { fill: CHART_CHROME.axis, fontSize: 12 },
    });
    expect(chartAxisProps({ rule: "axis" }).stroke).toBe(CHART_CHROME.axis);
  });
});

describe("getTrendPalette", () => {
  it("gives every theme five distinct hues", () => {
    THEMES.forEach((theme) => {
      const palette = getTrendPalette({ theme });
      expect(palette).toHaveLength(5);
      expect(new Set(palette).size).toBe(5);
    });
  });

  it("darkens the light theme's hues for contrast on white", () => {
    expect(getTrendPalette({ theme: "light" })).not.toEqual(getTrendPalette({ theme: "dark" }));
  });
});

describe("chartLineProps", () => {
  it("draws one shared smooth curve with a bold, round-capped stroke", () => {
    const props = chartLineProps({ color: "#3987e5" });
    expect(props.type).toBe(CHART_CURVE);
    expect(CHART_CURVE).toBe("basis");
    expect(props).toMatchObject({
      stroke: "#3987e5",
      strokeWidth: 3,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      dot: false,
    });
  });

  it("sizes the hover dot from the stroke and rings it in the surface colour", () => {
    expect(chartLineProps({ color: "#199e70", width: 4 }).activeDot).toEqual({
      r: 6,
      fill: "#199e70",
      stroke: "var(--color-surface)",
      strokeWidth: 2,
    });
  });
});

describe("chartReferenceLineProps", () => {
  it("draws a thin dotted line in the axis ink on the shared curve", () => {
    expect(CHART_REFERENCE_STROKE).toEqual({
      stroke: CHART_CHROME.axis,
      strokeDasharray: "3 3",
      strokeWidth: 1.5,
    });
    expect(chartReferenceLineProps()).toMatchObject({
      type: CHART_CURVE,
      ...CHART_REFERENCE_STROKE,
    });
  });

  it("has no dots or animation and bridges gaps", () => {
    expect(chartReferenceLineProps()).toMatchObject({
      dot: false,
      activeDot: false,
      isAnimationActive: false,
      connectNulls: true,
    });
  });
});
