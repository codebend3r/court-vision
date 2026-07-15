import { describe, expect, it, vi } from "vitest";

import { searchPlayers as searchPlayersUncached } from "@/lib/players/search";
import { searchPlayersAdvanced as searchPlayersAdvancedUncached } from "@/lib/players/searchAdvanced";
import { searchPlayers, searchPlayersAdvanced } from "@/lib/players/searchCached";
import { parsePlayersSearchParams } from "@/lib/players/searchParams";

// Make `unstable_cache` a pass-through so the wrappers can be exercised without
// a Next incremental cache (which is absent under vitest); this leaves the
// delegation-to-the-real-query wiring as the thing under test.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/players/search", () => ({
  searchPlayers: vi.fn(),
}));

vi.mock("@/lib/players/searchAdvanced", () => ({
  searchPlayersAdvanced: vi.fn(),
}));

describe("searchCached", () => {
  it("delegates the regular query to searchPlayers with the same params", async () => {
    const params = parsePlayersSearchParams({});
    const result = { rows: [], total: 0, page: 1 };
    vi.mocked(searchPlayersUncached).mockResolvedValue(result);

    await expect(searchPlayers(params)).resolves.toBe(result);
    expect(searchPlayersUncached).toHaveBeenCalledWith(params);
  });

  it("delegates the advanced query to searchPlayersAdvanced with the same params", async () => {
    const params = parsePlayersSearchParams({ tab: "advanced" });
    const result = { rows: [], total: 0, page: 1 };
    vi.mocked(searchPlayersAdvancedUncached).mockResolvedValue(result);

    await expect(searchPlayersAdvanced(params)).resolves.toBe(result);
    expect(searchPlayersAdvancedUncached).toHaveBeenCalledWith(params);
  });
});
