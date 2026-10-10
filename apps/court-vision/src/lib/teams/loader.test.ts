import { beforeEach, describe, expect, it, vi } from "bun:test";

const findFirstGameLog = vi.fn();
const findManyPlayers = vi.fn();

// A pass-through: bun:test has no Next incremental cache.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    playerGameLog: { findFirst: findFirstGameLog },
    player: { findMany: findManyPlayers },
  },
}));

// Imported after the mocks are installed: loader.ts calls `unstable_cache` at
// module scope, so a static import would capture the real one first.
const { getTeamRoster } = await import("@/lib/teams/loader");

beforeEach(() => {
  findFirstGameLog.mockReset();
  findManyPlayers.mockReset();
  findManyPlayers.mockResolvedValue([]);
});

describe("getTeamRoster", () => {
  it("scopes the roster to the newest season that has game logs", async () => {
    findFirstGameLog.mockResolvedValue({ season: "2025-26" });

    await getTeamRoster({ abbr: "GSW" });

    expect(findManyPlayers).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamAbbr: "GSW", gameLogs: { some: { season: "2025-26" } } },
      }),
    );
  });

  it("returns an empty roster without querying players when no logs exist", async () => {
    findFirstGameLog.mockResolvedValue(null);

    const roster = await getTeamRoster({ abbr: "GSW" });

    expect(roster).toEqual([]);
    expect(findManyPlayers).not.toHaveBeenCalled();
  });
});
