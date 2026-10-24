import { describe, expect, it } from "bun:test";

import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";
import { matchRosterRows, rosterMembers, unmatchedNames } from "@/lib/roster/members";

const player = ({ playerId }: { playerId: number }): FantasyTeamPlayer => ({
  playerId,
  firstName: "A",
  lastName: "B",
  fullName: "A B",
  teamAbbr: null,
  position: null,
  nbaPersonId: null,
});

const team = (overrides: Partial<FantasyTeam> = {}): FantasyTeam => ({
  id: "t",
  name: "T",
  slug: "t",
  createdAt: "2026-10-01T00:00:00.000Z",
  logoUrl: null,
  managerName: null,
  isMine: true,
  isImported: true,
  unmatchedBySlotId: {},
  slots: [
    { id: "PG-1", type: "PG", player: player({ playerId: 10 }) },
    { id: "SG-1", type: "SG", player: null },
    { id: "IL-1", type: "IL", player: player({ playerId: 30 }) },
  ],
  ...overrides,
});

describe("rosterMembers", () => {
  it("lists the filled slots in order, each with its slot label", () => {
    expect(rosterMembers({ team: team() })).toEqual([
      { playerId: 10, slotLabel: "PG" },
      { playerId: 30, slotLabel: "IL" },
    ]);
  });

  it("is empty for a team with no players", () => {
    expect(rosterMembers({ team: team({ slots: [] }) })).toEqual([]);
  });
});

describe("unmatchedNames", () => {
  it("lists the Yahoo names that matched no player", () => {
    expect(
      unmatchedNames({ team: team({ unmatchedBySlotId: { "SG-1": "Jalen Smith" } }) }),
    ).toEqual(["Jalen Smith"]);
  });
});

describe("matchRosterRows", () => {
  it("pairs members with their pool rows and reports the rest missing", () => {
    const members = rosterMembers({ team: team() });
    const { matched, missing } = matchRosterRows({ members, pool: [{ id: 10 }, { id: 99 }] });
    expect(matched).toEqual([{ slotLabel: "PG", row: { id: 10 } }]);
    expect(missing).toEqual([30]);
  });
});
