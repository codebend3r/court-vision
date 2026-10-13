import type { FetchImpl } from "@vision/core/util/fetchImpl";
import { type Logger, silentLogger } from "@vision/core/util/logger";
import type { z } from "zod";

import { bdlFetch, BdlParamValue } from "@/lib/balldontlie/client";
import { PER_PAGE, THROTTLE_MS } from "@/lib/balldontlie/constants";
import {
  BdlAdvancedStat,
  BdlGame,
  BdlPlayer,
  BdlStanding,
  BdlStat,
  BdlTeam,
  bdlAdvancedStatSchema,
  bdlGameRowSchema,
  bdlPage,
  bdlPaginatedPage,
  bdlPlayerSchema,
  bdlStandingSchema,
  bdlStatSchema,
  bdlTeamSchema,
} from "@/lib/balldontlie/schemas";
import { SEASON_START_YEAR } from "@/lib/stats/season";

export type BdlClientDeps = {
  fetchImpl?: FetchImpl;
  sleep?: (ms: number) => Promise<void>;
  apiKey?: string;
  // Receives one progress line per page of a paginated fetch; silent when
  // left out.
  logger?: Logger;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// A stats fetch covers either a whole season or, for the nightly sync, just
// the listed game dates (`YYYY-MM-DD`); dates win when both are given.
const scopeParams = ({
  season,
  dates,
}: {
  season: number;
  dates?: string[];
}): Record<string, BdlParamValue> =>
  dates === undefined ? { seasons: [String(season)] } : { dates };

// The transform stamps every row "Regular Season", and these endpoints do not
// honour `postseason=false` reliably, so playoff rows are dropped here rather
// than written into the regular-season tables. Every sync shares the filter.
const isRegularSeason = (row: { game: { postseason: boolean } }): boolean => !row.game.postseason;

// Walks a cursor-paginated endpoint: one request per page, each parsed against
// `item`, following `meta.next_cursor` with the standard throttle between
// pages until the API reports no next page.
const fetchAllPages = async <T>({
  endpoint,
  params,
  item,
  deps,
}: {
  endpoint: string;
  params: Record<string, BdlParamValue>;
  item: z.ZodType<T>;
  deps: BdlClientDeps;
}): Promise<T[]> => {
  const { sleep = defaultSleep, logger = silentLogger } = deps;
  const pageSchema = bdlPaginatedPage(item);

  const loadPage = async ({
    cursor,
    rows,
    page,
  }: {
    cursor: number | null;
    rows: T[];
    page: number;
  }): Promise<T[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint,
      params: { ...params, per_page: PER_PAGE, ...cursorParam },
      apiKey: deps.apiKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
    });
    const { data, meta } = pageSchema.parse(raw);
    const combined = rows.concat(data);
    const next = meta.next_cursor ?? null;
    logger(
      `${endpoint} page ${page}: ${combined.length} rows total${next === null ? " (final page)" : ""}`,
    );
    if (next === null) {
      return combined;
    }
    await sleep(THROTTLE_MS);
    return loadPage({ cursor: next, rows: combined, page: page + 1 });
  };

  return loadPage({ cursor: null, rows: [], page: 1 });
};

export const fetchTeams = async ({ deps = {} }: { deps?: BdlClientDeps } = {}): Promise<
  BdlTeam[]
> => {
  const raw = await bdlFetch({
    endpoint: "teams",
    apiKey: deps.apiKey,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });
  return bdlPage(bdlTeamSchema).parse(raw).data;
};

// `/v1/standings` (GOAT tier) returns every team's regular-season standing in
// one unpaginated page, so the tolerant `bdlPage` envelope fits.
export const fetchStandings = async ({
  deps = {},
  season = SEASON_START_YEAR,
}: { deps?: BdlClientDeps; season?: number } = {}): Promise<BdlStanding[]> => {
  const raw = await bdlFetch({
    endpoint: "standings",
    params: { season: String(season) },
    apiKey: deps.apiKey,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });
  return bdlPage(bdlStandingSchema).parse(raw).data;
};

export const fetchAllStats = async ({
  deps = {},
  season = SEASON_START_YEAR,
  dates,
}: { deps?: BdlClientDeps; season?: number; dates?: string[] } = {}): Promise<BdlStat[]> =>
  (
    await fetchAllPages({
      endpoint: "stats",
      params: { ...scopeParams({ season, dates }), postseason: "false" },
      item: bdlStatSchema,
      deps,
    })
  ).filter(isRegularSeason);

export const fetchAllAdvancedStats = async ({
  deps = {},
  season = SEASON_START_YEAR,
  dates,
}: { deps?: BdlClientDeps; season?: number; dates?: string[] } = {}): Promise<BdlAdvancedStat[]> =>
  (
    await fetchAllPages({
      endpoint: "stats/advanced",
      params: { ...scopeParams({ season, dates }), postseason: "false" },
      item: bdlAdvancedStatSchema,
      deps,
    })
  ).filter(isRegularSeason);

// `players` is every player Balldontlie has ever listed, each on their last
// team; `players/active` is only the players on a current NBA roster, rookies
// included as soon as they sign. Both pages share the player row schema.
export const fetchAllPlayers = async ({ deps = {} }: { deps?: BdlClientDeps } = {}): Promise<
  BdlPlayer[]
> => fetchAllPages({ endpoint: "players", params: {}, item: bdlPlayerSchema, deps });

export const fetchActivePlayers = async ({ deps = {} }: { deps?: BdlClientDeps } = {}): Promise<
  BdlPlayer[]
> => fetchAllPages({ endpoint: "players/active", params: {}, item: bdlPlayerSchema, deps });

export const fetchTeamGames = async ({
  teamId,
  deps = {},
}: {
  teamId: number;
  deps?: BdlClientDeps;
}): Promise<BdlGame[]> =>
  fetchAllPages({
    endpoint: "games",
    params: {
      seasons: [String(SEASON_START_YEAR)],
      team_ids: [String(teamId)],
      postseason: "false",
    },
    item: bdlGameRowSchema,
    deps,
  });
