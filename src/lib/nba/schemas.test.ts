import { describe, expect, it } from "vitest";

import { gameLogRowSchema, playerIndexRowSchema, seasonStatsRowSchema } from "./schemas";

describe("playerIndexRowSchema", () => {
  it("parses a valid identity row", () => {
    const row = playerIndexRowSchema.parse({
      PERSON_ID: 1629029,
      PLAYER_FIRST_NAME: "Luka",
      PLAYER_LAST_NAME: "Doncic",
      TEAM_ID: 1610612747,
      TEAM_ABBREVIATION: "LAL",
      POSITION: "G-F",
      JERSEY_NUMBER: "77",
    });
    expect(row.PERSON_ID).toBe(1629029);
  });

  it("allows null team/jersey for free agents", () => {
    const row = playerIndexRowSchema.parse({
      PERSON_ID: 1,
      PLAYER_FIRST_NAME: "Free",
      PLAYER_LAST_NAME: "Agent",
      TEAM_ID: 0,
      TEAM_ABBREVIATION: null,
      POSITION: "",
      JERSEY_NUMBER: null,
    });
    expect(row.TEAM_ABBREVIATION).toBeNull();
  });

  it("rejects a row missing PERSON_ID", () => {
    expect(() => playerIndexRowSchema.parse({ PLAYER_FIRST_NAME: "x" })).toThrow();
  });
});

describe("seasonStatsRowSchema", () => {
  it("parses a totals row", () => {
    const row = seasonStatsRowSchema.parse({
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
    expect(row.PTS).toBe(1700);
  });
});

describe("gameLogRowSchema", () => {
  it("parses a game-log row with numeric minutes", () => {
    const row = gameLogRowSchema.parse({
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
    expect(row.MIN).toBe(34);
  });

  it("accepts string minutes and null plus-minus", () => {
    const row = gameLogRowSchema.parse({
      PLAYER_ID: 1,
      GAME_ID: "0022500002",
      GAME_DATE: "2025-10-23",
      TEAM_ID: 1,
      TEAM_ABBREVIATION: "BOS",
      MATCHUP: "BOS @ NYK",
      WL: null,
      MIN: "34:30",
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
    expect(row.MIN).toBe("34:30");
    expect(row.PLUS_MINUS).toBeNull();
  });
});
