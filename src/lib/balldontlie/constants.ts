export const BDL_BASE_URL = "https://api.balldontlie.io/v1";

// Balldontlie's season param is the season's start year: 2025-26 → "2025".
export const SEASON_YEAR = "2025";

// "2020" → "2020-21"; the label pads the end year so 1999 → "1999-00".
export const seasonLabelFromYear = (year: number): string =>
  `${year}-${String((year + 1) % 100).padStart(2, "0")}`;

export const SEASON_LABEL = seasonLabelFromYear(Number(SEASON_YEAR));
export const SEASON_TYPE = "Regular Season";

// Historical backfill window: 2020-21 through the current season, oldest
// first so player rows finish reflecting the most recent team/position.
export const BACKFILL_START_YEAR = 2020;
export const BACKFILL_SEASON_YEARS = Array.from(
  { length: Number(SEASON_YEAR) - BACKFILL_START_YEAR + 1 },
  (_, index) => String(BACKFILL_START_YEAR + index),
);
export const PER_PAGE = "100";

// ALL-STAR tier allows 60 req/min; ~1.1s between pages keeps us safely under.
export const THROTTLE_MS = 1100;

// Free tier allows 5 req/min; 13s spacing stays safely under.
export const FREE_TIER_THROTTLE_MS = 13000;

export const getApiKey = (): string => {
  const key = process.env.BALLDONTLIE_API_KEY ?? "";
  if (key === "") {
    throw new Error("BALLDONTLIE_API_KEY is not set. Add it to .env (see .env.example).");
  }
  return key;
};
