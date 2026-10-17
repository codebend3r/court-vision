import type { FetchImpl } from "@vision/core/util/fetchImpl";
import {
  YAHOO_API_BASE_URL,
  YAHOO_MAX_WAIVER_PAGES,
  YAHOO_PAGE_SIZE,
} from "@vision/yahoo-bridge/constants";
import type { BridgeLeaguePayload } from "@vision/yahoo-bridge/protocol";

export type LeagueFetchResult =
  | { type: "league"; payload: BridgeLeaguePayload }
  | { type: "error"; reason: "logged_out" | "not_found" | "unavailable" };

type LeagueFetchError = Extract<LeagueFetchResult, { type: "error" }>;

// One request's outcome. Only a JSON body is kept; Yahoo's cookies stay in the
// browser and never reach the payload.
type RequestOutcome =
  | { type: "body"; body: unknown }
  | { type: "status"; status: number }
  | { type: "failed" };

const REQUEST_TIMEOUT_MS = 15_000;

// `nba` stands in for the current season's game key, so nothing is parsed to
// build these paths.
const GAME_PATH = "game/nba";
const LOGIN_PROBE_PATH = "users;use_login=1/games;game_keys=nba";
const leaguePath = ({ leagueId }: { leagueId: string }): string =>
  `league/nba.l.${leagueId};out=settings/teams/roster`;
const waiverPath = ({ leagueId, start }: { leagueId: string; start: number }): string =>
  `league/nba.l.${leagueId}/players;status=W;start=${start};count=${YAHOO_PAGE_SIZE}`;

const UNAVAILABLE: LeagueFetchError = { type: "error", reason: "unavailable" };

/**
 * One GET with the user's Yahoo cookies, timed from the call until its body is
 * read. No retries: the user can press again.
 */
const requestYahoo = async ({
  path,
  fetchImpl,
}: {
  path: string;
  fetchImpl: FetchImpl;
}): Promise<RequestOutcome> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${YAHOO_API_BASE_URL}/${path}?format=json_f`, {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });
    if (!response.ok) return { type: "status", status: response.status };
    const text = await response.text();
    try {
      const body: unknown = JSON.parse(text);
      return { type: "body", body };
    } catch {
      return { type: "failed" };
    }
  } catch {
    return { type: "failed" };
  } finally {
    clearTimeout(timer);
  }
};

// The one shape the extension reads: how many players a waiver page holds, to
// decide whether to ask for the next one. Anything unexpected counts as empty.
const playerCount = ({ page }: { page: unknown }): number => {
  if (typeof page !== "object" || page === null || !("fantasy_content" in page)) return 0;
  const content = page.fantasy_content;
  if (typeof content !== "object" || content === null || !("league" in content)) return 0;
  const league = content.league;
  if (typeof league !== "object" || league === null || !("players" in league)) return 0;
  return Array.isArray(league.players) ? league.players.length : 0;
};

// The waiver list a page at a time, until a short page or the page cap.
const fetchWaiverPages = async ({
  leagueId,
  fetchImpl,
  pages = [],
}: {
  leagueId: string;
  fetchImpl: FetchImpl;
  pages?: readonly unknown[];
}): Promise<{ type: "pages"; pages: unknown[] } | LeagueFetchError> => {
  const outcome = await requestYahoo({
    path: waiverPath({ leagueId, start: pages.length * YAHOO_PAGE_SIZE }),
    fetchImpl,
  });
  if (outcome.type !== "body") return UNAVAILABLE;

  const collected = [...pages, outcome.body];
  const isFull = playerCount({ page: outcome.body }) >= YAHOO_PAGE_SIZE;
  return isFull && collected.length < YAHOO_MAX_WAIVER_PAGES
    ? fetchWaiverPages({ leagueId, fetchImpl, pages: collected })
    : { type: "pages", pages: collected };
};

// Yahoo answers 400 both for a league the session can't read and for a caller
// with no session at all. Asking for the signed-in user's games tells them apart.
const explainLeague400 = async ({
  fetchImpl,
}: {
  fetchImpl: FetchImpl;
}): Promise<LeagueFetchError> => {
  const probe = await requestYahoo({ path: LOGIN_PROBE_PATH, fetchImpl });
  if (probe.type === "status" && probe.status === 401) {
    return { type: "error", reason: "logged_out" };
  }
  if (probe.type === "failed") return UNAVAILABLE;
  return { type: "error", reason: "not_found" };
};

/**
 * Fetches a Yahoo league with the user's own cookies: the current game, the
 * league with its settings, teams and rosters, and the waiver list. The bodies
 * go back untouched; Court Vision validates them.
 */
export const fetchLeaguePayload = async ({
  leagueId,
  fetchImpl,
}: {
  leagueId: string;
  fetchImpl: FetchImpl;
}): Promise<LeagueFetchResult> => {
  const game = await requestYahoo({ path: GAME_PATH, fetchImpl });
  if (game.type !== "body") return UNAVAILABLE;

  const league = await requestYahoo({ path: leaguePath({ leagueId }), fetchImpl });
  if (league.type === "status" && league.status === 400) return explainLeague400({ fetchImpl });
  if (league.type !== "body") return UNAVAILABLE;

  const waivers = await fetchWaiverPages({ leagueId, fetchImpl });
  if (waivers.type !== "pages") return waivers;

  return {
    type: "league",
    payload: { game: game.body, snapshot: league.body, waiverPages: waivers.pages },
  };
};
