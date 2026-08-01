import { beforeEach, describe, expect, it, vi } from "bun:test";

const leagueFindFirst = vi.fn();
const leagueTeamFindMany = vi.fn();
const leagueTeamCreate = vi.fn();
const leagueTeamUpdateMany = vi.fn();
const leagueTeamFindUnique = vi.fn();
const leagueTeamDeleteMany = vi.fn();
const leagueTeamSlotDeleteMany = vi.fn();
const leagueTeamSlotCreateMany = vi.fn();
const getProfile = vi.fn();

const tx = {
  leagueTeam: {
    findMany: leagueTeamFindMany,
    create: leagueTeamCreate,
    updateMany: leagueTeamUpdateMany,
    findUnique: leagueTeamFindUnique,
  },
  leagueTeamSlot: {
    deleteMany: leagueTeamSlotDeleteMany,
    createMany: leagueTeamSlotCreateMany,
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findFirst: leagueFindFirst },
    leagueTeam: { deleteMany: leagueTeamDeleteMany },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));

import { deleteLeagueTeam, saveLeagueTeam } from "@/lib/leagues/teamActions";
import { type RosterSlot } from "@/lib/fantasyTeams/types";

const profile = { id: "prof-1" };
const player = {
  playerId: 7,
  firstName: "Kevin",
  lastName: "Durant",
  fullName: "Kevin Durant",
  teamAbbr: "HOU",
  position: "F",
  nbaPersonId: 201142,
};
const slots: RosterSlot[] = [
  { id: "PG-1", type: "PG", player },
  { id: "UTIL-1", type: "UTIL", player: null },
];
const teamRow = {
  id: "team-1",
  name: "Bench Mob",
  createdAt: new Date("2026-07-31"),
  slots: [
    {
      slotType: "PG",
      player: {
        id: 7,
        firstName: "Kevin",
        lastName: "Durant",
        fullName: "Kevin Durant",
        teamAbbr: "HOU",
        position: "F",
        nbaPersonId: 201142,
      },
    },
    { slotType: "UTIL", player: null },
  ],
};

beforeEach(() => {
  leagueFindFirst.mockReset();
  leagueTeamFindMany.mockReset();
  leagueTeamCreate.mockReset();
  leagueTeamUpdateMany.mockReset();
  leagueTeamFindUnique.mockReset();
  leagueTeamDeleteMany.mockReset();
  leagueTeamSlotDeleteMany.mockReset();
  leagueTeamSlotCreateMany.mockReset();
  getProfile.mockReset();

  getProfile.mockResolvedValue(profile);
  leagueFindFirst.mockResolvedValue({ id: "league-1" });
  leagueTeamFindMany.mockResolvedValue([]);
  leagueTeamCreate.mockResolvedValue({ id: "team-1" });
  leagueTeamUpdateMany.mockResolvedValue({ count: 1 });
  leagueTeamFindUnique.mockResolvedValue(teamRow);
  leagueTeamDeleteMany.mockResolvedValue({ count: 1 });
  leagueTeamSlotDeleteMany.mockResolvedValue({ count: 0 });
  leagueTeamSlotCreateMany.mockResolvedValue({ count: 2 });
});

describe("saveLeagueTeam", () => {
  it("creates a team with a unique slug when teamId is null", async () => {
    leagueTeamFindMany.mockResolvedValueOnce([{ slug: "bench-mob" }]);
    const result = await saveLeagueTeam({
      leagueId: "league-1",
      teamId: null,
      name: "Bench Mob",
      slots,
    });
    expect(result.status).toBe("ok");
    expect(leagueTeamCreate).toHaveBeenCalledWith({
      data: {
        leagueId: "league-1",
        profileId: profile.id,
        name: "Bench Mob",
        slug: "bench-mob-2",
      },
    });
    expect(leagueTeamSlotCreateMany).toHaveBeenCalledWith({
      data: [
        { teamId: "team-1", profileId: profile.id, slotType: "PG", position: 0, playerId: 7 },
        { teamId: "team-1", profileId: profile.id, slotType: "UTIL", position: 1, playerId: null },
      ],
    });
  });

  it("updates an owned team, keeping its slug, and replaces its slots", async () => {
    const result = await saveLeagueTeam({
      leagueId: "league-1",
      teamId: "team-1",
      name: "Renamed",
      slots,
    });
    expect(result.status).toBe("ok");
    expect(leagueTeamUpdateMany).toHaveBeenCalledWith({
      where: { id: "team-1", leagueId: "league-1", profileId: profile.id },
      data: { name: "Renamed" },
    });
    expect(leagueTeamSlotDeleteMany).toHaveBeenCalledWith({ where: { teamId: "team-1" } });
    expect(leagueTeamCreate).not.toHaveBeenCalled();
  });

  it("returns invalid for a forged teamId (updateMany count 0)", async () => {
    leagueTeamUpdateMany.mockResolvedValueOnce({ count: 0 });
    const result = await saveLeagueTeam({
      leagueId: "league-1",
      teamId: "forged",
      name: "Hacked",
      slots,
    });
    expect(result).toEqual({ status: "invalid" });
    expect(leagueTeamSlotDeleteMany).not.toHaveBeenCalled();
  });

  it("returns invalid for an unowned league", async () => {
    leagueFindFirst.mockResolvedValueOnce(null);
    const result = await saveLeagueTeam({
      leagueId: "unowned",
      teamId: null,
      name: "Test",
      slots,
    });
    expect(result).toEqual({ status: "invalid" });
    expect(leagueTeamCreate).not.toHaveBeenCalled();
  });

  it("returns invalid for an empty trimmed name", async () => {
    const result = await saveLeagueTeam({
      leagueId: "league-1",
      teamId: null,
      name: "   ",
      slots,
    });
    expect(result).toEqual({ status: "invalid" });
  });

  it("returns invalid when slots is empty", async () => {
    const result = await saveLeagueTeam({
      leagueId: "league-1",
      teamId: null,
      name: "Test",
      slots: [],
    });
    expect(result).toEqual({ status: "invalid" });
  });

  it("returns unauthenticated when no profile", async () => {
    getProfile.mockResolvedValue(null);
    const result = await saveLeagueTeam({
      leagueId: "league-1",
      teamId: null,
      name: "Test",
      slots,
    });
    expect(result).toEqual({ status: "unauthenticated" });
    expect(leagueFindFirst).not.toHaveBeenCalled();
  });

  it("returns error on database exception", async () => {
    leagueTeamCreate.mockRejectedValueOnce(new Error("db error"));
    const result = await saveLeagueTeam({
      leagueId: "league-1",
      teamId: null,
      name: "Test",
      slots,
    });
    expect(result).toEqual({ status: "error" });
  });
});

describe("deleteLeagueTeam", () => {
  it("deletes an owned team", async () => {
    const result = await deleteLeagueTeam({ teamId: "team-1" });
    expect(result).toEqual({ status: "ok-deleted" });
    expect(leagueTeamDeleteMany).toHaveBeenCalledWith({
      where: { id: "team-1", profileId: profile.id },
    });
  });

  it("is idempotent for an already-gone or unowned team (0 rows deleted)", async () => {
    leagueTeamDeleteMany.mockResolvedValueOnce({ count: 0 });
    const result = await deleteLeagueTeam({ teamId: "forged" });
    expect(result).toEqual({ status: "ok-deleted" });
  });

  it("returns unauthenticated when no profile", async () => {
    getProfile.mockResolvedValue(null);
    const result = await deleteLeagueTeam({ teamId: "team-1" });
    expect(result).toEqual({ status: "unauthenticated" });
    expect(leagueTeamDeleteMany).not.toHaveBeenCalled();
  });

  it("returns error on database exception", async () => {
    leagueTeamDeleteMany.mockRejectedValueOnce(new Error("db error"));
    const result = await deleteLeagueTeam({ teamId: "team-1" });
    expect(result).toEqual({ status: "error" });
  });
});
