import { describe, expect, it } from "bun:test";

import { getChartChrome, getSeriesPalette } from "#ui/charts/palette";
import { THEMES } from "#ui/theme/themes";

describe("getChartChrome", () => {
  it("returns the dark chrome palette", () => {
    expect(getChartChrome({ theme: "dark" })).toEqual({
      grid: "#2a3050",
      axis: "#8b93b5",
      endLabel: "#8b93b5",
    });
  });

  it("returns the light chrome palette", () => {
    expect(getChartChrome({ theme: "light" })).toEqual({
      grid: "#dfe3f0",
      axis: "#5a6280",
      endLabel: "#5a6280",
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
