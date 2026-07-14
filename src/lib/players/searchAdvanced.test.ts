import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlayersAdvanced } from "@/lib/players/searchAdvanced";
import type { PlayersSearchParams } from "@/lib/players/searchParams";

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

const defaultParams: PlayersSearchParams = {
  q: "",
  page: 1,
  size: 25,
  sort: "pie",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  tab: "advanced",
};

const buildLog = (overrides: { gameDate?: Date; season?: string; pie?: number | null } = {}) => ({
  gameDate: overrides.gameDate ?? new Date("2025-11-01"),
  season: overrides.season ?? "2025-26",
  pie: overrides.pie === undefined ? 15 : overrides.pie,
  pace: 98,
  assistPercentage: 0.2,
  assistRatio: 20,
  assistToTurnover: 2,
  defensiveRating: 110,
  defensiveReboundPercentage: 0.1,
  effectiveFieldGoalPercentage: 0.5,
  netRating: 4,
  offensiveRating: 114,
  offensiveReboundPercentage: 0.05,
  reboundPercentage: 0.08,
  trueShootingPercentage: 0.55,
  turnoverRatio: 12,
  usagePercentage: 0.25,
});

describe("searchPlayersAdvanced", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls findMany with the active-player where clause when sorting by name", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    await searchPlayersAdvanced({ ...defaultParams, sort: "firstName", dir: "asc" });

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gameLogs: { some: {} } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
        skip: 0,
        take: 25,
      }),
    );
  });

  it("adds a fullName search condition when q is provided", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    await searchPlayersAdvanced({ ...defaultParams, sort: "firstName", q: "curry" });

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gameLogs: { some: {} }, fullName: { contains: "curry", mode: "insensitive" } },
      }),
    );
  });

  it("averages non-null metrics over the last-N games and skips null-metric games", async () => {
    const rows = [
      {
        id: 1,
        firstName: "Alpha",
        lastName: "One",
        fullName: "Alpha One",
        teamAbbr: "AAA",
        position: "G",
        nbaPersonId: null,
        seasonStats: [{ season: "2025-26" }],
        advancedGameLogs: [buildLog({ pie: 20 }), buildLog({ pie: null }), buildLog({ pie: 10 })],
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.player.findMany>>;
    vi.mocked(prisma.player.findMany).mockResolvedValue(rows);

    const result = await searchPlayersAdvanced({ ...defaultParams, sort: "pie", range: "last5" });

    // (20 + 10) / 2 non-null games = 15; the null game is skipped, not treated as 0.
    expect(result.rows[0].stats.pie).toBe(15);
  });

  it("scopes the all range to the player's latest season", async () => {
    const rows = [
      {
        id: 1,
        firstName: "Beta",
        lastName: "Two",
        fullName: "Beta Two",
        teamAbbr: "BBB",
        position: "F",
        nbaPersonId: null,
        seasonStats: [{ season: "2025-26" }],
        advancedGameLogs: [
          buildLog({ season: "2025-26", pie: 30 }),
          buildLog({ season: "2024-25", pie: 5 }),
        ],
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.player.findMany>>;
    vi.mocked(prisma.player.findMany).mockResolvedValue(rows);

    const result = await searchPlayersAdvanced({ ...defaultParams, sort: "pie", range: "all" });

    // Only the 2025-26 log counts; the 2024-25 log is excluded from the average.
    expect(result.rows[0].stats.pie).toBe(30);
  });

  it("sorts by a metric with null values sinking to the bottom regardless of direction", async () => {
    const withData = {
      id: 1,
      firstName: "Gamma",
      lastName: "Three",
      fullName: "Gamma Three",
      teamAbbr: "CCC",
      position: "C",
      nbaPersonId: null,
      seasonStats: [{ season: "2025-26" }],
      advancedGameLogs: [buildLog({ pie: 12 })],
    };
    const noData = {
      id: 2,
      firstName: "Delta",
      lastName: "Four",
      fullName: "Delta Four",
      teamAbbr: "DDD",
      position: "F",
      nbaPersonId: null,
      seasonStats: [{ season: "2025-26" }],
      advancedGameLogs: [],
    };

    vi.mocked(prisma.player.findMany).mockResolvedValue([noData, withData] as unknown as Awaited<
      ReturnType<typeof prisma.player.findMany>
    >);
    const ascending = await searchPlayersAdvanced({ ...defaultParams, sort: "pie", dir: "asc" });
    expect(ascending.rows.map((row) => row.id)).toEqual([1, 2]);

    vi.mocked(prisma.player.findMany).mockResolvedValue([noData, withData] as unknown as Awaited<
      ReturnType<typeof prisma.player.findMany>
    >);
    const descending = await searchPlayersAdvanced({ ...defaultParams, sort: "pie", dir: "desc" });
    expect(descending.rows.map((row) => row.id)).toEqual([1, 2]);
  });

  it("clamps the page when the requested page exceeds available data", async () => {
    const secondPageRows = [
      {
        id: 2,
        firstName: "Echo",
        lastName: "",
        fullName: "Echo",
        teamAbbr: "EEE",
        position: "SF",
        nbaPersonId: null,
        seasonStats: [{ season: "2025-26" }],
        advancedGameLogs: [],
      },
    ];
    vi.mocked(prisma.player.findMany)
      .mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof prisma.player.findMany>>)
      .mockResolvedValueOnce(
        secondPageRows as unknown as Awaited<ReturnType<typeof prisma.player.findMany>>,
      );
    vi.mocked(prisma.player.count).mockResolvedValue(30);

    const result = await searchPlayersAdvanced({
      ...defaultParams,
      sort: "firstName",
      dir: "desc",
      page: 9,
    });

    expect(result).toEqual({
      rows: [expect.objectContaining({ id: 2 })],
      total: 30,
      page: 2,
    });
  });

  it("returns empty rows on page 1 when there are zero matches", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
    vi.mocked(prisma.player.count).mockResolvedValue(0);

    const result = await searchPlayersAdvanced({ ...defaultParams, sort: "firstName" });

    expect(result).toEqual({ rows: [], total: 0, page: 1 });
  });
});
