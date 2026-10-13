export const BDL_BASE_URL = "https://api.balldontlie.io/v1";

export const PER_PAGE = "100";

// The key's live response headers report `x-ratelimit-limit: 600` (10 req/s),
// so 1100ms (~55 req/min) is a deliberately conservative pace rather than the
// ceiling. `bdlFetch` honours `Retry-After` on 429 if that ever tightens.
export const THROTTLE_MS = 1100;

export const getApiKey = (): string => {
  const key = process.env.BALLDONTLIE_API_KEY ?? "";
  if (key === "") {
    throw new Error("BALLDONTLIE_API_KEY is not set. Add it to .env (see .env.example).");
  }
  return key;
};
