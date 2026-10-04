import { describe, expect, it } from "bun:test";

import { rankByKeys } from "#core/series/ranking";

const TEAMS = [
  { abbr: "AAA", wins: 50, allowed: 100 },
  { abbr: "BBB", wins: 40, allowed: 95 },
  { abbr: "CCC", wins: 50, allowed: 110 },
  { abbr: "DDD", wins: 30, allowed: 95 },
];

const ranks = rankByKeys({
  items: TEAMS,
  keys: ["wins", "allowed"] as const,
  idOf: (team) => team.abbr,
  valueOf: ({ item, key }) => item[key],
  lowerIsBetter: (key) => key === "allowed",
});

describe("rankByKeys", () => {
  it("ranks higher-is-better keys descending, ties sharing the better rank", () => {
    expect(ranks.get("AAA")?.wins).toBe(1);
    expect(ranks.get("CCC")?.wins).toBe(1);
    expect(ranks.get("BBB")?.wins).toBe(3);
    expect(ranks.get("DDD")?.wins).toBe(4);
  });

  it("ranks lower-is-better keys ascending", () => {
    expect(ranks.get("BBB")?.allowed).toBe(1);
    expect(ranks.get("DDD")?.allowed).toBe(1);
    expect(ranks.get("AAA")?.allowed).toBe(3);
    expect(ranks.get("CCC")?.allowed).toBe(4);
  });

  it("gives every item a rank for every key", () => {
    expect([...ranks.keys()]).toEqual(["AAA", "BBB", "CCC", "DDD"]);
    expect(Object.keys(ranks.get("AAA") ?? {})).toEqual(["wins", "allowed"]);
  });
});
