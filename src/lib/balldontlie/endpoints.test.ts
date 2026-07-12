import { describe, expect, it, vi } from "vitest";

import { fetchAllStats, fetchTeams } from "@/lib/balldontlie/endpoints";

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

  it("succeeds when the response has no meta key at all", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks" }],
      }),
    );
    const teams = await fetchTeams({ apiKey: "k", fetchImpl });
    expect(teams).toEqual([{ id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks" }]);
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

  it("reports per-page progress through onPage", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [statRow(1, 10)], meta: { next_cursor: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ data: [statRow(2, 11)], meta: {} }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const onPage = vi.fn();

    await fetchAllStats({ apiKey: "k", fetchImpl, sleep, onPage });

    expect(onPage).toHaveBeenCalledTimes(2);
    expect(onPage).toHaveBeenNthCalledWith(1, {
      endpoint: "stats",
      page: 1,
      pageRows: 1,
      totalRows: 1,
      nextCursor: 2,
    });
    expect(onPage).toHaveBeenNthCalledWith(2, {
      endpoint: "stats",
      page: 2,
      pageRows: 1,
      totalRows: 2,
      nextCursor: null,
    });
  });
});

describe("fetchAllPlayers", () => {
  const playerRow = {
    id: 3547238,
    first_name: "Anthony",
    last_name: "Edwards",
    position: "G",
    jersey_number: "5",
    height: "6-4",
    weight: "225",
    college: "Georgia",
    country: "USA",
    draft_year: 2020,
    draft_round: 1,
    draft_number: 1,
    team: { id: 18, abbreviation: "MIN" },
  };

  it("paginates with cursor until next_cursor is null and honors throttleMs", async () => {
    const pageOne = { data: [playerRow], meta: { next_cursor: 25, per_page: 100 } };
    const pageTwo = { data: [{ ...playerRow, id: 2, team: null }], meta: { next_cursor: null } };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(pageOne))
      .mockResolvedValueOnce(jsonResponse(pageTwo));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    const { fetchAllPlayers } = await import("./endpoints");
    const players = await fetchAllPlayers({
      deps: { fetchImpl, sleep, apiKey: "k" },
      throttleMs: 13000,
    });

    expect(players).toHaveLength(2);
    expect(fetchImpl.mock.calls[0]?.[0]?.toString() ?? "").toContain("/players?per_page=100");
    expect(fetchImpl.mock.calls[1]?.[0]?.toString() ?? "").toContain("cursor=25");
    expect(sleep).toHaveBeenCalledWith(13000);
  });

  it("reports player pagination progress", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: [playerRow], meta: { next_cursor: null } }));
    const onPage = vi.fn();

    const { fetchAllPlayers } = await import("./endpoints");
    await fetchAllPlayers({ deps: { fetchImpl, apiKey: "k", onPage } });

    expect(onPage).toHaveBeenCalledWith({
      endpoint: "players",
      page: 1,
      pageRows: 1,
      totalRows: 1,
      nextCursor: null,
    });
  });

  it("rejects rows that fail the player schema", async () => {
    const bad = { data: [{ id: "nope" }], meta: { next_cursor: null } };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(bad));

    const { fetchAllPlayers } = await import("./endpoints");
    await expect(fetchAllPlayers({ deps: { fetchImpl, apiKey: "k" } })).rejects.toThrow();
  });

  it("rejects a page response missing meta entirely, instead of silently stopping pagination", async () => {
    const noMeta = { data: [playerRow] };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(noMeta));

    const { fetchAllPlayers } = await import("./endpoints");
    await expect(fetchAllPlayers({ deps: { fetchImpl, apiKey: "k" } })).rejects.toThrow();
  });
});

describe("fetchTeamGames", () => {
  it("requests the team season schedule, paginates, and flattens nested team objects", async () => {
    const gameRow = {
      id: 18422,
      date: "2025-10-22",
      season: 2025,
      postseason: false,
      home_team_score: 112,
      visitor_team_score: 108,
      status: "Final",
      home_team: { id: 18, abbreviation: "MIN" },
      visitor_team: { id: 2, abbreviation: "BOS" },
    };
    const expectedGame = {
      id: 18422,
      date: "2025-10-22",
      season: 2025,
      home_team_id: 18,
      visitor_team_id: 2,
      home_team_score: 112,
      visitor_team_score: 108,
      postseason: false,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [gameRow], meta: { next_cursor: null } })),
      );
    const { fetchTeamGames } = await import("./endpoints");
    const games = await fetchTeamGames({ teamId: 18, deps: { fetchImpl, apiKey: "k" } });
    expect(games).toEqual([expectedGame]);
    const url = fetchImpl.mock.calls[0][0];
    expect(url).toContain("/games?");
    expect(url).toContain("seasons[]=2025");
    expect(url).toContain("team_ids[]=18");
    expect(url).toContain("postseason=false");
  });
});
