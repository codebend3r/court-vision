import { describe, expect, it } from "bun:test";

import { isFree, isOnAnotherTeam } from "@/lib/advisor/owner";

const TEAM = { kind: "team", teamId: "t2", teamName: "Two", managerName: null } as const;

describe("isOnAnotherTeam", () => {
  it("is true only for a player on another team", () => {
    expect(isOnAnotherTeam(TEAM)).toBe(true);
    expect(isOnAnotherTeam({ kind: "mine" })).toBe(false);
    expect(isOnAnotherTeam({ kind: "free_agent" })).toBe(false);
    expect(isOnAnotherTeam({ kind: "waivers" })).toBe(false);
  });
});

describe("isFree", () => {
  it("is true for free agents and waiver players", () => {
    expect(isFree({ kind: "free_agent" })).toBe(true);
    expect(isFree({ kind: "waivers" })).toBe(true);
    expect(isFree({ kind: "mine" })).toBe(false);
    expect(isFree(TEAM)).toBe(false);
  });
});
