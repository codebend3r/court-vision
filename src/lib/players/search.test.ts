import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlayers } from "@/lib/players/search";
import type { PlayerRow } from "@/lib/players/search";
import type { PlayersSearchParams } from "@/lib/players/searchParams";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findMany: vi.fn<(arg: unknown) => Promise<PlayerRow[]>>(),
      count: vi.fn<(arg: unknown) => Promise<number>>(),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { prisma } from "@/lib/prisma";

const defaultParams: PlayersSearchParams = {
  q: "",
  page: 1,
  size: 25,
  includeRetired: false,
  sort: "firstName",
  dir: "asc",
};

const expectedSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  teamAbbr: true,
  position: true,
  nbaPersonId: true,
  seasonStats: {
    where: { seasonType: "Regular Season" },
    orderBy: { season: "desc" },
    take: 1,
    select: {
      gamesPlayed: true,
      fgm: true,
      fga: true,
      fg3m: true,
      ftm: true,
      fta: true,
      reb: true,
      ast: true,
      stl: true,
      blk: true,
      tov: true,
      pts: true,
    },
  },
};

describe("searchPlayers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls findMany with default view (active players, no query)", async () => {
    const mockRows = [
      {
        id: 1,
        firstName: "Stephen",
        lastName: "Curry",
        fullName: "Stephen Curry",
        teamId: 1,
        teamAbbr: "GSW",
        position: "PG",
        jerseyNumber: "30",
        nbaPersonId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.mocked(prisma.player.findMany).mockResolvedValue(mockRows);
    vi.mocked(prisma.player.count).mockResolvedValue(100);

    const result = await searchPlayers(defaultParams);

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: { gameLogs: { some: {} } },
      select: expectedSelect,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
      skip: 0,
      take: 25,
    });
    expect(result).toEqual({ rows: mockRows, total: 100, page: 1 });
  });

  it("adds fullName search condition when q is provided", async () => {
    const mockRows = [
      {
        id: 1,
        firstName: "Stephen",
        lastName: "Curry",
        fullName: "Stephen Curry",
        teamId: 1,
        teamAbbr: "GSW",
        position: "PG",
        jerseyNumber: "30",
        nbaPersonId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.mocked(prisma.player.findMany).mockResolvedValue(mockRows);
    vi.mocked(prisma.player.count).mockResolvedValue(1);

    await searchPlayers({ ...defaultParams, q: "curry" });

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: {
        gameLogs: { some: {} },
        fullName: { contains: "curry", mode: "insensitive" },
      },
      select: expectedSelect,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
      skip: 0,
      take: 25,
    });
  });

  it("excludes gameLogs filter when includeRetired is true", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    await searchPlayers({ ...defaultParams, includeRetired: true });

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: {},
      select: expectedSelect,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
      skip: 0,
      take: 25,
    });
  });

  it("orders by last name with first name and id tiebreaks when sort is lastName", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    await searchPlayers({ ...defaultParams, sort: "lastName", dir: "desc" });

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ lastName: "desc" }, { firstName: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("orders by first name descending with tiebreaks when dir is desc", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    await searchPlayers({ ...defaultParams, dir: "desc" });

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ firstName: "desc" }, { lastName: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("clamps page when requested page exceeds available data", async () => {
    const secondQueryRows = [
      {
        id: 2,
        firstName: "Player",
        lastName: "",
        fullName: "Player",
        teamId: 2,
        teamAbbr: "LAL",
        position: "SF",
        jerseyNumber: null,
        nbaPersonId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.player.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(secondQueryRows);
    vi.mocked(prisma.player.count).mockResolvedValue(30);

    const result = await searchPlayers({ ...defaultParams, page: 9 });

    expect(result).toEqual({ rows: secondQueryRows, total: 30, page: 2 });
    expect(prisma.player.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.player.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ skip: 200, take: 25 }),
    );
    expect(prisma.player.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: 25, take: 25 }),
    );
  });

  it("returns page 1 with empty rows when total is 0", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    const result = await searchPlayers(defaultParams);

    expect(result).toEqual({ rows: [], total: 0, page: 1 });
    expect(prisma.player.findMany).toHaveBeenCalledTimes(1);
  });
});
