import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlayers } from "./search";
import type { PlayerRow } from "./search";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findMany: vi.fn(),
      count: vi.fn(),
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
    const mockRows: PlayerRow[] = [
      { id: 1, fullName: "Stephen Curry", teamAbbr: "GSW", position: "PG" },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.findMany as any).mockResolvedValue(mockRows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.count as any).mockResolvedValue(100);

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
    const mockRows: PlayerRow[] = [
      { id: 1, fullName: "Stephen Curry", teamAbbr: "GSW", position: "PG" },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.findMany as any).mockResolvedValue(mockRows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.count as any).mockResolvedValue(1);

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
    const mockRows: PlayerRow[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.findMany as any).mockResolvedValue(mockRows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.count as any).mockResolvedValue(0);

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
    const firstQueryRows: PlayerRow[] = [];
    const secondQueryRows: PlayerRow[] = [
      { id: 2, fullName: "Player", teamAbbr: "LAL", position: "SF" },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.findMany as any)
      .mockResolvedValueOnce(firstQueryRows)
      .mockResolvedValueOnce(secondQueryRows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.count as any).mockResolvedValue(30);

    const result = await searchPlayers({ q: "", page: 9, size: 25, includeRetired: false });

    expect(result).toEqual({ rows: secondQueryRows, total: 30, page: 2 });
    expect(prisma.player.findMany).toHaveBeenCalledTimes(2);
  });

  it("returns page 1 with empty rows when total is 0", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.findMany as any).mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.player.count as any).mockResolvedValue(0);

    const result = await searchPlayers({ q: "", page: 1, size: 25, includeRetired: false });

    expect(result).toEqual({ rows: [], total: 0, page: 1 });
    expect(prisma.player.findMany).toHaveBeenCalledTimes(1);
  });
});
