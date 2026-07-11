export const BDL_BASE_URL = "https://api.balldontlie.io/v1";

// Balldontlie's season param is the season's start year: 2025-26 → "2025".
export const SEASON_YEAR = "2025";
export const SEASON_LABEL = "2025-26";
export const SEASON_TYPE = "Regular Season";
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
