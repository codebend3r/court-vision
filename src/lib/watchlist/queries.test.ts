import { beforeEach, describe, expect, it, vi } from "bun:test";

const findMany = vi.fn();
const count = vi.fn();
const getProfile = vi.fn();
const resolveActiveLeague = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { leagueWatchlistPlayer: { findMany, count } } }));
vi.mock("@/lib/auth/session", () => ({ getProfile }));
vi.mock("@/lib/leagues/queries", () => ({ resolveActiveLeague }));

import {
  getWatchlistCount,
  getWatchlistPlayerIds,
  getWatchlistPlayers,
} from "@/lib/watchlist/queries";

const profile = { id: "11111111-1111-1111-1111-111111111111" };
const league = { id: "league-1" };

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
  getProfile.mockReset();
  resolveActiveLeague.mockReset();
  getProfile.mockResolvedValue(profile);
  resolveActiveLeague.mockResolvedValue(league);
});

describe("getWatchlistPlayerIds", () => {
  it("returns ids newest-starred first", async () => {
    findMany.mockResolvedValue([{ playerId: 7 }, { playerId: 3 }]);
    expect(await getWatchlistPlayerIds()).toEqual([7, 3]);
    expect(findMany).toHaveBeenCalledWith({
      where: { leagueId: league.id },
      orderBy: { createdAt: "desc" },
      select: { playerId: true },
    });
  });

  it("returns an empty list when signed out, without querying", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getWatchlistPlayerIds()).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns an empty list when there is no active league, without querying", async () => {
    resolveActiveLeague.mockResolvedValue(null);
    expect(await getWatchlistPlayerIds()).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("getWatchlistPlayers", () => {
  it("flattens the joined player into a summary with an ISO starredAt", async () => {
    findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-07-30T12:00:00.000Z"),
        player: {
          id: 7,
          fullName: "Jalen Brunson",
          teamAbbr: "NYK",
          position: "G",
          nbaPersonId: 1628973,
        },
      },
    ]);
    expect(await getWatchlistPlayers({ limit: 5 })).toEqual([
      {
        playerId: 7,
        fullName: "Jalen Brunson",
        teamAbbr: "NYK",
        position: "G",
        nbaPersonId: 1628973,
        starredAt: "2026-07-30T12:00:00.000Z",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, orderBy: { createdAt: "desc" } }),
    );
  });

  it("returns an empty list when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getWatchlistPlayers({ limit: 5 })).toEqual([]);
  });

  it("returns an empty list when there is no active league", async () => {
    resolveActiveLeague.mockResolvedValue(null);
    expect(await getWatchlistPlayers({ limit: 5 })).toEqual([]);
  });
});

describe("getWatchlistCount", () => {
  it("counts the active league's rows", async () => {
    count.mockResolvedValue(42);
    expect(await getWatchlistCount()).toBe(42);
    expect(count).toHaveBeenCalledWith({ where: { leagueId: league.id } });
  });

  it("is zero when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getWatchlistCount()).toBe(0);
  });

  it("is zero when there is no active league", async () => {
    resolveActiveLeague.mockResolvedValue(null);
    expect(await getWatchlistCount()).toBe(0);
  });
});
