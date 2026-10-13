import { describe, expect, it } from "bun:test";

import {
  CHART_CHROME,
  chartAxisProps,
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
