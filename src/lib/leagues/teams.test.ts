import { describe, expect, it } from "bun:test";

import {
  isFantasyTeamPlayer,
  isRosterSlotType,
  rowsToSlots,
  slotsToRows,
} from "@/lib/leagues/teams";
import { type RosterSlot } from "@/lib/fantasyTeams/types";

const player = {
  playerId: 7,
  firstName: "Kevin",
  lastName: "Durant",
  fullName: "Kevin Durant",
  teamAbbr: "HOU",
  position: "F",
  nbaPersonId: 201142,
};

describe("isRosterSlotType", () => {
  it("accepts every SLOT_META type and rejects junk", () => {
    expect(isRosterSlotType("PG")).toBe(true);
    expect(isRosterSlotType("ILPLUS")).toBe(true);
    expect(isRosterSlotType("COACH")).toBe(false);
  });
});

describe("isFantasyTeamPlayer", () => {
  it("accepts a well-shaped player", () => {
    expect(isFantasyTeamPlayer(player)).toBe(true);
  });

  it("accepts nullable fields set to null", () => {
    expect(
      isFantasyTeamPlayer({ ...player, teamAbbr: null, position: null, nbaPersonId: null }),
    ).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(isFantasyTeamPlayer(null)).toBe(false);
    expect(isFantasyTeamPlayer("player")).toBe(false);
    expect(isFantasyTeamPlayer(undefined)).toBe(false);
  });

  it("rejects a value with a wrong-typed field", () => {
    expect(isFantasyTeamPlayer({ ...player, playerId: "7" })).toBe(false);
  });

  it("rejects a value missing a required field", () => {
    const { playerId, firstName, lastName, teamAbbr, position, nbaPersonId } = player;
    expect(
      isFantasyTeamPlayer({ playerId, firstName, lastName, teamAbbr, position, nbaPersonId }),
    ).toBe(false);
  });
});

describe("slot row mapping", () => {
  const slots: RosterSlot[] = [
    { id: "PG-1", type: "PG", player },
    { id: "UTIL-1", type: "UTIL", player: null },
    { id: "UTIL-2", type: "UTIL", player: null },
  ];

  it("slotsToRows keeps order via position and nulls empty slots", () => {
    expect(slotsToRows({ slots })).toEqual([
      { slotType: "PG", position: 0, playerId: 7 },
      { slotType: "UTIL", position: 1, playerId: null },
      { slotType: "UTIL", position: 2, playerId: null },
    ]);
  });

  it("rowsToSlots regenerates per-type slot ids in position order", () => {
    const rows = [
      { slotType: "PG", player },
      { slotType: "UTIL", player: null },
      { slotType: "UTIL", player: null },
    ];
    expect(rowsToSlots({ rows })).toEqual(slots);
  });

  it("rowsToSlots drops rows with unknown slot types", () => {
    expect(rowsToSlots({ rows: [{ slotType: "COACH", player: null }] })).toEqual([]);
  });
});
