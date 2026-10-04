import { beforeEach, describe, expect, it, vi } from "bun:test";

const findMany = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();
const findUnique = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const getProfile = vi.fn();

const tx = {
  league: { findMany, create, updateMany, deleteMany, findUnique, findFirst },
  profile: { updateMany: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findMany, create, updateMany, deleteMany, findUnique, findFirst },
    profile: { update },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));
vi.mock("@/lib/leagues/queries", () => ({
  toLeagueSummary: ({ league }: { league: unknown }) => league,
}));

import { createLeague, deleteLeague, setActiveLeague, updateLeague } from "@/lib/leagues/actions";

const profile = { id: "prof-1", activeLeagueId: "league-1" };
const league = {
  id: "league-1",
  name: "My League",
  slug: "my-league",
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts", "reb"] },
  createdAt: new Date("2026-07-31"),
};

beforeEach(() => {
  findMany.mockReset();
  create.mockReset();
  updateMany.mockReset();
  deleteMany.mockReset();
  findUnique.mockReset();
  findFirst.mockReset();
  update.mockReset();
  getProfile.mockReset();
  tx.profile.updateMany.mockReset();

  getProfile.mockResolvedValue(profile);
  findMany.mockResolvedValue([]);
  create.mockResolvedValue(league);
  updateMany.mockResolvedValue({ count: 1 });
  deleteMany.mockResolvedValue({ count: 1 });
  findUnique.mockResolvedValue(league);
  findFirst.mockResolvedValue(league);
  update.mockResolvedValue({});
  tx.profile.updateMany.mockResolvedValue({ count: 1 });
});

describe("createLeague", () => {
  it("creates a league with clamped bounds when authenticated", async () => {
    tx.profile.updateMany.mockResolvedValueOnce({ count: 1 });
    const result = await createLeague({
      name: "Test League",
      scoringType: "roto",
      teamCount: 50,
      rosterSlots: 50,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result.status).toBe("ok");
    expect(result).toHaveProperty("league");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: profile.id,
        name: "Test League",
        scoringType: "roto",
        teamCount: 30,
        rosterSlots: 25,
      }),
    });
  });

  it("auto-activates the first league via profile.updateMany with activeLeagueId: null", async () => {
    tx.profile.updateMany.mockResolvedValueOnce({ count: 1 });
    await createLeague({
      name: "First League",
      scoringType: "h2h_categories",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
    });
    expect(tx.profile.updateMany).toHaveBeenCalledWith({
      where: { id: profile.id, activeLeagueId: null },
      data: { activeLeagueId: league.id },
    });
  });

  it("returns limit when MAX_LEAGUES is reached", async () => {
    findMany.mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ slug: `l${i}` })));
    const result = await createLeague({
      name: "Too Many",
      scoringType: "roto",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result).toEqual({ status: "limit" });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when no profile", async () => {
    getProfile.mockResolvedValue(null);
    const result = await createLeague({
      name: "Test",
      scoringType: "roto",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result).toEqual({ status: "unauthenticated" });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns invalid for empty trimmed name", async () => {
    const result = await createLeague({
      name: "   ",
      scoringType: "roto",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result).toEqual({ status: "invalid" });
  });

  it("returns invalid for unknown scoring type", async () => {
    const result = await createLeague({
      name: "Test",
      scoringType: "dynasty",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result).toEqual({ status: "invalid" });
  });

  it("returns error on database exception", async () => {
    create.mockRejectedValueOnce(new Error("db error"));
    const result = await createLeague({
      name: "Test",
      scoringType: "roto",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result).toEqual({ status: "error" });
  });
});

describe("updateLeague", () => {
  it("updates an owned league", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    const result = await updateLeague({
      leagueId: "league-1",
      name: "Updated",
      scoringType: "roto",
      teamCount: 8,
      rosterSlots: 10,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result.status).toBe("ok");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "league-1", profileId: profile.id },
      data: expect.objectContaining({
        name: "Updated",
        scoringType: "roto",
        teamCount: 8,
        rosterSlots: 10,
      }),
    });
  });

  it("returns invalid for a forged leagueId (updateMany count 0)", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await updateLeague({
      leagueId: "forged",
      name: "Hacked",
      scoringType: "roto",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result).toEqual({ status: "invalid" });
  });

  it("returns unauthenticated when no profile", async () => {
    getProfile.mockResolvedValue(null);
    const result = await updateLeague({
      leagueId: "league-1",
      name: "Test",
      scoringType: "roto",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { categories: ["pts"] },
    });
    expect(result).toEqual({ status: "unauthenticated" });
  });
});

describe("deleteLeague", () => {
  it("returns error and does NOT call profile.update when forged leagueId (deleteMany count 0)", async () => {
    deleteMany.mockResolvedValueOnce({ count: 0 });
    const result = await deleteLeague({ leagueId: "forged" });
    expect(result).toEqual({ status: "error" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns ok with existing activeLeagueId and does NOT call profile.update when deleting a non-active league", async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 });
    const profileWithDifferentActive = {
      id: "prof-1",
      activeLeagueId: "league-2",
    };
    getProfile.mockResolvedValue(profileWithDifferentActive);
    const result = await deleteLeague({ leagueId: "league-1" });
    expect(result).toEqual({ status: "ok", activeLeagueId: "league-2" });
    expect(update).not.toHaveBeenCalled();
  });

  it("deletes the active league, promotes fallback, and calls profile.update", async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 });
    const fallbackLeague = {
      id: "league-2",
      name: "Fallback",
      slug: "fallback",
      scoringType: "h2h_points",
      teamCount: 10,
      rosterSlots: 12,
      scoringConfig: { scoring: { pts: 1 } },
      createdAt: new Date("2026-07-30"),
    };
    findFirst.mockResolvedValueOnce(fallbackLeague);
    const result = await deleteLeague({ leagueId: "league-1" });
    expect(result).toEqual({ status: "ok", activeLeagueId: "league-2" });
    expect(update).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { activeLeagueId: "league-2" },
    });
  });

  it("clears activeLeagueId when deleting the active league with no fallback", async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 });
    findFirst.mockResolvedValueOnce(null);
    const result = await deleteLeague({ leagueId: "league-1" });
    expect(result).toEqual({ status: "ok", activeLeagueId: null });
    expect(update).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { activeLeagueId: null },
    });
  });

  it("returns unauthenticated when no profile", async () => {
    getProfile.mockResolvedValue(null);
    const result = await deleteLeague({ leagueId: "league-1" });
    expect(result).toEqual({ status: "unauthenticated" });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("returns error on database exception", async () => {
    deleteMany.mockRejectedValueOnce(new Error("db error"));
    const result = await deleteLeague({ leagueId: "league-1" });
    expect(result).toEqual({ status: "error" });
  });
});

describe("setActiveLeague", () => {
  it("sets an owned league as active", async () => {
    findFirst.mockResolvedValueOnce({ id: "league-1" });
    const result = await setActiveLeague({ leagueId: "league-1" });
    expect(result).toEqual({ status: "ok" });
    expect(update).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { activeLeagueId: "league-1" },
    });
  });

  it("returns error for an unowned league", async () => {
    findFirst.mockResolvedValueOnce(null);
    const result = await setActiveLeague({ leagueId: "unowned" });
    expect(result).toEqual({ status: "error" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when no profile", async () => {
    getProfile.mockResolvedValue(null);
    const result = await setActiveLeague({ leagueId: "league-1" });
    expect(result).toEqual({ status: "unauthenticated" });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns error on database exception", async () => {
    findFirst.mockRejectedValueOnce(new Error("db error"));
    const result = await setActiveLeague({ leagueId: "league-1" });
    expect(result).toEqual({ status: "error" });
  });
});
