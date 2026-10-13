import { describe, expect, it } from "bun:test";

import { playerIdentitySchema, playerRowSchema, splitPlayerRow } from "@/lib/players/identity";

const identity = {
  firstName: "Jalen",
  lastName: "Brunson",
  fullName: "Jalen Brunson",
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: 1628973,
};

describe("playerIdentitySchema", () => {
  it("accepts a player with no team, position or headshot id", () => {
    expect(
      playerIdentitySchema.parse({
        ...identity,
        teamAbbr: null,
        position: null,
        nbaPersonId: null,
      }),
    ).toEqual({ ...identity, teamAbbr: null, position: null, nbaPersonId: null });
  });

  it("leaves the id to each query's own key", () => {
    expect(
      playerIdentitySchema.extend({ playerId: playerRowSchema.shape.id }).parse({
        ...identity,
        playerId: 7,
      }),
    ).toMatchObject({ playerId: 7 });
    expect(() => playerRowSchema.parse(identity)).toThrow();
  });
});

describe("splitPlayerRow", () => {
  it("keeps the identity flat and nests every other column under stats", () => {
    expect(splitPlayerRow({ id: 7, ...identity, pts: 30, pie: null })).toEqual({
      id: 7,
      ...identity,
      stats: { pts: 30, pie: null },
    });
  });
});
