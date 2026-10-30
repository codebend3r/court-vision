import { describe, expect, it } from "bun:test";

import {
  fittedDomain,
  gamesForSpan,
  isTrendSpan,
  toggleMethod,
  visibleMethods,
} from "@/lib/charts/trendMethods";

describe("visibleMethods", () => {
  it("shows every method by default, in registry order", () => {
    expect(visibleMethods({ hidden: [] })).toEqual([
      "z",
      "g",
      "points",
      "vorp",
      "positional",
      "sgp",
      "sim",
    ]);
  });

  it("drops the hidden ones", () => {
    expect(visibleMethods({ hidden: ["g", "sim"] })).toEqual([
      "z",
      "points",
      "vorp",
      "positional",
      "sgp",
    ]);
  });

  it("never shows nothing, even from a hand-edited URL hiding all seven", () => {
    expect(
      visibleMethods({ hidden: ["z", "g", "points", "vorp", "positional", "sgp", "sim"] }),
    ).toHaveLength(7);
  });
});

describe("toggleMethod", () => {
  it("hides a visible method and shows a hidden one", () => {
    expect(toggleMethod({ hidden: [], key: "sgp" })).toEqual(["sgp"]);
    expect(toggleMethod({ hidden: ["z", "sgp"], key: "sgp" })).toEqual(["z"]);
  });

  it("keeps the hidden set in registry order", () => {
    expect(toggleMethod({ hidden: ["sim"], key: "z" })).toEqual(["z", "sim"]);
  });

  it("refuses to hide the last visible chart", () => {
    const allButZ = ["g", "points", "vorp", "positional", "sgp", "sim"] as const;
    expect(toggleMethod({ hidden: allButZ, key: "z" })).toEqual([...allButZ]);
  });
});

describe("isTrendSpan and gamesForSpan", () => {
  it("accepts the five spans and turns them into game counts", () => {
    expect(isTrendSpan("season")).toBe(true);
    expect(isTrendSpan("15")).toBe(false);
    expect(gamesForSpan({ span: "40" })).toBe(40);
    expect(gamesForSpan({ span: "season" })).toBeNull();
  });
});

describe("fittedDomain", () => {
  it("hugs the drawn values with a tenth of their range as padding", () => {
    const [low, high] = fittedDomain({ values: [2, 4, null, 3] });
    expect(low).toBeCloseTo(1.8);
    expect(high).toBeCloseTo(4.2);
  });

  it("does not stretch to zero for a series far from it", () => {
    const [low] = fittedDomain({ values: [30, 32] });
    expect(low).toBeGreaterThan(25);
  });

  it("gives a flat series some headroom and an empty one a unit scale", () => {
    const [low, high] = fittedDomain({ values: [0, 0] });
    expect(high - low).toBeCloseTo(0.2);
    expect(fittedDomain({ values: [] })).toEqual([-1, 1]);
  });
});
