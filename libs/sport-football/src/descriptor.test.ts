import { describe, expect, it } from "bun:test";

import { describeSportIssues } from "@vision/core/sport/validate";

import { football, parseFootballPosition } from "#football/descriptor";

describe("football descriptor", () => {
  it("is internally consistent", () => {
    expect(describeSportIssues({ sport: football })).toEqual([]);
  });

  it("is points-only, valued over replacement", () => {
    expect(football.categoryOrder).toEqual([]);
    expect(football.methods).toEqual(["points", "vorp", "positional"]);
    expect(football.replacementBase).toBe("points");
  });

  it("parses positions", () => {
    expect(parseFootballPosition("RB")).toEqual(["RB"]);
    expect(parseFootballPosition("WR/RB")).toEqual(["WR", "RB"]);
    expect(parseFootballPosition("FB")).toEqual([]);
  });
});
