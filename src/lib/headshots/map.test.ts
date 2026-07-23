import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapHeadshots } from "@/lib/headshots/map";
import type { NbaPlayerIndexRow } from "@/lib/headshots/sources";
import * as sources from "@/lib/headshots/sources";
import { prisma } from "@/lib/prisma";

type OurPlayerRow = {
  id: number;
  fullName: string;
};

// `findMany` is generic and mocked without call-site args (see prisma.player.findMany
// below), so `vi.mocked(...).mockResolvedValue(...)` type-checks against the full
// Player row shape regardless of the `select` map.ts actually passes at runtime.
// Only `id`/`fullName` vary per test; the rest are match-irrelevant filler.
type FullPlayerRow = {
  firstName: string;
  lastName: string;
  teamId: number | null;
  teamAbbr: string | null;
  position: string | null;
  jerseyNumber: string | null;
  nbaPersonId: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  birthDate: Date | null;
  college: string | null;
  country: string | null;
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
} & OurPlayerRow;

const toFullPlayerRow = (row: OurPlayerRow): FullPlayerRow => ({
  firstName: "First",
  lastName: "Last",
  teamId: null,
  teamAbbr: null,
  position: null,
  jerseyNumber: null,
  nbaPersonId: null,
  heightInches: null,
  weightLbs: null,
  birthDate: null,
  college: null,
  country: null,
  draftYear: null,
  draftRound: null,
  draftNumber: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...row,
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findMany: vi.fn<(arg: unknown) => Promise<FullPlayerRow[]>>(),
      update: vi.fn<(arg: unknown) => Promise<unknown>>(),
    },
  },
}));

const mockFindMany = (players: OurPlayerRow[]): void => {
  vi.mocked(prisma.player.findMany).mockResolvedValue(players.map(toFullPlayerRow));
};

const mockIndex = (rows: NbaPlayerIndexRow[]): void => {
  vi.spyOn(sources, "fetchNbaPlayerIndex").mockResolvedValue(rows);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapHeadshots", () => {
  it("queries only players that have game logs", async () => {
    mockIndex([]);
    mockFindMany([]);

    await mapHeadshots();

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: { gameLogs: { some: {} } },
      select: { id: true, fullName: true },
    });
  });

  it("matches players on normalized name and persists nbaPersonId per match", async () => {
    mockIndex([
      { personId: 1629029, fullName: "Luka Dončić" },
      { personId: 1630162, fullName: "Anthony Edwards" },
    ]);
    mockFindMany([
      { id: 10, fullName: "Luka Doncic" },
      { id: 20, fullName: "Anthony Edwards" },
    ]);

    const result = await mapHeadshots();

    expect(result).toEqual({ matched: 2, unmatched: [] });
    expect(prisma.player.update).toHaveBeenCalledTimes(2);
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { nbaPersonId: 1629029 },
    });
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { nbaPersonId: 1630162 },
    });
  });

  it("matches names that differ only in punctuation (A.J. Green vs AJ Green)", async () => {
    mockIndex([
      { personId: 1631260, fullName: "AJ Green" },
      { personId: 202340, fullName: "Devonte' Graham" },
    ]);
    mockFindMany([
      { id: 60, fullName: "A.J. Green" },
      { id: 61, fullName: "Devonte Graham" },
    ]);

    const result = await mapHeadshots();

    expect(result).toEqual({ matched: 2, unmatched: [] });
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 60 },
      data: { nbaPersonId: 1631260 },
    });
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 61 },
      data: { nbaPersonId: 202340 },
    });
  });

  it("skips and reports a player with zero index matches", async () => {
    mockIndex([{ personId: 1629029, fullName: "Luka Doncic" }]);
    mockFindMany([
      { id: 10, fullName: "Luka Doncic" },
      { id: 30, fullName: "Nobody Matches" },
    ]);

    const result = await mapHeadshots();

    expect(result).toEqual({ matched: 1, unmatched: ["Nobody Matches"] });
    expect(prisma.player.update).toHaveBeenCalledTimes(1);
    expect(prisma.player.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 30 } }),
    );
  });

  it("skips and reports a name with two or more index matches (ambiguous index side)", async () => {
    mockIndex([
      { personId: 1, fullName: "Player X" },
      { personId: 2, fullName: "Player X" },
    ]);
    mockFindMany([{ id: 40, fullName: "Player X" }]);

    const result = await mapHeadshots();

    expect(result).toEqual({ matched: 0, unmatched: ["Player X"] });
    expect(prisma.player.update).not.toHaveBeenCalled();
  });

  it("skips and reports both players when two of our players normalize identically", async () => {
    mockIndex([{ personId: 1, fullName: "Twin Guy" }]);
    mockFindMany([
      { id: 50, fullName: "Twin Guy" },
      { id: 51, fullName: "Twin Guy" },
    ]);

    const result = await mapHeadshots();

    expect(result.matched).toBe(0);
    expect(result.unmatched).toEqual(expect.arrayContaining(["Twin Guy", "Twin Guy"]));
    expect(result.unmatched).toHaveLength(2);
    expect(prisma.player.update).not.toHaveBeenCalled();
  });

  it("passes fetchImpl through to fetchNbaPlayerIndex", async () => {
    const fetchIndexSpy = vi.spyOn(sources, "fetchNbaPlayerIndex").mockResolvedValue([]);
    mockFindMany([]);
    const fetchImpl = vi.fn<typeof fetch>();

    await mapHeadshots({ fetchImpl });

    expect(fetchIndexSpy).toHaveBeenCalledWith({ fetchImpl });
  });
});
