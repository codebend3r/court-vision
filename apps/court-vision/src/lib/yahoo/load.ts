import type { FetchImpl } from "@vision/core/util/fetchImpl";
import { consoleLogger, type Logger } from "@vision/core/util/logger";
import { unstable_cache } from "next/cache";

import { yahooFetch, type YahooFetchResult } from "@/lib/yahoo/client";
import { YAHOO_MAX_WAIVER_PAGES, YAHOO_PAGE_SIZE } from "@/lib/yahoo/constants";
import {
  yahooGameSchema,
  yahooLeagueSnapshotSchema,
  type YahooPlayersPage,
  yahooPlayersPageSchema,
} from "@/lib/yahoo/schemas";
import { toImportedLeague, toPlayerRefs } from "@/lib/yahoo/transform";
import { type ImportedLeague, type YahooPlayerRef } from "@/lib/yahoo/types";

export type YahooLoadFailure =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid_payload" }
  | { status: "past_season" }
  | { status: "unsupported"; reason: "highscore" | "scoring_type" };

export type YahooLoadResult =
  | { status: "ok"; league: ImportedLeague; waiverRefs: YahooPlayerRef[] }
  | YahooLoadFailure;

export type CurrentGame = { gameKey: string; season: number };

const NOT_FOUND: YahooLoadFailure = { status: "not_found" };
const UNAVAILABLE: YahooLoadFailure = { status: "unavailable" };
const INVALID_PAYLOAD: YahooLoadFailure = { status: "invalid_payload" };
const PAST_SEASON: YahooLoadFailure = { status: "past_season" };

// A 400 is the expected answer for a private or missing league; anything else
// that failed is logged with the client's detail before it becomes `unavailable`.
const toFailure = ({
  result,
  logger,
}: {
  result: Exclude<YahooFetchResult, { status: "ok" }>;
  logger: Logger;
}): YahooLoadFailure => {
  if (result.status === "not_found") return NOT_FOUND;
  logger(`yahoo: ${result.detail}`);
  return UNAVAILABLE;
};

type ReadGame = (args: { fetchImpl?: FetchImpl }) => Promise<CurrentGame>;

// The uncached read. A failed read throws instead of returning, so a caching
// wrapper never stores it; the failure rides out on `cause`. The probe CLI
// passes this directly, since `unstable_cache` throws outside the Next runtime.
export const readCurrentGameUncached: ReadGame = async ({ fetchImpl }) => {
  const result = await yahooFetch({ path: "game/nba", fetchImpl });
  if (result.status !== "ok") {
    const detail = result.status === "unavailable" ? result.detail : "Yahoo answered 400";
    throw new Error(`Yahoo game read failed: ${detail}`, { cause: UNAVAILABLE });
  }
  const parsed = yahooGameSchema.safeParse(result.body);
  if (!parsed.success) {
    throw new Error("Yahoo game body did not parse", { cause: INVALID_PAYLOAD });
  }
  const { game_key, season } = parsed.data.fantasy_content.game;
  return { gameKey: game_key, season };
};

// The game key changes once a season, so one read a day is plenty. `fetchImpl`
// is a test seam: `JSON.stringify` drops functions, so it never reaches the
// cache key.
const readCurrentGame: ReadGame = unstable_cache(readCurrentGameUncached, ["yahoo-nba-game"], {
  revalidate: 86_400,
});

// Anything thrown that isn't a parse failure, including `unstable_cache`
// missing its incremental cache outside Next, reads as Yahoo being unavailable.
const loadCurrentGame = async ({
  fetchImpl,
  logger,
  readGame,
}: {
  fetchImpl?: FetchImpl;
  logger: Logger;
  readGame: ReadGame;
}): Promise<{ status: "ok"; game: CurrentGame } | YahooLoadFailure> => {
  try {
    return { status: "ok", game: await readGame({ fetchImpl }) };
  } catch (error) {
    logger(`yahoo: ${error instanceof Error ? error.message : String(error)}`);
    return error instanceof Error && error.cause === INVALID_PAYLOAD
      ? INVALID_PAYLOAD
      : UNAVAILABLE;
  }
};

// Only the page length is read here, to decide whether to fetch the next one.
// A page that doesn't parse ends the paging; `parseYahooPayload` rejects it.
const playerCount = ({ body }: { body: unknown }): number => {
  const parsed = yahooPlayersPageSchema.safeParse(body);
  return parsed.success ? parsed.data.fantasy_content.league.players.length : 0;
};

// Yahoo's waiver list, a page at a time, until a short page or the page cap.
const fetchWaiverPages = async ({
  leagueKey,
  fetchImpl,
  logger,
  pages = [],
}: {
  leagueKey: string;
  fetchImpl?: FetchImpl;
  logger: Logger;
  pages?: readonly unknown[];
}): Promise<{ status: "ok"; pages: unknown[] } | YahooLoadFailure> => {
  const start = pages.length * YAHOO_PAGE_SIZE;
  const result = await yahooFetch({
    path: `league/${leagueKey}/players;status=W;start=${start};count=${YAHOO_PAGE_SIZE}`,
    fetchImpl,
  });
  if (result.status !== "ok") return toFailure({ result, logger });

  const collected = [...pages, result.body];
  const isFull = playerCount({ body: result.body }) >= YAHOO_PAGE_SIZE;
  return isFull && collected.length < YAHOO_MAX_WAIVER_PAGES
    ? fetchWaiverPages({ leagueKey, fetchImpl, logger, pages: collected })
    : { status: "ok", pages: collected };
};

/**
 * Validates raw Yahoo bodies and turns them into an imported league. Shared by
 * the server path below and the extension path, which hands over the same
 * bodies fetched in the user's browser.
 */
export const parseYahooPayload = ({
  currentSeason,
  snapshot,
  waiverPages,
}: {
  currentSeason: number;
  snapshot: unknown;
  waiverPages: readonly unknown[];
}): YahooLoadResult => {
  const parsedSnapshot = yahooLeagueSnapshotSchema.safeParse(snapshot);
  const parsedPages = waiverPages.flatMap((page): YahooPlayersPage[] => {
    const parsed = yahooPlayersPageSchema.safeParse(page);
    return parsed.success ? [parsed.data] : [];
  });
  if (!parsedSnapshot.success || parsedPages.length !== waiverPages.length) return INVALID_PAYLOAD;
  if (parsedSnapshot.data.fantasy_content.league.season !== currentSeason) return PAST_SEASON;

  const transformed = toImportedLeague({ snapshot: parsedSnapshot.data });
  if (transformed.status !== "ok") return transformed;
  return {
    status: "ok",
    league: transformed.league,
    waiverRefs: toPlayerRefs({ pages: parsedPages }),
  };
};

/**
 * Reads a public Yahoo league of the current NBA season: its settings, rosters
 * and waiver list. The snapshot is validated before the waiver list is paged,
 * so a league that can't be imported costs no waiver requests. `readGame`
 * defaults to the cached read; outside Next, pass `readCurrentGameUncached`.
 */
export const loadYahooLeague = async ({
  leagueId,
  fetchImpl,
  logger = consoleLogger,
  readGame = readCurrentGame,
}: {
  leagueId: string;
  fetchImpl?: FetchImpl;
  logger?: Logger;
  readGame?: ReadGame;
}): Promise<YahooLoadResult> => {
  const current = await loadCurrentGame({ fetchImpl, logger, readGame });
  if (current.status !== "ok") return current;

  const leagueKey = `${current.game.gameKey}.l.${leagueId}`;
  const snapshot = await yahooFetch({
    path: `league/${leagueKey};out=settings/teams/roster`,
    fetchImpl,
  });
  if (snapshot.status !== "ok") return toFailure({ result: snapshot, logger });

  const currentSeason = current.game.season;
  const checked = parseYahooPayload({ currentSeason, snapshot: snapshot.body, waiverPages: [] });
  if (checked.status !== "ok") return checked;

  const waivers = await fetchWaiverPages({ leagueKey, fetchImpl, logger });
  if (waivers.status !== "ok") return waivers;

  return parseYahooPayload({ currentSeason, snapshot: snapshot.body, waiverPages: waivers.pages });
};
