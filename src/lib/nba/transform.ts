import { SEASON, SEASON_TYPE } from "./constants";
import { GameLogRow, PlayerIndexRow, SeasonStatsRow } from "./schemas";

export interface PlayerInput {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamId: number | null;
  teamAbbr: string | null;
  position: string | null;
  jerseyNumber: string | null;
}

export interface SeasonStatsInput {
  playerId: number;
  season: string;
  seasonType: string;
  gamesPlayed: number;
  minutes: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
}

export interface GameLogInput {
  playerId: number;
  gameId: string;
  gameDate: Date;
  season: string;
  seasonType: string;
  teamId: number;
  teamAbbr: string;
  matchup: string;
  opponentAbbr: string | null;
  homeAway: "home" | "away";
  winLoss: string | null;
  minutes: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
  plusMinus: number | null;
}

const blankToNull = (value: string | null): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

export const parseMinutes = (value: number | string): number => {
  if (typeof value === "number") {
    return value;
  }
  if (value.includes(":")) {
    const [minutes, seconds] = value.split(":");
    const parsedMinutes = Number.parseFloat(minutes);
    const parsedSeconds = Number.parseFloat(seconds);
    if (Number.isNaN(parsedMinutes) || Number.isNaN(parsedSeconds)) {
      return 0;
    }
    return parsedMinutes + parsedSeconds / 60;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const parseMatchup = (
  matchup: string,
): { homeAway: "home" | "away"; opponentAbbr: string } => {
  const away = matchup.includes(" @ ");
  const separator = away ? " @ " : " vs. ";
  const opponentAbbr = matchup.split(separator)[1]?.trim() ?? "";
  return { homeAway: away ? "away" : "home", opponentAbbr };
};

const parseGameDate = (value: string): Date => {
  if (!value.includes("T")) {
    return new Date(`${value}T00:00:00Z`);
  }
  // Treat as UTC if no timezone designator is present
  const hasTimezone = value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value);
  return hasTimezone ? new Date(value) : new Date(`${value}Z`);
};

export const toPlayerInput = (row: PlayerIndexRow): PlayerInput => ({
  id: row.PERSON_ID,
  firstName: row.PLAYER_FIRST_NAME,
  lastName: row.PLAYER_LAST_NAME,
  fullName: `${row.PLAYER_FIRST_NAME} ${row.PLAYER_LAST_NAME}`,
  teamId: row.TEAM_ID === 0 ? null : row.TEAM_ID,
  teamAbbr: blankToNull(row.TEAM_ABBREVIATION),
  position: blankToNull(row.POSITION),
  jerseyNumber: blankToNull(row.JERSEY_NUMBER),
});

export const toSeasonStatsInput = (row: SeasonStatsRow): SeasonStatsInput => ({
  playerId: row.PLAYER_ID,
  season: SEASON,
  seasonType: SEASON_TYPE,
  gamesPlayed: row.GP,
  minutes: row.MIN,
  fgm: row.FGM,
  fga: row.FGA,
  fg3m: row.FG3M,
  fg3a: row.FG3A,
  ftm: row.FTM,
  fta: row.FTA,
  oreb: row.OREB,
  dreb: row.DREB,
  reb: row.REB,
  ast: row.AST,
  stl: row.STL,
  blk: row.BLK,
  tov: row.TOV,
  pts: row.PTS,
});

export const toGameLogInput = (row: GameLogRow): GameLogInput => {
  const { homeAway, opponentAbbr } = parseMatchup(row.MATCHUP);
  return {
    playerId: row.PLAYER_ID,
    gameId: row.GAME_ID,
    gameDate: parseGameDate(row.GAME_DATE),
    season: SEASON,
    seasonType: SEASON_TYPE,
    teamId: row.TEAM_ID,
    teamAbbr: row.TEAM_ABBREVIATION,
    matchup: row.MATCHUP,
    opponentAbbr: blankToNull(opponentAbbr),
    homeAway,
    winLoss: row.WL,
    minutes: parseMinutes(row.MIN),
    fgm: row.FGM,
    fga: row.FGA,
    fg3m: row.FG3M,
    fg3a: row.FG3A,
    ftm: row.FTM,
    fta: row.FTA,
    oreb: row.OREB,
    dreb: row.DREB,
    reb: row.REB,
    ast: row.AST,
    stl: row.STL,
    blk: row.BLK,
    tov: row.TOV,
    pts: row.PTS,
    plusMinus: row.PLUS_MINUS,
  };
};
