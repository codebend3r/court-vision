import { describe, expect, it } from "bun:test";

import { FANTASY_METHODS } from "#core/testing/basketball";
import {
  isWeightedMethodKey,
  METHOD_KEY_BY_WEIGHTED,
  methodNeedsCategories,
  SORT_KEY_BY_METHOD,
  VALUE_KEY_BY_SORT,
} from "#core/valuation/registry";

describe("FANTASY_METHODS", () => {
  it("registers Z-Score with complete metadata", () => {
    const zscore = FANTASY_METHODS.find((method) => method.key === "zscore");
    expect(zscore?.label).not.toBe("");
    expect(zscore?.fullName).not.toBe("");
    expect(zscore?.description).not.toBe("");
    expect(zscore?.formula).not.toBe("");
  });

  it("gives every method a plain-language reason it matters", () => {
    // The tooltips and the legend both render this; a blank one would leave a
    // labelled empty section rather than degrade quietly.
    FANTASY_METHODS.forEach((method) => {
      expect(method.whyItMatters.length).toBeGreaterThan(40);
    });
  });
});

// URLs and stored league preferences hold these keys, so they must never move.
describe("the registry's derived lookups", () => {
  it("maps each method to the sort key its column answers to", () => {
    expect(SORT_KEY_BY_METHOD).toEqual({
      zscore: "z",
      gscore: "g",
      points: "points",
      vorp: "vorp",
      positional: "pos",
      sgp: "sgp",
      simvalue: "sim",
    });
  });

  it("maps each weighted sort key back to its method", () => {
    expect(METHOD_KEY_BY_WEIGHTED).toEqual({
      z: "zscore",
      g: "gscore",
      vorp: "vorp",
      pos: "positional",
      sgp: "sgp",
      sim: "simvalue",
    });
  });

  it("reads each method's score from its own value field", () => {
    expect(FANTASY_METHODS.map((method) => [method.key, method.valueKey])).toEqual([
      ["zscore", "z"],
      ["gscore", "g"],
      ["points", "points"],
      ["vorp", "vorp"],
      ["positional", "positional"],
      ["sgp", "sgp"],
      ["simvalue", "sim"],
    ]);
  });

  it("maps each sort key to the value field its column ranks by", () => {
    expect(VALUE_KEY_BY_SORT).toEqual({
      z: "z",
      g: "g",
      points: "points",
      vorp: "vorp",
      pos: "positional",
      sgp: "sgp",
      sim: "sim",
    });
  });

  it("signs every method's score but PL Linear's points total", () => {
    expect(FANTASY_METHODS.filter((method) => !method.signed).map((method) => method.key)).toEqual([
      "points",
    ]);
  });

  it("knows which methods need categories", () => {
    expect(methodNeedsCategories({ key: "zscore" })).toBe(true);
    expect(methodNeedsCategories({ key: "simvalue" })).toBe(true);
    expect(methodNeedsCategories({ key: "points" })).toBe(false);
    expect(methodNeedsCategories({ key: "positional" })).toBe(false);
  });
});

describe("isWeightedMethodKey", () => {
  it("accepts exactly the six weighted column keys", () => {
    ["z", "g", "vorp", "pos", "sgp", "sim"].forEach((key) => {
      expect(isWeightedMethodKey(key)).toBe(true);
    });
  });

  it("rejects the unweighted sorts and unknowns", () => {
    expect(isWeightedMethodKey("points")).toBe(false);
    expect(isWeightedMethodKey("firstName")).toBe(false);
    expect(isWeightedMethodKey("zscore")).toBe(false);
    expect(isWeightedMethodKey(undefined)).toBe(false);
  });
});
