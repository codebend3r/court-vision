import { describe, expect, it } from "bun:test";

import { describeSportIssues } from "@vision/core/sport/validate";

import { baseball, parseBaseballPosition } from "#baseball/descriptor";

describe("baseball descriptor", () => {
  it("is internally consistent", () => {
    expect(describeSportIssues({ sport: baseball })).toEqual([]);
  });

  it("names a season by its year", () => {
    expect(baseball.season.label({ startYear: 2025 })).toBe("2025");
  });

  it("parses multi-position eligibility", () => {
    expect(parseBaseballPosition("SS/2B")).toEqual(["SS", "2B"]);
    expect(parseBaseballPosition("SP,RP")).toEqual(["SP", "RP"]);
    expect(parseBaseballPosition("LF")).toEqual([]);
  });
});
