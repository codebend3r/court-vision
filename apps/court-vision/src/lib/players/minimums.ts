// Official NBA percentage-leader qualifiers, by made volume: 300 FGM for FG%,
// 82 3PM for 3P%, 125 FTM for FT%. Shared by the players list's qualifying
// minimums and the player page's leaderboard ranks.
export const MIN_FGM = 300;
export const MIN_FG3M = 82;
export const MIN_FTM = 125;

// Official NBA per-game leader qualifier: appearances in 70% of an 82-game
// schedule. The players list scales it to a lastN window; the player page's
// leaderboards scale it to the season played so far.
export const SCHEDULE_GAMES = 82;
export const QUALIFYING_GAMES_SHARE = 0.7;
