import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACTIVE_KEYS,
  getChartChrome,
  getStatMeta,
} from "@/components/PlayerStatChart/statMeta";

const DARK_COUNTING_COLORS = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
];
const LIGHT_COUNTING_COLORS = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#e87ba4",
];

describe("getStatMeta", () => {
  it("colors the counting stats and shooting stats (slots 0-2) from the dark palette", () => {
    const meta = getStatMeta({ theme: "dark" });

    const counting = meta.filter((entry) => entry.panel === "counting");
    expect(counting.map((entry) => entry.key)).toEqual([
      "pts",
      "reb",
      "ast",
      "stl",
      "blk",
      "min",
      "tov",
    ]);
    expect(counting.map((entry) => entry.color)).toEqual(DARK_COUNTING_COLORS);

    const shooting = meta.filter((entry) => entry.panel === "shooting");
    expect(shooting.map((entry) => entry.key)).toEqual(["fgPct", "fg3Pct", "ftPct"]);
    expect(shooting.map((entry) => entry.color)).toEqual(DARK_COUNTING_COLORS.slice(0, 3));
  });

  it("colors the counting stats and shooting stats (slots 0-2) from the light palette", () => {
    const meta = getStatMeta({ theme: "light" });

    const counting = meta.filter((entry) => entry.panel === "counting");
    expect(counting.map((entry) => entry.color)).toEqual(LIGHT_COUNTING_COLORS);

    const shooting = meta.filter((entry) => entry.panel === "shooting");
    expect(shooting.map((entry) => entry.color)).toEqual(LIGHT_COUNTING_COLORS.slice(0, 3));
  });

  it("keeps key, label, and panel identical across themes", () => {
    const dark = getStatMeta({ theme: "dark" });
    const light = getStatMeta({ theme: "light" });

    expect(dark.map((entry) => entry.key)).toEqual(light.map((entry) => entry.key));
    expect(dark.map((entry) => entry.label)).toEqual(light.map((entry) => entry.label));
    expect(dark.map((entry) => entry.panel)).toEqual(light.map((entry) => entry.panel));
  });
});

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

describe("DEFAULT_ACTIVE_KEYS", () => {
  it("includes every stat key, theme-independent", () => {
    expect(DEFAULT_ACTIVE_KEYS).toEqual(getStatMeta({ theme: "dark" }).map((entry) => entry.key));
    expect(DEFAULT_ACTIVE_KEYS).toHaveLength(10);
  });
});
