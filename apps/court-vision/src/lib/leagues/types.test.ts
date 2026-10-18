import { describe, expect, it } from "bun:test";

import { isLeagueProvider, toLeagueProvider } from "@/lib/leagues/types";

describe("isLeagueProvider", () => {
  it("accepts manual and yahoo", () => {
    expect(isLeagueProvider("manual")).toBe(true);
    expect(isLeagueProvider("yahoo")).toBe(true);
  });

  it("rejects an unknown or differently cased provider", () => {
    expect(isLeagueProvider("espn")).toBe(false);
    expect(isLeagueProvider("Yahoo")).toBe(false);
    expect(isLeagueProvider("")).toBe(false);
  });
});

describe("toLeagueProvider", () => {
  it("keeps a known provider", () => {
    expect(toLeagueProvider({ value: "yahoo" })).toBe("yahoo");
  });

  it("reads an unknown stored provider as manual", () => {
    expect(toLeagueProvider({ value: "espn" })).toBe("manual");
  });
});
