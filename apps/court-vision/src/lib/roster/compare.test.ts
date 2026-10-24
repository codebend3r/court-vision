import { describe, expect, it } from "bun:test";

import {
  baselineFor,
  buildBars,
  percentileOf,
  qualifyingGames,
  tierOf,
  type StatSpec,
} from "@/lib/roster/compare";

type Row = { id: number; lastName: string; fullName: string; value: number | null };

const row = ({ id, name, value }: { id: number; name: string; value: number | null }): Row => ({
  id,
  lastName: name,
  fullName: `A ${name}`,
  value,
});

const spec = (direction: StatSpec<Row>["direction"]): StatSpec<Row> => ({
  key: "x",
  label: "X",
  fullName: "X",
  direction,
  valueOf: (entry) => entry.value,
  format: (value) => value.toFixed(1),
});

describe("percentileOf", () => {
  it("is the share of the baseline below the value", () => {
    expect(percentileOf({ value: 3, baseline: [1, 2, 4, 5] })).toBe(50);
  });

  it("counts ties as half", () => {
    expect(percentileOf({ value: 2, baseline: [2, 2] })).toBe(50);
  });

  it("reads the top of the baseline as 100 and the bottom as 0", () => {
    expect(percentileOf({ value: 9, baseline: [1, 2, 3] })).toBe(100);
    expect(percentileOf({ value: 0, baseline: [1, 2, 3] })).toBe(0);
  });

  it("has no opinion without a baseline", () => {
    expect(percentileOf({ value: 5, baseline: [] })).toBe(50);
  });
});

describe("tierOf", () => {
  it("splits the percentiles into thirds", () => {
    expect(tierOf({ percentile: 90, direction: "high" })).toBe("strong");
    expect(tierOf({ percentile: 50, direction: "high" })).toBe("average");
    expect(tierOf({ percentile: 10, direction: "high" })).toBe("weak");
  });

  it("flips for a stat where less is better", () => {
    expect(tierOf({ percentile: 10, direction: "low" })).toBe("strong");
    expect(tierOf({ percentile: 90, direction: "low" })).toBe("weak");
  });

  it("never judges a neutral stat", () => {
    expect(tierOf({ percentile: 99, direction: "neutral" })).toBe("neutral");
  });
});

describe("qualifyingGames", () => {
  it("is half the median games played", () => {
    expect(qualifyingGames({ games: [10, 20, 30] })).toBe(10);
  });

  it("averages the middle pair of an even count", () => {
    expect(qualifyingGames({ games: [10, 20, 30, 40] })).toBe(12);
  });

  it("never drops below one game", () => {
    expect(qualifyingGames({ games: [] })).toBe(1);
    expect(qualifyingGames({ games: [1, 1, 1] })).toBe(1);
  });
});

describe("baselineFor", () => {
  it("reads the qualifying players that have a value", () => {
    const pool = [
      row({ id: 1, name: "A", value: 10 }),
      row({ id: 2, name: "B", value: null }),
      row({ id: 3, name: "C", value: 30 }),
      row({ id: 4, name: "D", value: 99 }),
    ];
    expect(baselineFor({ pool, spec: spec("high"), qualifies: (entry) => entry.id !== 4 })).toEqual(
      [10, 30],
    );
  });
});

describe("buildBars", () => {
  const rows = [
    row({ id: 1, name: "Mid", value: 5 }),
    row({ id: 2, name: "Top", value: 9 }),
    row({ id: 3, name: "Low", value: 1 }),
    row({ id: 4, name: "None", value: null }),
  ];
  const baseline = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  it("orders best first and drops players without a value", () => {
    expect(buildBars({ rows, spec: spec("high"), baseline }).map((bar) => bar.name)).toEqual([
      "Top",
      "Mid",
      "Low",
    ]);
  });

  it("orders a lower-is-better stat lowest first", () => {
    expect(buildBars({ rows, spec: spec("low"), baseline }).map((bar) => bar.name)).toEqual([
      "Low",
      "Mid",
      "Top",
    ]);
  });

  it("tiers each bar against the baseline and formats its label", () => {
    const bars = buildBars({ rows, spec: spec("high"), baseline });
    expect(bars.map((bar) => bar.tier)).toEqual(["strong", "average", "weak"]);
    expect(bars[0]?.label).toBe("9.0");
  });

  it("breaks ties by name", () => {
    const tied = [row({ id: 1, name: "Zed", value: 5 }), row({ id: 2, name: "Abe", value: 5 })];
    expect(buildBars({ rows: tied, spec: spec("high"), baseline }).map((bar) => bar.id)).toEqual([
      2, 1,
    ]);
  });
});
