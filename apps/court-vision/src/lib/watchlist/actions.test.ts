import { beforeEach, describe, expect, it, vi } from "bun:test";

const count = vi.fn();
const createMany = vi.fn();
const deleteMany = vi.fn();
const getProfile = vi.fn();
const ensureDefaultLeague = vi.fn();

// Both actions run inside an interactive transaction, so the mock hands the
// callback the same delegate shape Prisma would.
const tx = { leagueWatchlistPlayer: { count, createMany, deleteMany } };
const $transaction = vi.fn((fn: (client: typeof tx) => unknown) => fn(tx));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueWatchlistPlayer: { count, createMany, deleteMany },
    $transaction,
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));
vi.mock("@/lib/leagues/queries", () => ({ ensureDefaultLeague }));

import { starPlayer, unstarPlayer } from "@/lib/watchlist/actions";

const profile = { id: "11111111-1111-1111-1111-111111111111" };
const league = { id: "league-1" };

beforeEach(() => {
  count.mockReset();
  createMany.mockReset();
  deleteMany.mockReset();
  getProfile.mockReset();
  ensureDefaultLeague.mockReset();
  $transaction.mockClear();
  getProfile.mockResolvedValue(profile);
  ensureDefaultLeague.mockResolvedValue(league);
  createMany.mockResolvedValue({ count: 1 });
  deleteMany.mockResolvedValue({ count: 1 });
});

describe("starPlayer", () => {
  it("creates the row and returns the new count", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 4 });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ leagueId: league.id, playerId: 7, profileId: profile.id }],
      skipDuplicates: true,
    });
  });

  it("passes the resolved profile through to ensureDefaultLeague", async () => {
    count.mockResolvedValue(1);
    await starPlayer({ playerId: 7 });
    expect(ensureDefaultLeague).toHaveBeenCalledWith({ profile });
  });

  it("refuses the 51st star and reports the cap", async () => {
    count.mockResolvedValueOnce(50);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "limit", count: 50 });
    expect(createMany).not.toHaveBeenCalled();
  });

  // A failed INSERT aborts a Postgres transaction, so catching a unique
  // violation and counting afterwards would still fail. The write skips the
  // duplicate instead and the transaction carries on.
  it("treats an already-starred player as success by skipping the duplicate", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(3);
    createMany.mockResolvedValue({ count: 0 });
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 3 });
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it("is unauthenticated when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(ensureDefaultLeague).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("is unauthenticated when the default league cannot be resolved", async () => {
    ensureDefaultLeague.mockResolvedValue(null);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("reports error when the write blows up", async () => {
    count.mockResolvedValueOnce(3);
    createMany.mockRejectedValue(new Error("connection reset"));
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "error" });
  });

  it("reports error (not an unhandled rejection) when ensureDefaultLeague throws", async () => {
    ensureDefaultLeague.mockRejectedValue(new Error("create race lost, no winner found"));
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "error" });
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe("unstarPlayer", () => {
  it("deletes the row and returns the new count in one transaction", async () => {
    count.mockResolvedValueOnce(2);
    expect(await unstarPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 2 });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { leagueId: league.id, playerId: 7 },
    });
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it("is unauthenticated when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await unstarPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("is unauthenticated when the default league cannot be resolved", async () => {
    ensureDefaultLeague.mockResolvedValue(null);
    expect(await unstarPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("refuses a non-integer id before reading the session", async () => {
    // @ts-expect-error Simulate an object becoming a Prisma filter at runtime.
    expect(await unstarPlayer({ playerId: { gte: 0 } })).toEqual({ status: "error" });
    expect(getProfile).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("reports error (not an unhandled rejection) when ensureDefaultLeague throws", async () => {
    ensureDefaultLeague.mockRejectedValue(new Error("create race lost, no winner found"));
    expect(await unstarPlayer({ playerId: 7 })).toEqual({ status: "error" });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
