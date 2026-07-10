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
