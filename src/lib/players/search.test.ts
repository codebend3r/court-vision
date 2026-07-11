import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlayers } from "./search";
import type { PlayerRow } from "./search";

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

    const result = await searchPlayers({ q: "", page: 1, size: 25, includeRetired: false });

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: { gameLogs: { some: {} } },
      select: { id: true, fullName: true, teamAbbr: true, position: true },
      orderBy: { fullName: "asc" },
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

    await searchPlayers({ q: "curry", page: 1, size: 25, includeRetired: false });

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: {
        gameLogs: { some: {} },
        fullName: { contains: "curry", mode: "insensitive" },
      },
      select: { id: true, fullName: true, teamAbbr: true, position: true },
      orderBy: { fullName: "asc" },
      skip: 0,
      take: 25,
    });
  });

  it("excludes gameLogs filter when includeRetired is true", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    await searchPlayers({ q: "", page: 1, size: 25, includeRetired: true });

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: {},
      select: { id: true, fullName: true, teamAbbr: true, position: true },
      orderBy: { fullName: "asc" },
      skip: 0,
      take: 25,
    });
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

    const result = await searchPlayers({ q: "", page: 9, size: 25, includeRetired: false });

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

    const result = await searchPlayers({ q: "", page: 1, size: 25, includeRetired: false });

    expect(result).toEqual({ rows: [], total: 0, page: 1 });
    expect(prisma.player.findMany).toHaveBeenCalledTimes(1);
  });
});
