import { describe, expect, it } from "bun:test";

import { memberOf, parsePositionGroups } from "#core/sport/positions";

const GROUPS = ["G", "F", "C"] as const;
const parse = parsePositionGroups({ separators: /-/, isGroup: memberOf({ values: GROUPS }) });

describe("parsePositionGroups", () => {
  it("splits, normalizes, and keeps recognized groups in order", () => {
    expect(parse("F-C")).toEqual(["F", "C"]);
    expect(parse(" g-f ")).toEqual(["G", "F"]);
  });

  it("drops unknown fragments and repeats", () => {
    expect(parse("PG")).toEqual([]);
    expect(parse("F-F-C")).toEqual(["F", "C"]);
  });

  it("treats null and empty as no groups", () => {
    expect(parse(null)).toEqual([]);
    expect(parse("")).toEqual([]);
  });

  it("splits on any separator the sport uses", () => {
    const multi = parsePositionGroups({
      separators: /[/,]/,
      isGroup: memberOf({ values: ["SS", "2B", "OF"] as const }),
    });
    expect(multi("SS/2B,OF")).toEqual(["SS", "2B", "OF"]);
  });
});

describe("memberOf", () => {
  it("accepts listed values only", () => {
    const isGroup = memberOf({ values: GROUPS });
    expect(isGroup("G")).toBe(true);
    expect(isGroup("X")).toBe(false);
  });
});
