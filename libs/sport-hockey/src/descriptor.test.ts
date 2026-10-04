import { describe, expect, it } from "bun:test";

import { describeSportIssues } from "@vision/core/sport/validate";

import { hockey, parseHockeyPosition } from "#hockey/descriptor";

describe("hockey descriptor", () => {
  it("is internally consistent", () => {
    expect(describeSportIssues({ sport: hockey })).toEqual([]);
  });

  it("names a season across the two years it spans", () => {
    expect(hockey.season.label({ startYear: 2025 })).toBe("2025-26");
  });

  it("parses slash- and comma-separated skater eligibility", () => {
    expect(parseHockeyPosition("C/LW")).toEqual(["C", "LW"]);
    expect(parseHockeyPosition("lw, rw")).toEqual(["LW", "RW"]);
    expect(parseHockeyPosition("G")).toEqual(["G"]);
    expect(parseHockeyPosition("F")).toEqual([]);
  });
});
