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
  it("lists the team's players flagged active, not those with a game log", async () => {
    await getTeamRoster({ abbr: "WAS" });

    expect(findManyPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamAbbr: "WAS", isActive: true } }),
    );
  });

  it("does not wait on game logs, so a rookie with none still makes the roster", async () => {
    const rookie = {
      id: 1057262817,
      firstName: "AJ",
      lastName: "Dybantsa",
      fullName: "AJ Dybantsa",
      position: "F",
      jerseyNumber: "0",
      nbaPersonId: null,
      teamAbbr: "WAS",
    };
    findManyPlayers.mockResolvedValue([rookie]);

    const roster = await getTeamRoster({ abbr: "WAS" });

    expect(roster).toEqual([rookie]);
    expect(findFirstGameLog).not.toHaveBeenCalled();
  });
});
