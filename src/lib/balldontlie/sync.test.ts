import { describe, expect, it, vi } from "vitest";

import * as persist from "@/lib/stats/persist";

import * as endpoints from "@/lib/balldontlie/endpoints";
import { BdlStat } from "@/lib/balldontlie/schemas";
import { syncBalldontlie } from "@/lib/balldontlie/sync";

const statRow: BdlStat = {
  id: 1,
  min: "34",
  fgm: 10,
  fga: 20,
  fg3m: 5,
  fg3a: 11,
  ftm: 4,
  fta: 4,
  oreb: 1,
  dreb: 4,
  reb: 5,
  ast: 8,
  stl: 2,
  blk: 0,
  turnover: 3,
  pts: 29,
  plus_minus: 12,
  player: {
    id: 115,
    first_name: "Stephen",
    last_name: "Curry",
    position: "G",
    jersey_number: "30",
    team_id: 10,
  },
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 18422,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 10,
    visitor_team_id: 2,
    home_team_score: 112,
    visitor_team_score: 108,
    postseason: false,
  },
};

describe("syncBalldontlie", () => {
  it("fetches, transforms, persists, and returns counts", async () => {
    vi.spyOn(endpoints, "fetchTeams").mockResolvedValue([
      { id: 10, abbreviation: "GSW", full_name: "Golden State Warriors" },
      { id: 2, abbreviation: "BOS", full_name: "Boston Celtics" },
    ]);
    vi.spyOn(endpoints, "fetchAllStats").mockResolvedValue([statRow]);
    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    const upsertGameLogs = vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(1);
    const upsertSeasonStats = vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(1);

    const summary = await syncBalldontlie({ apiKey: "k" });

    expect(summary).toEqual({ players: 1, seasonStats: 1, gameLogs: 1 });
    expect(upsertPlayers).toHaveBeenCalledWith([
      expect.objectContaining({ id: 115, teamAbbr: "GSW" }),
    ]);
    expect(upsertGameLogs).toHaveBeenCalledWith([
      expect.objectContaining({ gameId: "18422", opponentAbbr: "BOS", homeAway: "home" }),
    ]);
    expect(upsertSeasonStats).toHaveBeenCalledWith([
      expect.objectContaining({ playerId: 115, gamesPlayed: 1, pts: 29 }),
    ]);
  });
});
