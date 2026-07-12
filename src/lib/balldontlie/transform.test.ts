import { describe, expect, it } from "vitest";

import { GameLogInput } from "@/lib/stats/inputs";

import {
  aggregateSeasonStats,
  parseHeightInches,
  parseWeightLbs,
  toGameLogInput,
  toPlayerInputs,
  toPlayerInput,
  deriveGameContext,
} from "./transform";
import { BdlStat } from "@/lib/balldontlie/schemas";

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
