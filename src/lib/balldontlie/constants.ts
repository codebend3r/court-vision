export const BDL_BASE_URL = "https://api.balldontlie.io/v1";

// Balldontlie's season param is the season's start year: 2025-26 → "2025".
export const SEASON_YEAR = "2025";

// "2020" → "2020-21"; the label pads the end year so 1999 → "1999-00".
export const seasonLabelFromYear = (year: number): string =>
  `${year}-${String((year + 1) % 100).padStart(2, "0")}`;

export const SEASON_LABEL = seasonLabelFromYear(Number(SEASON_YEAR));
export const SEASON_TYPE = "Regular Season";

// Historical backfill window: 2016-17 through the current season, oldest
// first so player rows finish reflecting the most recent team/position.
// 2016 is a choice, not an API limit — Balldontlie serves box scores back to
// 1946-47 and advanced stats back to 1996-97. Going below 1979-80 would need
// nullable era-gated columns, because a stored 0 for `stl` there would mean
// "the league did not record steals" and the valuation engine would score it
// as a real zero.
export const BACKFILL_START_YEAR = 2016;
export const BACKFILL_SEASON_YEARS = Array.from(
  { length: Number(SEASON_YEAR) - BACKFILL_START_YEAR + 1 },
  (_, index) => String(BACKFILL_START_YEAR + index),
);
export const PER_PAGE = "100";

// The key's live response headers report `x-ratelimit-limit: 600` (10 req/s),
// so 1100ms (~55 req/min) is a deliberately conservative pace rather than the
// ceiling. `bdlFetch` honours `Retry-After` on 429 if that ever tightens.
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
