import { describe, expect, it } from "vitest";
import type { BdlAdvancedStat, BdlStat } from "@/lib/balldontlie/schemas";
import type { GameLogInput } from "@/lib/stats/inputs";
import {
  aggregateSeasonStats,
  deriveGameContext,
  parseHeightInches,
  parseWeightLbs,
  toAdvancedGameLogInput,
  toGameLogInput,
  toPlayerInput,
  toPlayerInputs,
} from "./transform";

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

describe("deriveGameContext", () => {
  const game = {
    id: 1,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 18,
    visitor_team_id: 2,
    home_team_score: 100,
    visitor_team_score: 110,
    postseason: false,
  };
  const teamAbbrById = new Map([
    [18, "MIN"],
    [2, "BOS"],
  ]);

  it("derives home loss", () => {
    const ctx = deriveGameContext({ game, teamId: 18, teamAbbr: "MIN", teamAbbrById });
    expect(ctx).toMatchObject({
      homeAway: "home",
      opponentAbbr: "BOS",
      winLoss: "L",
      teamScore: 100,
      opponentScore: 110,
      matchup: "MIN vs. BOS",
    });
    expect(ctx.gameDate.toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("derives away win", () => {
    const ctx = deriveGameContext({ game, teamId: 2, teamAbbr: "BOS", teamAbbrById });
    expect(ctx).toMatchObject({
      homeAway: "away",
      opponentAbbr: "MIN",
      winLoss: "W",
      teamScore: 110,
      opponentScore: 100,
      matchup: "BOS @ MIN",
    });
  });

  it("nulls the scores of an unplayed game", () => {
    const unplayed = { ...game, home_team_score: 0, visitor_team_score: 0 };
    const ctx = deriveGameContext({ game: unplayed, teamId: 18, teamAbbr: "MIN", teamAbbrById });
    expect(ctx).toMatchObject({ winLoss: null, teamScore: null, opponentScore: null });
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

  it("derives the season label from the row's game, not a constant", () => {
    const historic: BdlStat = {
      ...homeStat,
      game: { ...homeStat.game, id: 777, date: "2020-12-22", season: 2020 },
    };
    const log = toGameLogInput({ stat: historic, teamAbbrById });
    expect(log.season).toBe("2020-21");
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

  it("excludes DNP games (0 minutes) from games played", () => {
    const dnpStat: BdlStat = {
      ...awayStat,
      id: 3,
      min: "0",
      pts: 0,
      game: { ...awayStat.game, id: 18600, date: "2025-10-26" },
    };
    const logs: GameLogInput[] = [homeStat, awayStat, dnpStat].map((stat) =>
      toGameLogInput({ stat, teamAbbrById }),
    );
    const [season] = aggregateSeasonStats(logs);
    // Three logs, but the DNP does not count as a game played.
    expect(season.gamesPlayed).toBe(2);
    // Totals and minutes still include the DNP (which contributes zeros).
    expect(season.pts).toBe(49);
    expect(season.minutes).toBe(68);
  });
});

describe("aggregateSeasonStats across seasons", () => {
  it("keeps one row per player per season", () => {
    const current = toGameLogInput({ stat: homeStat, teamAbbrById });
    const historic = toGameLogInput({
      stat: {
        ...awayStat,
        game: { ...awayStat.game, id: 777, date: "2020-12-22", season: 2020 },
      },
      teamAbbrById,
    });
    const rows = aggregateSeasonStats([current, historic]);
    expect(rows).toHaveLength(2);
    const seasons = rows.map((row) => row.season).sort();
    expect(seasons).toEqual(["2020-21", "2025-26"]);
    expect(rows.every((row) => row.playerId === 115)).toBe(true);
  });
});

describe("toAdvancedGameLogInput", () => {
  const advancedStat: BdlAdvancedStat = {
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
      date: "2020-12-22",
      season: 2020,
      home_team_id: 10,
      visitor_team_id: 2,
      home_team_score: 112,
      visitor_team_score: 108,
      postseason: false,
    },
  };

  it("maps identity, season, and camel-cased metrics", () => {
    const input = toAdvancedGameLogInput({ stat: advancedStat });
    expect(input).toMatchObject({
      playerId: 115,
      gameId: "18422",
      season: "2020-21",
      seasonType: "Regular Season",
      teamId: 10,
      teamAbbr: "GSW",
      pie: 0.152,
      pace: 98.4,
      assistPercentage: 21.3,
      assistRatio: 18.9,
      assistToTurnover: 2.1,
      defensiveRating: 108.2,
      defensiveReboundPercentage: 14.5,
      effectiveFieldGoalPercentage: 0.556,
      netRating: 6.4,
      offensiveRating: 114.6,
      offensiveReboundPercentage: 3.1,
      reboundPercentage: 8.8,
      trueShootingPercentage: 0.612,
      turnoverRatio: 9.2,
      usagePercentage: 28.7,
    });
    expect(input.gameDate.toISOString()).toBe("2020-12-22T00:00:00.000Z");
  });

  it("passes null metrics through", () => {
    const input = toAdvancedGameLogInput({
      stat: { ...advancedStat, pie: null, usage_percentage: null },
    });
    expect(input.pie).toBeNull();
    expect(input.usagePercentage).toBeNull();
  });
});

describe("toPlayerInput", () => {
  it("maps a full player row", () => {
    const input = toPlayerInput({
      player: {
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
      },
    });
    expect(input).toEqual({
      id: 3547238,
      firstName: "Anthony",
      lastName: "Edwards",
      fullName: "Anthony Edwards",
      teamId: 18,
      teamAbbr: "MIN",
      position: "G",
      jerseyNumber: "5",
      heightInches: 76,
      weightLbs: 225,
      college: "Georgia",
      country: "USA",
      draftYear: 2020,
      draftRound: 1,
      draftNumber: 1,
    });
  });

  it("nulls team fields and blanks", () => {
    const input = toPlayerInput({
      player: { id: 1, first_name: "Old", last_name: "Timer", position: "", team: null },
    });
    expect(input).toMatchObject({
      teamId: null,
      teamAbbr: null,
      position: null,
      jerseyNumber: null,
    });
  });
});

describe("player measurement parsing", () => {
  it("normalizes feet/inches and pounds", () => {
    expect(parseHeightInches("6-2")).toBe(74);
    expect(parseWeightLbs("185")).toBe(185);
  });

  it("returns null for blank or malformed measurements", () => {
    expect(parseHeightInches("")).toBeNull();
    expect(parseHeightInches("6-12")).toBeNull();
    expect(parseWeightLbs("unknown")).toBeNull();
  });
});
