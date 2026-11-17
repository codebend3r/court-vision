export type PlayerInput = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamId: number | null;
  teamAbbr: string | null;
  position: string | null;
  jerseyNumber: string | null;
  heightInches?: number | null;
  weightLbs?: number | null;
  birthDate?: Date | null;
  college?: string | null;
  country?: string | null;
  draftYear?: number | null;
  draftRound?: number | null;
  draftNumber?: number | null;
};

// The box-score fields a season line sums from its game logs, in one list: the
// season-stats row, the stored logs the nightly sync re-reads, and the
// aggregation all derive their shape from it.
export const SEASON_SUM_KEYS = [
  "minutes",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
  "oreb",
  "dreb",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "pts",
] as const;

export type SeasonSumKey = (typeof SEASON_SUM_KEYS)[number];

type SeasonScope = { playerId: number; season: string; seasonType: string };

export type SeasonStatsInput = SeasonScope & { gamesPlayed: number } & Record<SeasonSumKey, number>;

export type AdvancedGameLogInput = {
  playerId: number;
  gameId: string;
  gameDate: Date;
  season: string;
  seasonType: string;
  teamId: number;
  teamAbbr: string;
  pie: number | null;
  pace: number | null;
  assistPercentage: number | null;
  assistRatio: number | null;
  assistToTurnover: number | null;
  defensiveRating: number | null;
  defensiveReboundPercentage: number | null;
  effectiveFieldGoalPercentage: number | null;
  netRating: number | null;
  offensiveRating: number | null;
  offensiveReboundPercentage: number | null;
  reboundPercentage: number | null;
  trueShootingPercentage: number | null;
  turnoverRatio: number | null;
  usagePercentage: number | null;
};

export type GameLogInput = {
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
  teamScore: number | null;
  opponentScore: number | null;
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
};

// The fields a season line is summed from. Both a fresh GameLogInput and a
// PlayerGameLog row read back from the database fit it, so the nightly sync
// can re-aggregate a player's season from stored logs.
export type SeasonAggregateLog = Pick<GameLogInput, keyof SeasonScope | SeasonSumKey>;
