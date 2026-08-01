import { beforeEach, describe, expect, it, vi } from "bun:test";

const count = vi.fn();
const create = vi.fn();
const deleteMany = vi.fn();
const getProfile = vi.fn();
const ensureDefaultLeague = vi.fn();

// starPlayer runs its cap check inside an interactive transaction, so the mock
// hands the callback the same delegate shape Prisma would.
const tx = { leagueWatchlistPlayer: { count, create, deleteMany } };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueWatchlistPlayer: { count, create, deleteMany },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));
vi.mock("@/lib/leagues/queries", () => ({ ensureDefaultLeague }));

import { starPlayer, unstarPlayer } from "@/lib/watchlist/actions";

const profile = { id: "11111111-1111-1111-1111-111111111111" };
const league = { id: "league-1" };

beforeEach(() => {
  count.mockReset();
  create.mockReset();
  deleteMany.mockReset();
  getProfile.mockReset();
  ensureDefaultLeague.mockReset();
  getProfile.mockResolvedValue(profile);
  ensureDefaultLeague.mockResolvedValue(league);
  create.mockResolvedValue({});
  deleteMany.mockResolvedValue({ count: 1 });
});

describe("starPlayer", () => {
  it("creates the row and returns the new count", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 4 });
    expect(create).toHaveBeenCalledWith({
      data: { leagueId: league.id, playerId: 7, profileId: profile.id },
    });
  });

  it("refuses the 51st star and reports the cap", async () => {
    count.mockResolvedValueOnce(50);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "limit", count: 50 });
    expect(create).not.toHaveBeenCalled();
  });

  it("treats an already-starred player as success", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(3);
    create.mockRejectedValue({ code: "P2002" });
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 3 });
  });

  it("is unauthenticated when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(create).not.toHaveBeenCalled();
  });

  it("is unauthenticated when the default league cannot be resolved", async () => {
    ensureDefaultLeague.mockResolvedValue(null);
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(create).not.toHaveBeenCalled();
  });

  it("reports error when the write blows up", async () => {
    count.mockResolvedValueOnce(3);
    create.mockRejectedValue(new Error("connection reset"));
    expect(await starPlayer({ playerId: 7 })).toEqual({ status: "error" });
  });
});

describe("unstarPlayer", () => {
  it("deletes the row and returns the new count", async () => {
    count.mockResolvedValueOnce(2);
    expect(await unstarPlayer({ playerId: 7 })).toEqual({ status: "ok", count: 2 });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { leagueId: league.id, playerId: 7 },
    });
  });

  it("is unauthenticated when signed out", async () => {
    ensureDefaultLeague.mockResolvedValue(null);
    expect(await unstarPlayer({ playerId: 7 })).toEqual({ status: "unauthenticated" });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
