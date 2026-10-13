import { beforeEach, describe, expect, it, vi } from "bun:test";

const findMany = vi.fn();
const getActiveLeagueRecord = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { leagueTeamSlot: { findMany } } }));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeagueRecord }));

import { getRosteredPlayerIds } from "@/lib/leagues/teamQueries";

const league = { id: "league-1" };

beforeEach(() => {
  findMany.mockReset();
  getActiveLeagueRecord.mockReset();
  getActiveLeagueRecord.mockResolvedValue(league);
});

describe("getRosteredPlayerIds", () => {
  it("returns each filled slot's player once, across every team in the active league", async () => {
    findMany.mockResolvedValue([{ playerId: 115 }, { playerId: 237 }]);

    expect(await getRosteredPlayerIds()).toEqual([115, 237]);
    expect(findMany).toHaveBeenCalledWith({
      where: { team: { leagueId: "league-1" }, playerId: { not: null } },
      distinct: ["playerId"],
      select: { playerId: true },
    });
  });

  it("drops a null player id the filter should already have excluded", async () => {
    findMany.mockResolvedValue([{ playerId: 115 }, { playerId: null }]);

    expect(await getRosteredPlayerIds()).toEqual([115]);
  });

  it("returns an empty list without a league, without querying slots", async () => {
    getActiveLeagueRecord.mockResolvedValue(null);

    expect(await getRosteredPlayerIds()).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
