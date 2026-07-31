import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "bun:test";

import {
  FANTASY_SORT_KEYS,
  fantasyParsers,
  isWeightedMethodKey,
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
  it("round-trips method-scoped punt and fractional weights", () => {
    const parsed = parseWeights("z.ft:0,g.tov:0.5");
    expect(parsed).toEqual({ z: { ft: 0 }, g: { tov: 0.5 } });
    expect(serializeWeights(parsed ?? {})).toBe("z.ft:0,g.tov:0.5");
  });

  it("keeps each column's weights independent", () => {
    expect(parseWeights("z.ast:2,g.ast:0.5")).toEqual({ z: { ast: 2 }, g: { ast: 0.5 } });
  });

  it("omits default weights of 1 from both directions", () => {
    expect(parseWeights("z.pts:1,z.ft:0")).toEqual({ z: { ft: 0 } });
    expect(serializeWeights({ z: { pts: 1, ft: 0 } })).toBe("z.ft:0");
  });

  it("rejects malformed entries so nuqs falls back to the default", () => {
    expect(parseWeights("z.ft:x")).toBeNull();
    expect(parseWeights("z.nope:1")).toBeNull();
    expect(parseWeights("nope.ft:1")).toBeNull();
    expect(parseWeights("ft:0")).toBeNull(); // unscoped, the pre-per-column format
    expect(parseWeights("z.ft")).toBeNull();
    expect(parseWeights("z.ft:0:1")).toBeNull();
  });

  it("snaps out-of-range weights instead of erroring", () => {
    expect(parseWeights("z.pts:9")).toEqual({ z: { pts: 2 } });
    expect(parseWeights("z.pts:0.6")).toEqual({ z: { pts: 0.5 } });
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
    const query = serialize({ w: { z: { ft: 0 } }, teams: 10, range: "last10" });
    expect(query).toContain("w=z.ft:0");
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
    expect(FANTASY_SORT_KEYS).toEqual([
      "z",
      "g",
      "points",
      "vorp",
      "pos",
      "sgp",
      "sim",
      "firstName",
      "lastName",
    ]);
    expect(fantasyParsers.sort.parse("g")).toBe("g");
    expect(fantasyParsers.sort.parse("value")).toBeNull();
    // SGP and Sim Value are sortable columns now, not blocked placeholders.
    expect(fantasyParsers.sort.parse("sgp")).toBe("sgp");
    expect(fantasyParsers.sort.parse("sim")).toBe("sim");
  });

  it("accepts only category keys for exclusions, dropping unknown entries", () => {
    expect(fantasyParsers.x.parse("ft,tov")).toEqual(["ft", "tov"]);
    expect(fantasyParsers.x.parse("ft,nope")).toEqual(["ft"]);
    expect(fantasyParsers.x.parse("nope")).toEqual([]);
  });
});
