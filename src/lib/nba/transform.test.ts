import { describe, expect, it } from "vitest";

import { parseMatchup, toGameLogInput, toPlayerInput, toSeasonStatsInput } from "./transform";

describe("parseMatchup", () => {
  it("detects a home game", () => {
    expect(parseMatchup("GSW vs. LAL")).toEqual({ homeAway: "home", opponentAbbr: "LAL" });
  });

  it("detects an away game", () => {
    expect(parseMatchup("BOS @ NYK")).toEqual({ homeAway: "away", opponentAbbr: "NYK" });
  });
});

describe("toPlayerInput", () => {
  it("maps identity fields and builds fullName", () => {
    expect(
      toPlayerInput({
        PERSON_ID: 1629029,
        PLAYER_FIRST_NAME: "Luka",
        PLAYER_LAST_NAME: "Doncic",
        TEAM_ID: 1610612747,
        TEAM_ABBREVIATION: "LAL",
        POSITION: "G-F",
        JERSEY_NUMBER: "77",
      }),
    ).toEqual({
      id: 1629029,
      firstName: "Luka",
      lastName: "Doncic",
      fullName: "Luka Doncic",
      teamId: 1610612747,
      teamAbbr: "LAL",
      position: "G-F",
      jerseyNumber: "77",
    });
  });

  it("nulls a zero team id and blank strings", () => {
    const input = toPlayerInput({
      PERSON_ID: 1,
      PLAYER_FIRST_NAME: "Free",
      PLAYER_LAST_NAME: "Agent",
      TEAM_ID: 0,
      TEAM_ABBREVIATION: null,
      POSITION: "",
      JERSEY_NUMBER: null,
    });
    expect(input.teamId).toBeNull();
    expect(input.teamAbbr).toBeNull();
    expect(input.position).toBeNull();
    expect(input.jerseyNumber).toBeNull();
  });
});

describe("toSeasonStatsInput", () => {
  it("maps totals and stamps season/type", () => {
    const input = toSeasonStatsInput({
      PLAYER_ID: 201939,
      GP: 70,
      MIN: 2400,
      FGM: 600,
      FGA: 1200,
      FG3M: 300,
      FG3A: 700,
      FTM: 200,
      FTA: 220,
      OREB: 50,
      DREB: 300,
      REB: 350,
      AST: 450,
      STL: 90,
      BLK: 20,
      TOV: 200,
      PTS: 1700,
    });
    expect(input).toMatchObject({
      playerId: 201939,
      season: "2025-26",
      seasonType: "Regular Season",
      gamesPlayed: 70,
      minutes: 2400,
      pts: 1700,
      tov: 200,
    });
  });
});

describe("toGameLogInput", () => {
  it("maps a box score and derives matchup + date", () => {
    const input = toGameLogInput({
      PLAYER_ID: 201939,
      GAME_ID: "0022500001",
      GAME_DATE: "2025-10-22T00:00:00",
      TEAM_ID: 1610612744,
      TEAM_ABBREVIATION: "GSW",
      MATCHUP: "GSW vs. LAL",
      WL: "W",
      MIN: 34,
      FGM: 10,
      FGA: 20,
      FG3M: 5,
      FG3A: 11,
      FTM: 4,
      FTA: 4,
      OREB: 1,
      DREB: 4,
      REB: 5,
      AST: 8,
      STL: 2,
      BLK: 0,
      TOV: 3,
      PTS: 29,
      PLUS_MINUS: 12,
    });
    expect(input).toMatchObject({
      playerId: 201939,
      gameId: "0022500001",
      season: "2025-26",
      seasonType: "Regular Season",
      teamAbbr: "GSW",
      opponentAbbr: "LAL",
      homeAway: "home",
      winLoss: "W",
      minutes: 34,
      pts: 29,
      plusMinus: 12,
    });
    expect(input.gameDate.toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("parses a date-only GAME_DATE as UTC midnight", () => {
    const input = toGameLogInput({
      PLAYER_ID: 1,
      GAME_ID: "0022500002",
      GAME_DATE: "2025-10-23",
      TEAM_ID: 1,
      TEAM_ABBREVIATION: "BOS",
      MATCHUP: "BOS @ NYK",
      WL: null,
      MIN: "30:00",
      FGM: 0,
      FGA: 0,
      FG3M: 0,
      FG3A: 0,
      FTM: 0,
      FTA: 0,
      OREB: 0,
      DREB: 0,
      REB: 0,
      AST: 0,
      STL: 0,
      BLK: 0,
      TOV: 0,
      PTS: 0,
      PLUS_MINUS: null,
    });
    expect(input.gameDate.toISOString()).toBe("2025-10-23T00:00:00.000Z");
    expect(input.opponentAbbr).toBe("NYK");
    expect(input.homeAway).toBe("away");
    expect(input.winLoss).toBeNull();
    expect(input.plusMinus).toBeNull();
  });
});
