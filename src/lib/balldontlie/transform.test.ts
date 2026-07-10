import { describe, expect, it } from "vitest";

import { GameLogInput } from "@/lib/stats/inputs";

import { aggregateSeasonStats, toGameLogInput, toPlayerInputs } from "./transform";
import { BdlStat } from "./schemas";

const teamAbbrById = new Map<number, string>([
  [10, "GSW"],
  [2, "BOS"],
]);

const homeStat: BdlStat = {
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

// Player's team (10) is the visitor and loses → away loss.
const awayStat: BdlStat = {
  ...homeStat,
  id: 2,
  pts: 20,
  plus_minus: -5,
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 18500,
    date: "2025-10-24",
    season: 2025,
    home_team_id: 2,
    visitor_team_id: 10,
    home_team_score: 101,
    visitor_team_score: 99,
    postseason: false,
  },
};

describe("toPlayerInputs", () => {
  it("dedupes players by id and resolves team abbreviation", () => {
    const players = toPlayerInputs([homeStat, { ...homeStat, id: 99 }], teamAbbrById);
    expect(players).toHaveLength(1);
    expect(players[0]).toEqual({
      id: 115,
      firstName: "Stephen",
      lastName: "Curry",
      fullName: "Stephen Curry",
      teamId: 10,
      teamAbbr: "GSW",
      position: "G",
      jerseyNumber: "30",
    });
  });

  it("nulls a missing team and blank identity strings", () => {
    const orphan: BdlStat = {
      ...homeStat,
      player: { id: 7, first_name: "Free", last_name: "Agent", position: "", jersey_number: null },
    };
    const [player] = toPlayerInputs([orphan], teamAbbrById);
    expect(player.teamId).toBeNull();
    expect(player.teamAbbr).toBeNull();
    expect(player.position).toBeNull();
    expect(player.jerseyNumber).toBeNull();
  });
});

describe("toGameLogInput", () => {
  it("derives a home win", () => {
    const log = toGameLogInput({ stat: homeStat, teamAbbrById });
    expect(log).toMatchObject({
      playerId: 115,
      gameId: "18422",
      season: "2025-26",
      seasonType: "Regular Season",
      teamId: 10,
      teamAbbr: "GSW",
      opponentAbbr: "BOS",
      matchup: "GSW vs. BOS",
      homeAway: "home",
      winLoss: "W",
      minutes: 34,
      tov: 3,
      pts: 29,
      plusMinus: 12,
    });
    expect(log.gameDate.toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("derives an away loss", () => {
    const log = toGameLogInput({ stat: awayStat, teamAbbrById });
    expect(log.homeAway).toBe("away");
    expect(log.opponentAbbr).toBe("BOS");
    expect(log.matchup).toBe("GSW @ BOS");
    expect(log.winLoss).toBe("L");
  });
});

describe("aggregateSeasonStats", () => {
  it("sums counting stats and counts games played per player", () => {
    const logs: GameLogInput[] = [homeStat, awayStat].map((stat) =>
      toGameLogInput({ stat, teamAbbrById }),
    );
    const [season] = aggregateSeasonStats(logs);
    expect(season).toMatchObject({
      playerId: 115,
      season: "2025-26",
      seasonType: "Regular Season",
      gamesPlayed: 2,
      pts: 49,
      tov: 6,
      minutes: 68,
    });
  });
});
