import { beforeEach, describe, expect, it, vi } from "bun:test";

const findMany = vi.fn();

// A pass-through: bun:test has no Next incremental cache.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({ prisma: { player: { findMany } } }));

// Imported after the mocks are installed: loader.ts calls `unstable_cache` at
// module scope, so a static import would capture the real one first.
const { getActiveRosterPlayers } = await import("@/lib/fantasyTeams/loader");

beforeEach(() => {
  findMany.mockReset();
});

describe("getActiveRosterPlayers", () => {
  it("returns every active-roster player as a builder player, stats or not", async () => {
    findMany.mockResolvedValue([
      {
        id: 1057262817,
        firstName: "AJ",
        lastName: "Dybantsa",
        fullName: "AJ Dybantsa",
        teamAbbr: "WAS",
        position: "F",
        nbaPersonId: 1643407,
      },
    ]);

    expect(await getActiveRosterPlayers()).toEqual([
      {
        playerId: 1057262817,
        firstName: "AJ",
        lastName: "Dybantsa",
        fullName: "AJ Dybantsa",
        teamAbbr: "WAS",
        position: "F",
        nbaPersonId: 1643407,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
  });
});
