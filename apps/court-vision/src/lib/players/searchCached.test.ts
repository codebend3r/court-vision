import { beforeEach, describe, expect, it, vi } from "bun:test";

import { parsePlayersSearchParams } from "@/lib/players/searchParams";

const fetchRegularPool = vi.fn();
const fetchAdvancedPool = vi.fn();
const rankPlayers = vi.fn();
const rankAdvancedPlayers = vi.fn();
const unstableCache = vi.fn();

// Make `unstable_cache` a pass-through so the wrappers can be exercised without
// a Next incremental cache (which is absent under bun:test), while recording
// the cache key parts each wrapper registers.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keyParts: unknown, options: unknown) => {
    unstableCache(keyParts, options);
    return fn;
  },
}));

vi.mock("@/lib/players/search", () => ({ fetchRegularPool, rankPlayers }));

vi.mock("@/lib/players/searchAdvanced", () => ({ fetchAdvancedPool, rankAdvancedPlayers }));

// Imported after the mocks are installed, not at the top of the file: bun:test
// does not hoist `vi.mock`, and searchCached calls `unstable_cache` at module
// scope — a static import would capture the real one before the mock lands.
const { searchPlayers, searchPlayersAdvanced } = await import("@/lib/players/searchCached");

describe("searchCached", () => {
  beforeEach(() => {
    fetchRegularPool.mockReset();
    fetchAdvancedPool.mockReset();
    rankPlayers.mockReset();
    rankAdvancedPlayers.mockReset();
  });

  it("caches one pool per range under the shared players tag", () => {
    expect(unstableCache).toHaveBeenCalledWith(["players:regular-pool"], {
      revalidate: 300,
      tags: ["players"],
    });
    expect(unstableCache).toHaveBeenCalledWith(["players:advanced-pool"], {
      revalidate: 300,
      tags: ["players"],
    });
  });

  it("ranks the regular pool for the requested range with the full params", async () => {
    const params = parsePlayersSearchParams({ raw: { range: "last10", sort: "reb", page: "3" } });
    if (params.tab === "advanced") throw new Error("expected the regular tab");
    const pool = [{ id: 1 }];
    const result = { rows: [], total: 0, page: 1 };
    fetchRegularPool.mockResolvedValue(pool);
    rankPlayers.mockReturnValue(result);

    await expect(searchPlayers({ ...params, takenIds: null })).resolves.toBe(result);
    expect(fetchRegularPool).toHaveBeenCalledWith({ range: "last10" });
    expect(rankPlayers).toHaveBeenCalledWith({ pool, args: { ...params, takenIds: null } });
  });

  it("narrows the pool to free agents or taken players before ranking", async () => {
    const params = parsePlayersSearchParams({ raw: { owner: "free" } });
    if (params.tab === "advanced") throw new Error("expected the regular tab");
    fetchRegularPool.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

    await searchPlayers({ ...params, takenIds: new Set([1, 3]) });

    expect(rankPlayers).toHaveBeenCalledWith(expect.objectContaining({ pool: [{ id: 2 }] }));
  });

  it("leaves the pool whole when the league's rosters are unknown", async () => {
    const params = parsePlayersSearchParams({ raw: { owner: "free" } });
    if (params.tab === "advanced") throw new Error("expected the regular tab");
    fetchRegularPool.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    await searchPlayers({ ...params, takenIds: null });

    expect(rankPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ pool: [{ id: 1 }, { id: 2 }] }),
    );
  });

  it("hands a watchlist's ids to the ranker with the params", async () => {
    const params = parsePlayersSearchParams({ raw: { tab: "starred" } });
    if (params.tab === "advanced") throw new Error("expected the starred tab");
    fetchRegularPool.mockResolvedValue([]);

    await searchPlayers({ ...params, takenIds: null, playerIds: [7, 3] });

    expect(rankPlayers).toHaveBeenCalledWith({
      pool: [],
      args: { ...params, takenIds: null, playerIds: [7, 3] },
    });
  });

  it("ranks the advanced pool for the requested range with the full params", async () => {
    const params = parsePlayersSearchParams({ raw: { tab: "advanced", range: "last5" } });
    if (params.tab !== "advanced") throw new Error("expected the advanced tab");
    const pool = [{ id: 2 }];
    const result = { rows: [], total: 0, page: 1 };
    fetchAdvancedPool.mockResolvedValue(pool);
    rankAdvancedPlayers.mockReturnValue(result);

    await expect(searchPlayersAdvanced({ ...params, takenIds: null })).resolves.toBe(result);
    expect(fetchAdvancedPool).toHaveBeenCalledWith({ range: "last5" });
    expect(rankAdvancedPlayers).toHaveBeenCalledWith({
      pool,
      args: { ...params, takenIds: null },
    });
  });
});
