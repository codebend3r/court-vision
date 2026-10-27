import { beforeEach, describe, expect, it, vi } from "bun:test";

const count = vi.fn();
const createMany = vi.fn();
const deleteMany = vi.fn();
const getProfile = vi.fn();
const ensureDefaultLeague = vi.fn();
const lockLeague = vi.fn(async () => {});
vi.mock("@/lib/leagues/locks", () => ({ lockLeague }));
const tx = { leagueWatchlistPlayer: { count, createMany, deleteMany } };
const $transaction = vi.fn((fn: (client: typeof tx) => unknown) => fn(tx));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction } }));
vi.mock("@/lib/auth/session", () => ({ getProfile }));
vi.mock("@/lib/leagues/queries", () => ({ ensureDefaultLeague }));

import { starPlayer, unstarPlayer } from "@/lib/watchlist/actions";

const profile = { id: "11111111-1111-1111-1111-111111111111" };
const league = { id: "league-1" };
const input = { playerId: 7, leagueId: league.id };

beforeEach(() => {
  vi.clearAllMocks();
  count.mockReset();
  createMany.mockReset();
  deleteMany.mockReset();
  getProfile.mockReset();
  ensureDefaultLeague.mockReset();
  getProfile.mockResolvedValue(profile);
  ensureDefaultLeague.mockResolvedValue(league);
  createMany.mockResolvedValue({ count: 1 });
  deleteMany.mockResolvedValue({ count: 1 });
});

describe("starPlayer", () => {
  it("creates the row and returns the new count", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    expect(await starPlayer(input)).toEqual({ status: "ok", count: 4 });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ leagueId: league.id, playerId: 7, profileId: profile.id }],
      skipDuplicates: true,
    });
    expect(ensureDefaultLeague).toHaveBeenCalledWith({ profile, expectedLeagueId: league.id });
  });

  it("allows a first star to create a default league only when none was displayed", async () => {
    count.mockResolvedValue(1);
    await starPlayer({ ...input, leagueId: null });
    expect(ensureDefaultLeague).toHaveBeenCalledWith({ profile, expectedLeagueId: null });
  });

  it("refuses the 51st star and reports the cap", async () => {
    count.mockResolvedValueOnce(50);
    expect(await starPlayer(input)).toEqual({ status: "limit", count: 50 });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("skips an already-starred player without aborting the transaction", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(3);
    createMany.mockResolvedValue({ count: 0 });
    expect(await starPlayer(input)).toEqual({ status: "ok", count: 3 });
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it("reports error when the write fails", async () => {
    count.mockResolvedValueOnce(3);
    createMany.mockRejectedValue(new Error("connection reset"));
    expect(await starPlayer(input)).toEqual({ status: "error" });
  });
});

describe("unstarPlayer", () => {
  it("deletes the row and returns the count in one transaction", async () => {
    count.mockResolvedValueOnce(2);
    expect(await unstarPlayer(input)).toEqual({ status: "ok", count: 2 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { leagueId: league.id, playerId: 7 } });
    expect(ensureDefaultLeague).toHaveBeenCalledWith({ profile, expectedLeagueId: league.id });
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});

[starPlayer, unstarPlayer].forEach((action) => {
  describe(action.name, () => {
    it("refuses a stale or unowned league without writing", async () => {
      ensureDefaultLeague.mockResolvedValue(null);
      expect(await action(input)).toEqual({ status: "error" });
      expect($transaction).not.toHaveBeenCalled();
    });

    it("is unauthenticated when signed out", async () => {
      getProfile.mockResolvedValue(null);
      expect(await action(input)).toEqual({ status: "unauthenticated" });
      expect(ensureDefaultLeague).not.toHaveBeenCalled();
    });

    it("reports a league lookup failure as an error", async () => {
      ensureDefaultLeague.mockRejectedValue(new Error("lookup failed"));
      expect(await action(input)).toEqual({ status: "error" });
      expect($transaction).not.toHaveBeenCalled();
    });

    it("refuses forged IDs before reading the session", async () => {
      // @ts-expect-error Exercise untrusted server-action arguments.
      expect(await action({ ...input, leagueId: { not: "" } })).toEqual({ status: "error" });
      // @ts-expect-error Exercise untrusted server-action arguments.
      expect(await action({ ...input, playerId: { gte: 0 } })).toEqual({ status: "error" });
      // @ts-expect-error Old clients must not silently target the current league.
      expect(await action({ playerId: 7 })).toEqual({ status: "error" });
      expect(getProfile).not.toHaveBeenCalled();
    });
  });
});
