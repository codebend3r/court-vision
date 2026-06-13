export const NBA_BASE_URL = "https://stats.nba.com/stats";
export const SEASON = "2025-26";
export const SEASON_TYPE = "Regular Season";
export const LEAGUE_ID = "00";

export const NBA_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
  Connection: "keep-alive",
};

export const RESULT_SET_NAMES = {
  playerIndex: "PlayerIndex",
  seasonStats: "LeagueDashPlayerStats",
  gameLogs: "PlayerGameLogs",
} as const;

// 2025–26 regular season spans Oct 2025 → Apr 2026. The game-log endpoint is
// chunked by month (NBA DateFrom/DateTo format is MM/DD/YYYY) for resilience.
export const REGULAR_SEASON_DATE_RANGES: ReadonlyArray<{ dateFrom: string; dateTo: string }> = [
  { dateFrom: "10/01/2025", dateTo: "10/31/2025" },
  { dateFrom: "11/01/2025", dateTo: "11/30/2025" },
  { dateFrom: "12/01/2025", dateTo: "12/31/2025" },
  { dateFrom: "01/01/2026", dateTo: "01/31/2026" },
  { dateFrom: "02/01/2026", dateTo: "02/28/2026" },
  { dateFrom: "03/01/2026", dateTo: "03/31/2026" },
  { dateFrom: "04/01/2026", dateTo: "04/30/2026" },
];
