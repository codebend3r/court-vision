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

// One request against an endpoint with the caller's key, fetch and sleep.
type RequestProps = {
  endpoint: string;
  params?: Record<string, BdlParamValue>;
  deps: BdlClientDeps;
};

const request = ({ endpoint, params, deps }: RequestProps): Promise<unknown> =>
  bdlFetch({
    endpoint,
    params,
    apiKey: deps.apiKey,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });

// A stats fetch covers either a whole season or, for the nightly sync, just
// the listed game dates (`YYYY-MM-DD`); dates win when both are given.
type ScopeParamsProps = {
  season: number;
  dates?: string[];
};

const scopeParams = ({ season, dates }: ScopeParamsProps): Record<string, BdlParamValue> =>
  dates === undefined ? { seasons: [String(season)] } : { dates };

// The transform stamps every row "Regular Season", and these endpoints do not
// honour `postseason=false` reliably, so playoff rows are dropped here rather
// than written into the regular-season tables. Every sync shares the filter.
type IsRegularSeasonProps = { game: { postseason: boolean } };

const isRegularSeason = (row: IsRegularSeasonProps): boolean => !row.game.postseason;

// Walks a cursor-paginated endpoint: one request per page, each parsed against
// `item`, following `meta.next_cursor` with the standard throttle between
// pages until the API reports no next page.
type FetchAllPagesProps<T> = {
  endpoint: string;
  params: Record<string, BdlParamValue>;
  item: z.ZodType<T>;
  deps: BdlClientDeps;
};

const fetchAllPages = async <T>({
  endpoint,
  params,
  item,
  deps,
}: FetchAllPagesProps<T>): Promise<T[]> => {
  const { sleep = defaultSleep, logger = silentLogger } = deps;
  const pageSchema = bdlPaginatedPage(item);

  type LoadPageProps = {
    cursor: number | null;
    rows: T[];
    page: number;
  };

  const loadPage = async ({ cursor, rows, page }: LoadPageProps): Promise<T[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await request({
      endpoint,
      params: { ...params, per_page: PER_PAGE, ...cursorParam },
      deps,
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

type FetchTeamsProps = { deps?: BdlClientDeps };

export const fetchTeams = async ({ deps = {} }: FetchTeamsProps = {}): Promise<BdlTeam[]> => {
  const raw = await request({ endpoint: "teams", deps });
  return bdlPage(bdlTeamSchema).parse(raw).data;
};

// `/v1/standings` (GOAT tier) returns every team's regular-season standing in
// one unpaginated page, so the tolerant `bdlPage` envelope fits.
type FetchStandingsProps = { deps?: BdlClientDeps; season?: number };

export const fetchStandings = async ({
  deps = {},
  season = SEASON_START_YEAR,
}: FetchStandingsProps = {}): Promise<BdlStanding[]> => {
  const raw = await request({ endpoint: "standings", params: { season: String(season) }, deps });
  return bdlPage(bdlStandingSchema).parse(raw).data;
};

// A box-score fetch, basic or advanced: the season or the listed dates,
// regular season only.
type FetchBoxScoresProps = { deps?: BdlClientDeps; season?: number; dates?: string[] };

type FetchRegularSeasonRowsProps<T extends IsRegularSeasonProps> = FetchBoxScoresProps & {
  endpoint: string;
  item: z.ZodType<T>;
};

const fetchRegularSeasonRows = async <T extends IsRegularSeasonProps>({
  endpoint,
  item,
  deps = {},
  season = SEASON_START_YEAR,
  dates,
}: FetchRegularSeasonRowsProps<T>): Promise<T[]> =>
  (
    await fetchAllPages({
      endpoint,
      params: { ...scopeParams({ season, dates }), postseason: "false" },
      item,
      deps,
    })
  ).filter(isRegularSeason);

export const fetchAllStats = (args: FetchBoxScoresProps = {}): Promise<BdlStat[]> =>
  fetchRegularSeasonRows({ ...args, endpoint: "stats", item: bdlStatSchema });

export const fetchAllAdvancedStats = (args: FetchBoxScoresProps = {}): Promise<BdlAdvancedStat[]> =>
  fetchRegularSeasonRows({ ...args, endpoint: "stats/advanced", item: bdlAdvancedStatSchema });

// `players` is every player Balldontlie has ever listed, each on their last
// team; `players/active` is only the players on a current NBA roster, rookies
// included as soon as they sign. Both pages share the player row schema.
type FetchAllPlayersProps = { deps?: BdlClientDeps };

export const fetchAllPlayers = async ({ deps = {} }: FetchAllPlayersProps = {}): Promise<
  BdlPlayer[]
> => fetchAllPages({ endpoint: "players", params: {}, item: bdlPlayerSchema, deps });

type FetchActivePlayersProps = { deps?: BdlClientDeps };

export const fetchActivePlayers = async ({ deps = {} }: FetchActivePlayersProps = {}): Promise<
  BdlPlayer[]
> => fetchAllPages({ endpoint: "players/active", params: {}, item: bdlPlayerSchema, deps });

type FetchTeamGamesProps = {
  teamId: number;
  deps?: BdlClientDeps;
};

export const fetchTeamGames = async ({
  teamId,
  deps = {},
}: FetchTeamGamesProps): Promise<BdlGame[]> =>
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
