export const YAHOO_PROVIDER = "yahoo";

export const YAHOO_LEAGUE_HOST = "basketball.fantasysports.yahoo.com";

export const YAHOO_SYNC_THROTTLE_MS = 60_000;

export const YAHOO_STALE_AFTER_MS = 900_000;

// The largest league snapshot the extension may hand over, measured as UTF-8
// JSON. A 20-team league with its waiver pages is well under it. Lives here
// because a "use server" file may export only async functions.
export const MAX_SNAPSHOT_BYTES = 1_500_000;

export {
  YAHOO_API_BASE_URL,
  YAHOO_PAGE_SIZE,
  YAHOO_MAX_WAIVER_PAGES,
} from "@vision/yahoo-bridge/constants";
