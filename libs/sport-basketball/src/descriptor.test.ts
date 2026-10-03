import { describe, expect, it } from "bun:test";

import { describeSportIssues } from "@vision/core/sport/validate";
import { basketballFixture } from "@vision/core/testing/basketballDescriptor";

import { basketball, parseBasketballPosition } from "#basketball/descriptor";

describe("basketball descriptor", () => {
  it("is internally consistent", () => {
    expect(describeSportIssues({ sport: basketball })).toEqual([]);
  });

  it("labels seasons by start year and padded end year", () => {
    expect(basketball.season.label({ startYear: 2025 })).toBe("2025-26");
    expect(basketball.season.label({ startYear: 1999 })).toBe("1999-00");
  });
});

describe("parseBasketballPosition", () => {
  it("parses single and hyphenated Balldontlie positions", () => {
    expect(parseBasketballPosition("G")).toEqual(["G"]);
    expect(parseBasketballPosition("F-C")).toEqual(["F", "C"]);
    expect(parseBasketballPosition("G-F")).toEqual(["G", "F"]);
  });

  it("ignores unknown fragments and null", () => {
    expect(parseBasketballPosition(null)).toEqual([]);
    expect(parseBasketballPosition("")).toEqual([]);
    expect(parseBasketballPosition("PG")).toEqual([]);
  });
});

// @vision/core keeps a copy of this descriptor for its own engine tests (core
// may not depend on a sport lib). If the two drift, core's tests stop
// describing the basketball the app actually ships.
describe("core's basketball fixture", () => {
  const POSITIONS = ["G", "F-C", "c-f", " G-F-C ", "PG", "", null];

  it("matches this descriptor field for field", () => {
    expect(JSON.parse(JSON.stringify(basketballFixture))).toEqual(
      JSON.parse(JSON.stringify(basketball)),
    );
  });

  it("parses positions and labels seasons identically", () => {
    expect(POSITIONS.map((position) => basketballFixture.positions.parse(position))).toEqual(
      POSITIONS.map((position) => basketball.positions.parse(position)),
    );
    expect(basketballFixture.season.label({ startYear: 2009 })).toBe(
      basketball.season.label({ startYear: 2009 }),
    );
  });
});
