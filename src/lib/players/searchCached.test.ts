import { describe, expect, it, vi } from "bun:test";

import { parsePlayersSearchParams } from "@/lib/players/searchParams";

const searchPlayersUncached = vi.fn();
const searchPlayersAdvancedUncached = vi.fn();

// Make `unstable_cache` a pass-through so the wrappers can be exercised without
// a Next incremental cache (which is absent under bun:test); this leaves the
// delegation-to-the-real-query wiring as the thing under test.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/players/search", () => ({
  searchPlayers: searchPlayersUncached,
}));

vi.mock("@/lib/players/searchAdvanced", () => ({
  searchPlayersAdvanced: searchPlayersAdvancedUncached,
}));

// Imported after the mocks are installed, not at the top of the file: bun:test
// does not hoist `vi.mock`, and searchCached calls `unstable_cache` at module
// scope — a static import would capture the real one before the mock lands.
const { searchPlayers, searchPlayersAdvanced } = await import("@/lib/players/searchCached");

describe("searchCached", () => {
  it("delegates the regular query to searchPlayers with the same params", async () => {
    const params = parsePlayersSearchParams({});
    const result = { rows: [], total: 0, page: 1 };
    searchPlayersUncached.mockResolvedValue(result);

    await expect(searchPlayers(params)).resolves.toBe(result);
    expect(searchPlayersUncached).toHaveBeenCalledWith(params);
  });

  it("delegates the advanced query to searchPlayersAdvanced with the same params", async () => {
    const params = parsePlayersSearchParams({ tab: "advanced" });
    const result = { rows: [], total: 0, page: 1 };
    searchPlayersAdvancedUncached.mockResolvedValue(result);

    await expect(searchPlayersAdvanced(params)).resolves.toBe(result);
    expect(searchPlayersAdvancedUncached).toHaveBeenCalledWith(params);
  });
});
