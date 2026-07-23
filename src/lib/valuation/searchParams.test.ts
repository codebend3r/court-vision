import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import {
  FANTASY_SORT_KEYS,
  fantasyParsers,
  parseWeights,
  serializeWeights,
  snapWeight,
} from "@/lib/valuation/searchParams";

describe("snapWeight", () => {
  it("clamps to [0, 2]", () => {
    expect(snapWeight(-1)).toBe(0);
    expect(snapWeight(5)).toBe(2);
  });

  it("snaps to 0.25 steps", () => {
    expect(snapWeight(0.6)).toBe(0.5);
    expect(snapWeight(0.63)).toBe(0.75);
    expect(snapWeight(1.1)).toBe(1);
  });

  it("treats NaN as the default weight", () => {
    expect(snapWeight(Number.NaN)).toBe(1);
  });
});

describe("weights codec", () => {
  it("round-trips punt and fractional weights", () => {
    const parsed = parseWeights("ft:0,tov:0.5");
    expect(parsed).toEqual({ ft: 0, tov: 0.5 });
    expect(serializeWeights(parsed ?? {})).toBe("tov:0.5,ft:0");
  });

  it("omits default weights of 1 from both directions", () => {
    expect(parseWeights("pts:1,ft:0")).toEqual({ ft: 0 });
    expect(serializeWeights({ pts: 1, ft: 0 })).toBe("ft:0");
  });

  it("rejects malformed entries so nuqs falls back to the default", () => {
    expect(parseWeights("ft:x")).toBeNull();
    expect(parseWeights("nope:1")).toBeNull();
    expect(parseWeights("ft")).toBeNull();
    expect(parseWeights("ft:0:1")).toBeNull();
  });

  it("snaps out-of-range weights instead of erroring", () => {
    expect(parseWeights("pts:9")).toEqual({ pts: 2 });
    expect(parseWeights("pts:0.6")).toEqual({ pts: 0.5 });
  });
});

describe("fantasyParsers", () => {
  const serialize = createSerializer(fantasyParsers);

  it("serializes defaults to an empty query string", () => {
    expect(
      serialize({
        q: "",
        page: 1,
        size: 50,
        sort: "z",
        dir: "desc",
        x: [],
        w: {},
        teams: 12,
        slots: 13,
        range: "all",
        mode: "average",
      }),
    ).toBe("");
  });

  it("serializes non-default state compactly", () => {
    const query = serialize({ w: { ft: 0 }, teams: 10, range: "last10" });
    expect(query).toContain("w=ft:0");
    expect(query).toContain("teams=10");
    expect(query).toContain("range=last10");
  });

  it("clamps teams and slots", () => {
    expect(fantasyParsers.teams.parse("99")).toBe(30);
    expect(fantasyParsers.teams.parse("0")).toBe(2);
    expect(fantasyParsers.slots.parse("40")).toBe(25);
    expect(fantasyParsers.slots.parse("junk")).toBeNull();
  });

  it("accepts one sort key per method column plus name sorts", () => {
    expect(FANTASY_SORT_KEYS).toEqual(["z", "g", "points", "vorp", "pos", "firstName", "lastName"]);
    expect(fantasyParsers.sort.parse("g")).toBe("g");
    expect(fantasyParsers.sort.parse("value")).toBeNull();
    expect(fantasyParsers.sort.parse("sgp")).toBeNull();
  });

  it("accepts only category keys for exclusions, dropping unknown entries", () => {
    expect(fantasyParsers.x.parse("ft,tov")).toEqual(["ft", "tov"]);
    expect(fantasyParsers.x.parse("ft,nope")).toEqual(["ft"]);
    expect(fantasyParsers.x.parse("nope")).toEqual([]);
  });
});
