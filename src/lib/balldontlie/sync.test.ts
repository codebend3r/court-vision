import { describe, expect, it, vi, beforeEach } from "vitest";

import * as persist from "@/lib/stats/persist";

import * as endpoints from "@/lib/balldontlie/endpoints";
import { BdlAdvancedStat, BdlStat } from "@/lib/balldontlie/schemas";
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

const advancedRow: BdlAdvancedStat = {
  id: 50,
  pie: 0.152,
  pace: 98.4,
  assist_percentage: 21.3,
  assist_ratio: 18.9,
  assist_to_turnover: 2.1,
  defensive_rating: 108.2,
  defensive_rebound_percentage: 14.5,
  effective_field_goal_percentage: 0.556,
  net_rating: 6.4,
  offensive_rating: 114.6,
  offensive_rebound_percentage: 3.1,
  rebound_percentage: 8.8,
  true_shooting_percentage: 0.612,
  turnover_ratio: 9.2,
  usage_percentage: 28.7,
  player: statRow.player,
  team: statRow.team,
  game: statRow.game,
};

// A historical-season variant so the loop test exercises per-row season labels.
const statRow2020: BdlStat = {
  ...statRow,
  id: 2,
  game: { ...statRow.game, id: 777, date: "2020-12-22", season: 2020 },
};

const advancedRow2020: BdlAdvancedStat = {
  ...advancedRow,
  id: 51,
  game: statRow2020.game,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(endpoints, "fetchTeams").mockResolvedValue([
    { id: 10, abbreviation: "GSW", full_name: "Golden State Warriors" },
    { id: 2, abbreviation: "BOS", full_name: "Boston Celtics" },
  ]);
});

describe("syncBalldontlie", () => {
  it("fetches, transforms, persists, and returns counts for the default season", async () => {
    vi.spyOn(endpoints, "fetchAllStats").mockResolvedValue([statRow]);
    vi.spyOn(endpoints, "fetchAllAdvancedStats").mockResolvedValue([advancedRow]);
    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    const upsertGameLogs = vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(1);
    const upsertSeasonStats = vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(1);
    const upsertAdvancedGameLogs = vi.spyOn(persist, "upsertAdvancedGameLogs").mockResolvedValue(1);

    const summary = await syncBalldontlie({ deps: { apiKey: "k" } });

    expect(summary).toEqual({ players: 1, seasonStats: 1, gameLogs: 1, advancedGameLogs: 1 });
    expect(upsertPlayers).toHaveBeenCalledWith([
      expect.objectContaining({ id: 115, teamAbbr: "GSW" }),
    ]);
    expect(upsertGameLogs).toHaveBeenCalledWith([
      expect.objectContaining({ gameId: "18422", opponentAbbr: "BOS", homeAway: "home" }),
    ]);
    expect(upsertSeasonStats).toHaveBeenCalledWith([
      expect.objectContaining({ playerId: 115, gamesPlayed: 1, pts: 29 }),
    ]);
    expect(upsertAdvancedGameLogs).toHaveBeenCalledWith([
      expect.objectContaining({ playerId: 115, gameId: "18422", pie: 0.152 }),
    ]);
  });

  it("loops the requested seasons sequentially, oldest first", async () => {
    const fetchAllStats = vi
      .spyOn(endpoints, "fetchAllStats")
      .mockImplementation(async ({ season } = {}) =>
        season === "2020" ? [statRow2020] : [statRow],
      );
    const fetchAllAdvancedStats = vi
      .spyOn(endpoints, "fetchAllAdvancedStats")
      .mockImplementation(async ({ season } = {}) =>
        season === "2020" ? [advancedRow2020] : [advancedRow],
      );
    vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    const upsertGameLogs = vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(1);
    vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(1);
    const upsertAdvancedGameLogs = vi.spyOn(persist, "upsertAdvancedGameLogs").mockResolvedValue(1);

    const summary = await syncBalldontlie({
      deps: { apiKey: "k" },
      seasons: ["2020", "2025"],
    });

    // One fetch per season per endpoint, in the given order.
    expect(fetchAllStats.mock.calls.map(([args]) => args?.season)).toEqual(["2020", "2025"]);
    expect(fetchAllAdvancedStats.mock.calls.map(([args]) => args?.season)).toEqual([
      "2020",
      "2025",
    ]);
    // Each season persists its own rows stamped with its own label.
    expect(upsertGameLogs).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({ season: "2020-21" }),
    ]);
    expect(upsertGameLogs).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({ season: "2025-26" }),
    ]);
    expect(upsertAdvancedGameLogs).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({ season: "2020-21" }),
    ]);
    // Counts accumulate across seasons.
    expect(summary).toEqual({ players: 2, seasonStats: 2, gameLogs: 2, advancedGameLogs: 2 });
  });
});
