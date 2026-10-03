import { describe, expect, it } from "bun:test";

import { isMetricPoint } from "#core/series/metricPoint";

const point = {
  gameIndex: 3,
  gameDate: "2025-10-24T00:00:00.000Z",
  matchup: "LAL @ GSW",
  winLoss: "W",
  dnp: false,
};

describe("isMetricPoint", () => {
  it("accepts a point with the shared per-game fields", () => {
    expect(isMetricPoint(point)).toBe(true);
    expect(isMetricPoint({ ...point, winLoss: null, pts: 12 })).toBe(true);
  });

  it("rejects non-objects and points missing a shared field", () => {
    expect(isMetricPoint(null)).toBe(false);
    expect(isMetricPoint("game 3")).toBe(false);
    expect(isMetricPoint({ ...point, gameIndex: "3" })).toBe(false);
    expect(isMetricPoint({ ...point, gameDate: 3 })).toBe(false);
    expect(isMetricPoint({ ...point, matchup: undefined })).toBe(false);
    expect(isMetricPoint({ ...point, dnp: "no" })).toBe(false);
    expect(isMetricPoint({ ...point, winLoss: 1 })).toBe(false);
  });
});
