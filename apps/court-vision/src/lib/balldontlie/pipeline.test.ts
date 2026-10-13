import { beforeEach, describe, expect, it, vi } from "bun:test";

import type { Logger } from "@vision/core/util/logger";

import type { SeasonAggregateLog } from "@/lib/stats/inputs";
import * as persist from "@/lib/stats/persist";

import * as endpoints from "@/lib/balldontlie/endpoints";
import {
  type BoxScoreWriters,
  fetchTeamAbbrById,
  writeBoxScores,
} from "@/lib/balldontlie/pipeline";
import { BdlAdvancedStat, BdlStat } from "@/lib/balldontlie/schemas";

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
  player: { id: 115, first_name: "Stephen", last_name: "Curry", team_id: 10 },
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 30001,
    date: "2026-10-21",
    season: 2026,
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

const teamAbbrById = new Map<number, string>([
  [10, "GSW"],
  [2, "BOS"],
]);

// An earlier stored game, so a season line summed from it differs from one
// summed from last night's log alone.
const storedLog: SeasonAggregateLog = {
  playerId: 115,
  season: "2026-27",
  seasonType: "Regular Season",
  minutes: 30,
  fgm: 8,
  fga: 16,
  fg3m: 4,
  fg3a: 9,
  ftm: 2,
  fta: 2,
  oreb: 0,
  dreb: 3,
  reb: 3,
  ast: 6,
  stl: 1,
  blk: 0,
  tov: 2,
  pts: 22,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchTeamAbbrById", () => {
  it("maps every team id to its abbreviation", async () => {
    const fetchTeams = vi.spyOn(endpoints, "fetchTeams").mockResolvedValue([
      { id: 10, abbreviation: "GSW", full_name: "Golden State Warriors" },
      { id: 2, abbreviation: "BOS", full_name: "Boston Celtics" },
    ]);

    const byId = await fetchTeamAbbrById({ deps: { apiKey: "k" } });

    expect(byId).toEqual(teamAbbrById);
    expect(fetchTeams).toHaveBeenCalledWith({ deps: { apiKey: "k" } });
  });
});

describe("writeBoxScores", () => {
  it("writes players, game logs, season lines, then advanced logs, and counts each", async () => {
    const order: string[] = [];
    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockImplementation(async () => {
      order.push("players");
      return 1;
    });
    const upsertSeasonStats = vi
      .spyOn(persist, "upsertSeasonStats")
      .mockImplementation(async () => {
        order.push("seasonStats");
        return 1;
      });
    const gameLogs = vi.fn<BoxScoreWriters["gameLogs"]>(async () => {
      order.push("gameLogs");
      return 1;
    });
    const advancedGameLogs = vi.fn<BoxScoreWriters["advancedGameLogs"]>(async () => {
      order.push("advancedGameLogs");
      return 1;
    });
    const seasonLogs = vi.fn<BoxScoreWriters["seasonLogs"]>(async ({ gameLogs: logs }) => [
      storedLog,
      ...logs,
    ]);

    const summary = await writeBoxScores({
      stats: [statRow],
      advanced: [advancedRow],
      teamAbbrById,
      writers: { gameLogs, advancedGameLogs, seasonLogs },
      logger: vi.fn<Logger>(),
    });

    expect(summary).toEqual({ players: 1, gameLogs: 1, seasonStats: 1, advancedGameLogs: 1 });
    expect(order).toEqual(["players", "gameLogs", "seasonStats", "advancedGameLogs"]);
    expect(upsertPlayers).toHaveBeenCalledWith({
      players: [expect.objectContaining({ id: 115, teamAbbr: "GSW" })],
    });
    expect(gameLogs).toHaveBeenCalledWith({
      rows: [expect.objectContaining({ gameId: "30001", opponentAbbr: "BOS" })],
    });
    // The season line sums whatever the writer reads back, not just the batch.
    expect(upsertSeasonStats).toHaveBeenCalledWith({
      rows: [expect.objectContaining({ playerId: 115, gamesPlayed: 2, pts: 51 })],
    });
    expect(advancedGameLogs).toHaveBeenCalledWith({
      rows: [expect.objectContaining({ gameId: "30001", pie: 0.152 })],
    });
  });
});
