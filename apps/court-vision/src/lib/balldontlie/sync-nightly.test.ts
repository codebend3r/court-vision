import { beforeEach, describe, expect, it, vi } from "bun:test";

import * as persist from "@/lib/stats/persist";

import * as endpoints from "@/lib/balldontlie/endpoints";
import { BdlAdvancedStat, BdlStat } from "@/lib/balldontlie/schemas";
import { datesFromArgv, syncNightly } from "@/lib/balldontlie/sync-nightly";

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

const playoffRow: BdlStat = {
  ...statRow,
  id: 2,
  game: { ...statRow.game, id: 39999, postseason: true },
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

// The player's season so far as stored: an earlier game plus last night's.
const storedLogs = [
  {
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
  },
  {
    playerId: 115,
    season: "2026-27",
    seasonType: "Regular Season",
    minutes: 34,
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
    tov: 3,
    pts: 29,
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(endpoints, "fetchTeams").mockResolvedValue([
    { id: 10, abbreviation: "GSW", full_name: "Golden State Warriors" },
    { id: 2, abbreviation: "BOS", full_name: "Boston Celtics" },
  ]);
});

describe("syncNightly", () => {
  it("syncs only the requested dates and rebuilds the season lines of those who played", async () => {
    const fetchAllStats = vi.spyOn(endpoints, "fetchAllStats").mockResolvedValue([statRow]);
    const fetchAllAdvancedStats = vi
      .spyOn(endpoints, "fetchAllAdvancedStats")
      .mockResolvedValue([advancedRow]);
    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    const replaceGameLogs = vi.spyOn(persist, "replaceGameLogsForGames").mockResolvedValue(1);
    const findSeasonLogs = vi
      .spyOn(persist, "findSeasonAggregateLogs")
      .mockResolvedValue(storedLogs);
    const upsertSeasonStats = vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(1);
    const replaceAdvanced = vi
      .spyOn(persist, "replaceAdvancedGameLogsForGames")
      .mockResolvedValue(1);

    const summary = await syncNightly({ dates: ["2026-10-21"], deps: { apiKey: "k" } });

    expect(summary).toEqual({
      games: 1,
      players: 1,
      gameLogs: 1,
      advancedGameLogs: 1,
      seasonStats: 1,
    });
    expect(fetchAllStats).toHaveBeenCalledWith(expect.objectContaining({ dates: ["2026-10-21"] }));
    expect(fetchAllAdvancedStats).toHaveBeenCalledWith(
      expect.objectContaining({ dates: ["2026-10-21"] }),
    );
    expect(upsertPlayers).toHaveBeenCalledWith([
      expect.objectContaining({ id: 115, teamAbbr: "GSW" }),
    ]);
    expect(replaceGameLogs).toHaveBeenCalledWith([
      expect.objectContaining({ gameId: "30001", season: "2026-27", opponentAbbr: "BOS" }),
    ]);
    expect(findSeasonLogs).toHaveBeenCalledWith({
      playerIds: [115],
      seasons: ["2026-27"],
      seasonType: "Regular Season",
    });
    // The season line sums every stored game, not just last night's.
    expect(upsertSeasonStats).toHaveBeenCalledWith([
      expect.objectContaining({ playerId: 115, gamesPlayed: 2, pts: 51, ast: 14 }),
    ]);
    expect(replaceAdvanced).toHaveBeenCalledWith([
      expect.objectContaining({ playerId: 115, gameId: "30001", pie: 0.152 }),
    ]);
  });

  it("writes nothing on a night without regular-season games", async () => {
    vi.spyOn(endpoints, "fetchAllStats").mockResolvedValue([playoffRow]);
    const fetchAllAdvancedStats = vi.spyOn(endpoints, "fetchAllAdvancedStats");
    const upsertPlayers = vi.spyOn(persist, "upsertPlayers");
    const replaceGameLogs = vi.spyOn(persist, "replaceGameLogsForGames");

    const summary = await syncNightly({ dates: ["2027-05-01"], deps: { apiKey: "k" } });

    expect(summary).toEqual({
      games: 0,
      players: 0,
      gameLogs: 0,
      advancedGameLogs: 0,
      seasonStats: 0,
    });
    expect(fetchAllAdvancedStats).not.toHaveBeenCalled();
    expect(upsertPlayers).not.toHaveBeenCalled();
    expect(replaceGameLogs).not.toHaveBeenCalled();
  });

  it("drops playoff rows so they never land in the regular-season tables", async () => {
    vi.spyOn(endpoints, "fetchAllStats").mockResolvedValue([statRow, playoffRow]);
    vi.spyOn(endpoints, "fetchAllAdvancedStats").mockResolvedValue([
      advancedRow,
      { ...advancedRow, id: 51, game: playoffRow.game },
    ]);
    vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    const replaceGameLogs = vi.spyOn(persist, "replaceGameLogsForGames").mockResolvedValue(1);
    vi.spyOn(persist, "findSeasonAggregateLogs").mockResolvedValue([]);
    vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(0);
    const replaceAdvanced = vi
      .spyOn(persist, "replaceAdvancedGameLogsForGames")
      .mockResolvedValue(1);

    await syncNightly({ dates: ["2027-04-11"], deps: { apiKey: "k" } });

    expect(replaceGameLogs).toHaveBeenCalledWith([expect.objectContaining({ gameId: "30001" })]);
    expect(replaceAdvanced).toHaveBeenCalledWith([expect.objectContaining({ gameId: "30001" })]);
  });
});

describe("datesFromArgv", () => {
  // 03:00 Eastern (EDT) on 2026-10-22.
  const now = new Date("2026-10-22T07:00:00Z");

  it("defaults to last night in New York", () => {
    expect(datesFromArgv({ argv: [], now })).toEqual(["2026-10-21"]);
  });

  it("takes repeated --date flags, sorted and de-duplicated", () => {
    expect(
      datesFromArgv({
        argv: ["--date", "2026-10-21", "--date", "2026-10-20", "--date", "2026-10-21"],
        now,
      }),
    ).toEqual(["2026-10-20", "2026-10-21"]);
  });

  it("expands --from and --to into every date between", () => {
    expect(datesFromArgv({ argv: ["--from", "2026-10-19", "--to", "2026-10-21"], now })).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
    ]);
  });

  it("runs --from through last night when --to is left out", () => {
    expect(datesFromArgv({ argv: ["--from", "2026-10-20"], now })).toEqual([
      "2026-10-20",
      "2026-10-21",
    ]);
  });

  it("rejects a malformed date", () => {
    expect(() => datesFromArgv({ argv: ["--date", "10/21/2026"], now })).toThrow("YYYY-MM-DD");
  });

  it("rejects a flag with no value", () => {
    expect(() => datesFromArgv({ argv: ["--date"], now })).toThrow("YYYY-MM-DD");
  });

  it("rejects --to without --from", () => {
    expect(() => datesFromArgv({ argv: ["--to", "2026-10-21"], now })).toThrow("--from");
  });

  it("rejects an unknown argument instead of silently syncing last night", () => {
    expect(() => datesFromArgv({ argv: ["2026-10-21"], now })).toThrow("Unknown argument");
  });

  it("refuses a window wider than the nightly sync is meant for", () => {
    expect(() =>
      datesFromArgv({ argv: ["--from", "2026-01-01", "--to", "2026-03-01"], now }),
    ).toThrow("sync:bdl");
  });
});
