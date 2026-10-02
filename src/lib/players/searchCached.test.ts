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
    const params = parsePlayersSearchParams({ range: "last10", sort: "reb", page: "3" });
    const pool = [{ id: 1 }];
    const result = { rows: [], total: 0, page: 1 };
    fetchRegularPool.mockResolvedValue(pool);
    rankPlayers.mockReturnValue(result);

    await expect(searchPlayers(params)).resolves.toBe(result);
    expect(fetchRegularPool).toHaveBeenCalledWith({ range: "last10" });
    expect(rankPlayers).toHaveBeenCalledWith({ pool, args: params });
  });

  it("short-circuits an empty watchlist without reading the pool", async () => {
    const params = parsePlayersSearchParams({ tab: "starred" });

    await expect(searchPlayers({ ...params, playerIds: [] })).resolves.toEqual({
      rows: [],
      total: 0,
      page: 1,
    });
    expect(fetchRegularPool).not.toHaveBeenCalled();
  });

  it("ranks the advanced pool for the requested range with the full params", async () => {
    const params = parsePlayersSearchParams({ tab: "advanced", range: "last5" });
    const pool = [{ id: 2 }];
    const result = { rows: [], total: 0, page: 1 };
    fetchAdvancedPool.mockResolvedValue(pool);
    rankAdvancedPlayers.mockReturnValue(result);

    await expect(searchPlayersAdvanced(params)).resolves.toBe(result);
    expect(fetchAdvancedPool).toHaveBeenCalledWith({ range: "last5" });
    expect(rankAdvancedPlayers).toHaveBeenCalledWith({ pool, args: params });
  });
});
