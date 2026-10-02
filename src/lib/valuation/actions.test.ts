import { beforeEach, describe, expect, it, vi } from "bun:test";

const findMany = vi.fn();
const latestSeason = vi.fn();
// Outside Next there is no incremental cache; the wrapper passes the fetch
// through and records how it was registered.
const unstableCache = vi.fn(
  (fetch: (...args: unknown[]) => unknown, _keyParts: string[], _options: unknown) => fetch,
);

vi.mock("@/lib/prisma", () => ({ prisma: { playerGameLog: { findMany } } }));
vi.mock("@/lib/valuation/season", () => ({ latestSeason }));
vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));

// Loaded after the mocks: the cache wrapper is built when the module
// evaluates, so a static import would capture the real `unstable_cache`.
const { loadFantasyTrendLogs } = await import("@/lib/valuation/actions");

const row = ({ playerId, day }: { playerId: number; day: number }) => ({
  playerId,
  gameDate: new Date(Date.UTC(2026, 0, day)),
  minutes: 30,
  pts: 20,
  reb: 5,
  ast: 4,
  stl: 1,
  blk: 1,
  fg3m: 2,
  tov: 2,
  fgm: 8,
  fga: 16,
  ftm: 2,
  fta: 3,
});

beforeEach(() => {
  findMany.mockReset();
  latestSeason.mockReset();
  latestSeason.mockResolvedValue("2025-26");
  findMany.mockResolvedValue([]);
});

describe("loadFantasyTrendLogs", () => {
  it("returns every requested player's season logs, grouped and dated as ISO strings", async () => {
    findMany.mockResolvedValue([
      row({ playerId: 1, day: 1 }),
      row({ playerId: 1, day: 2 }),
      row({ playerId: 2, day: 1 }),
    ]);

    const result = await loadFantasyTrendLogs({ playerIds: [2, 1] });

    expect(result).toEqual({
      status: "ok",
      players: [
        {
          playerId: 2,
          logs: [expect.objectContaining({ gameDate: "2026-01-01T00:00:00.000Z", pts: 20 })],
        },
        {
          playerId: 1,
          logs: [
            expect.objectContaining({ gameDate: "2026-01-01T00:00:00.000Z" }),
            expect.objectContaining({ gameDate: "2026-01-02T00:00:00.000Z" }),
          ],
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Ids are sorted into the cache key, so the query sees them sorted too.
        where: { playerId: { in: [1, 2] }, season: "2025-26", seasonType: "Regular Season" },
        orderBy: { gameDate: "asc" },
      }),
    );
  });

  it("lists a requested player with no games as an empty log", async () => {
    const result = await loadFantasyTrendLogs({ playerIds: [9] });
    expect(result).toEqual({ status: "ok", players: [{ playerId: 9, logs: [] }] });
  });

  it("refuses malformed or oversized requests without touching the database", async () => {
    expect(await loadFantasyTrendLogs({ playerIds: [1.5] })).toEqual({ status: "error" });
    expect(await loadFantasyTrendLogs({ playerIds: [0] })).toEqual({ status: "error" });
    expect(
      await loadFantasyTrendLogs({
        playerIds: Array.from({ length: 101 }, (_, index) => index + 1),
      }),
    ).toEqual({ status: "error" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("answers with empty logs before any season is synced", async () => {
    latestSeason.mockResolvedValue(null);
    expect(await loadFantasyTrendLogs({ playerIds: [1] })).toEqual({
      status: "ok",
      players: [{ playerId: 1, logs: [] }],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("caches the page's logs under the players tag so a sync busts it with every other surface", () => {
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["fantasy:trend-logs"],
      expect.objectContaining({ tags: ["players"], revalidate: 300 }),
    );
  });

  it("reports a failed query as an error result", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    expect(await loadFantasyTrendLogs({ playerIds: [1] })).toEqual({ status: "error" });
  });
});
