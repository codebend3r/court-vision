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
  sort: "firstName",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  tab: "regular",
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
      fg3a: true,
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
        heightInches: null,
        weightLbs: null,
        birthDate: null,
        college: null,
        country: null,
        draftYear: null,
        draftRound: null,
        draftNumber: null,
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
      orderBy: [{ firstName: "desc" }, { lastName: "desc" }, { id: "asc" }],
      skip: 0,
      take: 25,
    });
    expect(result).toEqual({ rows: [expect.objectContaining(mockRows[0])], total: 100, page: 1 });
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
        heightInches: null,
        weightLbs: null,
        birthDate: null,
        college: null,
        country: null,
        draftYear: null,
        draftRound: null,
        draftNumber: null,
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
      orderBy: [{ firstName: "desc" }, { lastName: "desc" }, { id: "asc" }],
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
        heightInches: null,
        weightLbs: null,
        birthDate: null,
        college: null,
        country: null,
        draftYear: null,
        draftRound: null,
        draftNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.player.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(secondQueryRows);
    vi.mocked(prisma.player.count).mockResolvedValue(30);

    const result = await searchPlayers({ ...defaultParams, page: 9 });

    expect(result).toEqual({
      rows: [expect.objectContaining(secondQueryRows[0])],
      total: 30,
      page: 2,
    });
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

  it("aggregates and sorts the selected recent-game range", async () => {
    const recentRows = [
      {
        id: 1,
        firstName: "Alpha",
        lastName: "One",
        fullName: "Alpha One",
        teamAbbr: "AAA",
        position: "G",
        nbaPersonId: null,
        teamId: 1,
        jerseyNumber: null,
        heightInches: null,
        weightLbs: null,
        birthDate: null,
        college: null,
        country: null,
        draftYear: null,
        draftRound: null,
        draftNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        gameLogs: [
          {
            minutes: 30,
            fgm: 2,
            fga: 4,
            fg3m: 1,
            fg3a: 3,
            ftm: 1,
            fta: 2,
            reb: 2,
            ast: 3,
            stl: 1,
            blk: 0,
            tov: 1,
            pts: 6,
          },
        ],
      },
      {
        id: 2,
        firstName: "Beta",
        lastName: "Two",
        fullName: "Beta Two",
        teamAbbr: "BBB",
        position: "F",
        nbaPersonId: null,
        teamId: 2,
        jerseyNumber: null,
        heightInches: null,
        weightLbs: null,
        birthDate: null,
        college: null,
        country: null,
        draftYear: null,
        draftRound: null,
        draftNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        gameLogs: [
          {
            minutes: 32,
            fgm: 4,
            fga: 8,
            fg3m: 2,
            fg3a: 6,
            ftm: 2,
            fta: 2,
            reb: 4,
            ast: 2,
            stl: 0,
            blk: 1,
            tov: 2,
            pts: 12,
          },
        ],
      },
    ];
    vi.mocked(prisma.player.findMany).mockResolvedValue(recentRows);

    const result = await searchPlayers({
      ...defaultParams,
      sort: "pts",
      dir: "desc",
      range: "last20",
    });

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ gameLogs: expect.objectContaining({ take: 20 }) }),
      }),
    );
    expect(result.rows.map((row) => row.id)).toEqual([2, 1]);
    expect(result.rows[0].stats?.pts).toBe(12);
  });

  it("counts only appearances (not DNPs) as games played in a recent range", async () => {
    const rows = [
      {
        id: 1,
        firstName: "Gamma",
        lastName: "Three",
        fullName: "Gamma Three",
        teamAbbr: "CCC",
        position: "G",
        nbaPersonId: null,
        teamId: 3,
        jerseyNumber: null,
        heightInches: null,
        weightLbs: null,
        birthDate: null,
        college: null,
        country: null,
        draftYear: null,
        draftRound: null,
        draftNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        gameLogs: [
          {
            minutes: 30,
            fgm: 5,
            fga: 10,
            fg3m: 0,
            fg3a: 0,
            ftm: 0,
            fta: 0,
            reb: 0,
            ast: 0,
            stl: 0,
            blk: 0,
            tov: 0,
            pts: 10,
          },
          {
            minutes: 0,
            fgm: 0,
            fga: 0,
            fg3m: 0,
            fg3a: 0,
            ftm: 0,
            fta: 0,
            reb: 0,
            ast: 0,
            stl: 0,
            blk: 0,
            tov: 0,
            pts: 0,
          },
        ],
      },
    ];
    vi.mocked(prisma.player.findMany).mockResolvedValue(rows);

    const result = await searchPlayers({ ...defaultParams, sort: "pts", range: "last5" });

    // Two logs fetched, one DNP: one game played.
    expect(result.rows[0].stats?.gamesPlayed).toBe(1);
    expect(result.rows[0].stats?.pts).toBe(10);
  });

  it("sinks players below the qualifying minimum on percentage sorts", async () => {
    const buildPctRow = ({ id, fgm, fga }: { id: number; fgm: number; fga: number }) => ({
      id,
      firstName: `Player${id}`,
      lastName: `P${id}`,
      fullName: `Player${id} P${id}`,
      teamAbbr: "AAA",
      position: "G",
      nbaPersonId: null,
      teamId: 1,
      jerseyNumber: null,
      heightInches: null,
      weightLbs: null,
      birthDate: null,
      college: null,
      country: null,
      draftYear: null,
      draftRound: null,
      draftNumber: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      seasonStats: [
        {
          gamesPlayed: 50,
          fgm,
          fga,
          fg3m: 0,
          fg3a: 0,
          ftm: 200,
          fta: 250,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
          tov: 0,
          pts: fgm * 2,
        },
      ],
    });
    // Player 1 shoots a perfect but tiny sample; player 2 qualifies at .500
    const rows = [
      buildPctRow({ id: 1, fgm: 10, fga: 10 }),
      buildPctRow({ id: 2, fgm: 400, fga: 800 }),
    ];

    vi.mocked(prisma.player.findMany).mockResolvedValue(rows);
    const withMinimums = await searchPlayers({ ...defaultParams, sort: "fgPct", dir: "desc" });
    expect(withMinimums.rows.map((row) => row.id)).toEqual([2, 1]);

    vi.mocked(prisma.player.findMany).mockResolvedValue(rows);
    const withoutMinimums = await searchPlayers({
      ...defaultParams,
      sort: "fgPct",
      dir: "desc",
      minimums: false,
    });
    expect(withoutMinimums.rows.map((row) => row.id)).toEqual([1, 2]);
  });
});
