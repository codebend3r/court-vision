import { beforeEach, describe, expect, it, vi } from "bun:test";

import { type BdlStanding } from "@/lib/balldontlie/schemas";

const fetchStandings = vi.fn<() => Promise<BdlStanding[]>>();

// A pass-through: bun:test has no Next incremental cache, so wrapping would
// only fail. The double is still a spy because the cache key, revalidate
// window and tag are part of what this module exists to declare.
const unstableCache = vi.fn((fn: unknown) => fn);

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));

vi.mock("@/lib/balldontlie/endpoints", () => ({ fetchStandings }));

// Imported after the mocks are installed, not at the top of the file: bun:test
// does not hoist `vi.mock`, and loader.ts calls `unstable_cache` at module
// scope — a static import would capture the real one before the mock lands.
const { getConferenceStandings } = await import("@/lib/standings/loader");

const standing = ({
  id,
  conference,
  rank,
  wins,
}: {
  id: number;
  conference: string;
  rank: number;
  wins: number;
}): BdlStanding => ({
  team: {
    id,
    conference,
    abbreviation: `T${id}`,
    full_name: `Team ${id}`,
  },
  conference_rank: rank,
  wins,
  losses: 82 - wins,
  season: 2025,
});

// `unstableCache` is deliberately left unreset: it records a module-scope call
// that happened once at import and cannot be replayed.
beforeEach(() => {
  fetchStandings.mockReset();
});

describe("getConferenceStandings", () => {
  it("groups the fetched rows into east and west ladders", async () => {
    fetchStandings.mockResolvedValue([
      standing({ id: 1, conference: "East", rank: 2, wins: 50 }),
      standing({ id: 2, conference: "West", rank: 1, wins: 60 }),
      standing({ id: 3, conference: "East", rank: 1, wins: 55 }),
    ]);

    const result = await getConferenceStandings();

    expect(result?.east.map((team) => team.teamId)).toEqual([3, 1]);
    expect(result?.west.map((team) => team.teamId)).toEqual([2]);
  });

  it("returns null instead of throwing when the standings fetch fails", async () => {
    fetchStandings.mockRejectedValue(new Error("balldontlie is down"));

    await expect(getConferenceStandings()).resolves.toBeNull();
  });

  it("does not cache the failure, so the next load retries the fetch", async () => {
    fetchStandings.mockRejectedValueOnce(new Error("balldontlie is down"));
    fetchStandings.mockResolvedValueOnce([
      standing({ id: 1, conference: "East", rank: 1, wins: 50 }),
    ]);

    await expect(getConferenceStandings()).resolves.toBeNull();

    const retried = await getConferenceStandings();

    expect(retried?.east.map((team) => team.teamId)).toEqual([1]);
    expect(fetchStandings).toHaveBeenCalledTimes(2);
  });

  it("registers the cache under the homepage key with an hourly revalidate", () => {
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ["home:standings"], {
      revalidate: 3600,
      tags: ["standings"],
    });
  });
});
