import { GameLogInput, PlayerInput, SeasonStatsInput } from "@/lib/stats/inputs";
import { parseGameDate, parseMinutes } from "@/lib/stats/parse";

import { SEASON, SEASON_TYPE } from "@/lib/nba/constants";
import { GameLogRow, PlayerIndexRow, SeasonStatsRow } from "@/lib/nba/schemas";

const blankToNull = (value: string | null): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

export const parseMatchup = (
  matchup: string,
): { homeAway: "home" | "away"; opponentAbbr: string } => {
  const away = matchup.includes(" @ ");
  const separator = away ? " @ " : " vs. ";
  const opponentAbbr = matchup.split(separator)[1]?.trim() ?? "";
  return { homeAway: away ? "away" : "home", opponentAbbr };
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
