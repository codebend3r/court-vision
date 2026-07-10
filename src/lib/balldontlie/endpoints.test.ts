import { describe, expect, it, vi } from "vitest";

import { fetchAllStats, fetchTeams } from "./endpoints";

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const statRow = (id: number, playerId: number) => ({
  id,
  min: "30",
  fgm: 7,
  fga: 18,
  fg3m: 5,
  fg3a: 9,
  ftm: 4,
  fta: 4,
  oreb: 2,
  dreb: 5,
  reb: 7,
  ast: 1,
  stl: 1,
  blk: 0,
  turnover: 1,
  pts: 23,
  plus_minus: 3,
  player: { id: playerId, first_name: "Test", last_name: "Player", team_id: 10 },
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 900 + id,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 10,
    visitor_team_id: 2,
    home_team_score: 112,
    visitor_team_score: 108,
    postseason: false,
  },
});

describe("fetchTeams", () => {
  it("returns the parsed teams array", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks" }],
        meta: {},
      }),
    );
    const teams = await fetchTeams({ apiKey: "k", fetchImpl });
    expect(teams).toEqual([{ id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks" }]);
    expect(fetchImpl.mock.calls[0]?.[0]?.toString() ?? "").toContain("/teams");
  });
});

describe("fetchAllStats", () => {
  it("follows the cursor across pages, throttles, and concatenates", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [statRow(1, 10)], meta: { next_cursor: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ data: [statRow(2, 11)], meta: {} }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    const stats = await fetchAllStats({ apiKey: "k", fetchImpl, sleep });

    expect(stats).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    const firstUrl = fetchImpl.mock.calls[0]?.[0]?.toString() ?? "";
    const secondUrl = fetchImpl.mock.calls[1]?.[0]?.toString() ?? "";
    expect(firstUrl).toContain("seasons[]=2025");
    expect(firstUrl).toContain("postseason=false");
    expect(firstUrl).not.toContain("cursor=");
    expect(secondUrl).toContain("cursor=2");
  });
});
