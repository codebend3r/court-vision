import { beforeEach, describe, expect, it, vi } from "bun:test";

import type { PlayerSeasonStats } from "@generated/prisma/client";

const findMany = vi.fn<() => Promise<PlayerSeasonStats[]>>();

// A pass-through: bun:test has no Next incremental cache. The double is still
// a spy because the cache key, revalidate window and tag are part of what this
// module exists to declare.
const unstableCache = vi.fn((fn: unknown) => fn);

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));

vi.mock("@/lib/prisma", () => ({ prisma: { playerSeasonStats: { findMany } } }));

// Imported after the mocks are installed, not at the top of the file: bun:test
// does not hoist `vi.mock`, and seasonPool.ts calls `unstable_cache` at module
// scope — a static import would capture the real one before the mock lands.
const { getSeasonStatsPool } = await import("@/lib/players/seasonPool");

// `unstableCache` is deliberately left unreset: it records a module-scope call
// that happened once at import and cannot be replayed.
beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe("getSeasonStatsPool", () => {
  it("reads the whole pool for the requested season and type", async () => {
    await getSeasonStatsPool({ season: "2025-26", seasonType: "Regular Season" });

    expect(findMany).toHaveBeenCalledWith({
      where: { season: "2025-26", seasonType: "Regular Season" },
    });
  });

  it("passes the rows straight back to the caller", async () => {
    const rows: PlayerSeasonStats[] = [];
    findMany.mockResolvedValue(rows);

    await expect(
      getSeasonStatsPool({ season: "2024-25", seasonType: "Regular Season" }),
    ).resolves.toBe(rows);
  });

  it("registers the cache under the players tag so a sync can bust it", () => {
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ["players:season-pool"], {
      revalidate: 300,
      tags: ["players"],
    });
  });
});
