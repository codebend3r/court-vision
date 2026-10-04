import { describe, expect, it } from "bun:test";

import {
  isFantasyTeamPlayer,
  isRosterSlotType,
  parseLegacyTeamsPayload,
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

describe("parseLegacyTeamsPayload", () => {
  const legacyTeam = ({ id, name }: { id: string; name: string }) => ({
    id,
    name,
    createdAt: "2026-07-23T00:00:00.000Z",
    slots: [
      { id: "PG-1", type: "PG", player },
      { id: "UTIL-1", type: "UTIL", player: null },
    ],
  });

  it("round-trips a real persisted zustand payload", () => {
    const payload = {
      state: { teams: [legacyTeam({ id: "team-1", name: "Bench Mob" })] },
      version: 0,
    };
    expect(parseLegacyTeamsPayload(payload)).toEqual([
      {
        id: "team-1",
        name: "Bench Mob",
        // No DB row exists for a legacy team yet, so there's no real slug to
        // carry over — importLegacyTeams resolves one server-side.
        slug: "",
        createdAt: "2026-07-23T00:00:00.000Z",
        slots: [
          { id: "PG-1", type: "PG", player },
          { id: "UTIL-1", type: "UTIL", player: null },
        ],
      },
    ]);
  });

  it("rebuilds a fresh array rather than returning the input object as-is", () => {
    const payload = {
      state: { teams: [legacyTeam({ id: "team-1", name: "Bench Mob" })] },
      version: 0,
    };
    const parsed = parseLegacyTeamsPayload(payload);
    expect(parsed).not.toBe(payload.state.teams);
    expect(parsed?.[0]).not.toBe(payload.state.teams[0]);
  });

  it("returns null for null, an empty object, and a non-array teams field", () => {
    expect(parseLegacyTeamsPayload(null)).toBeNull();
    expect(parseLegacyTeamsPayload({})).toBeNull();
    expect(parseLegacyTeamsPayload({ state: { teams: "no" } })).toBeNull();
  });

  it("returns null when a team's slot has an unknown type", () => {
    const payload = {
      state: {
        teams: [
          {
            id: "team-1",
            name: "Bench Mob",
            createdAt: "2026-07-23T00:00:00.000Z",
            slots: [{ id: "COACH-1", type: "COACH", player: null }],
          },
        ],
      },
      version: 0,
    };
    expect(parseLegacyTeamsPayload(payload)).toBeNull();
  });

  it("returns null (not a partial list) when any team in the list is malformed", () => {
    const payload = {
      state: {
        teams: [
          legacyTeam({ id: "team-1", name: "Bench Mob" }),
          { id: "team-2", name: "Second Unit" /* missing createdAt/slots */ },
        ],
      },
      version: 0,
    };
    expect(parseLegacyTeamsPayload(payload)).toBeNull();
  });
});
