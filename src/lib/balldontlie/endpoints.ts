import { type BdlParamValue, bdlFetch } from "@/lib/balldontlie/client";
import { PER_PAGE, SEASON_YEAR, THROTTLE_MS } from "@/lib/balldontlie/constants";
import {
  type BdlAdvancedStat,
  type BdlGame,
  type BdlPlayer,
  type BdlStat,
  type BdlTeam,
  bdlAdvancedStatSchema,
  bdlGameRowSchema,
  bdlPage,
  bdlPaginatedPage,
  bdlPlayerSchema,
  bdlStatSchema,
  bdlTeamSchema,
} from "./schemas";

export type BdlPageProgress = {
  endpoint: string;
  page: number;
  pageRows: number;
  totalRows: number;
  nextCursor: number | null;
};

export type BdlClientDeps = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  apiKey?: string;
  onPage?: (progress: BdlPageProgress) => void;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const noopOnPage = (): void => {};

export const fetchTeams = async (deps: BdlClientDeps = {}): Promise<BdlTeam[]> => {
  const raw = await bdlFetch({
    endpoint: "teams",
    apiKey: deps.apiKey,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });
  return bdlPage(bdlTeamSchema).parse(raw).data;
};

export const fetchAllStats = async (
  args: { deps?: BdlClientDeps; season?: string } = {},
): Promise<BdlStat[]> => {
  const { deps = {}, season = SEASON_YEAR } = args;
  const sleep = deps.sleep ?? defaultSleep;
  const onPage = deps.onPage ?? noopOnPage;
  const pageSchema = bdlPaginatedPage(bdlStatSchema);

  const loadPage = async (
    cursor: number | null,
    acc: BdlStat[],
    pageNumber: number,
  ): Promise<BdlStat[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint: "stats",
      params: {
        seasons: [season],
        postseason: "false",
        per_page: PER_PAGE,
        ...cursorParam,
      },
      apiKey: deps.apiKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
    });
    const page = pageSchema.parse(raw);
    const combined = acc.concat(page.data);
    const next = page.meta.next_cursor ?? null;
    onPage({
      endpoint: "stats",
      page: pageNumber,
      pageRows: page.data.length,
      totalRows: combined.length,
      nextCursor: next,
    });
    if (next === null) {
      return combined;
    }
    await sleep(THROTTLE_MS);
    return loadPage(next, combined, pageNumber + 1);
  };

  return loadPage(null, [], 1);
};

export const fetchAllAdvancedStats = async (
  args: { deps?: BdlClientDeps; season?: string } = {},
): Promise<BdlAdvancedStat[]> => {
  const { deps = {}, season = SEASON_YEAR } = args;
  const sleep = deps.sleep ?? defaultSleep;
  const onPage = deps.onPage ?? noopOnPage;
  const pageSchema = bdlPaginatedPage(bdlAdvancedStatSchema);

  const loadPage = async (
    cursor: number | null,
    acc: BdlAdvancedStat[],
    pageNumber: number,
  ): Promise<BdlAdvancedStat[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint: "stats/advanced",
      params: {
        seasons: [season],
        postseason: "false",
        per_page: PER_PAGE,
        ...cursorParam,
      },
      apiKey: deps.apiKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
    });
    const page = pageSchema.parse(raw);
    const combined = acc.concat(page.data);
    const next = page.meta.next_cursor ?? null;
    onPage({
      endpoint: "stats/advanced",
      page: pageNumber,
      pageRows: page.data.length,
      totalRows: combined.length,
      nextCursor: next,
    });
    if (next === null) {
      return combined;
    }
    await sleep(THROTTLE_MS);
    return loadPage(next, combined, pageNumber + 1);
  };

  return loadPage(null, [], 1);
};

export const fetchAllPlayers = async (
  args: { deps?: BdlClientDeps; throttleMs?: number } = {},
): Promise<BdlPlayer[]> => {
  const { deps = {}, throttleMs = THROTTLE_MS } = args;
  const sleep = deps.sleep ?? defaultSleep;
  const onPage = deps.onPage ?? noopOnPage;
  const pageSchema = bdlPaginatedPage(bdlPlayerSchema);

  const loadPage = async (
    cursor: number | null,
    acc: BdlPlayer[],
    pageNumber: number,
  ): Promise<BdlPlayer[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint: "players",
      params: { per_page: PER_PAGE, ...cursorParam },
      apiKey: deps.apiKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
    });
    const page = pageSchema.parse(raw);
    const combined = acc.concat(page.data);
    const next = page.meta.next_cursor ?? null;
    onPage({
      endpoint: "players",
      page: pageNumber,
      pageRows: page.data.length,
      totalRows: combined.length,
      nextCursor: next,
    });
    if (next === null) {
      return combined;
    }
    await sleep(throttleMs);
    return loadPage(next, combined, pageNumber + 1);
  };

  return loadPage(null, [], 1);
};

export const fetchTeamGames = async (args: {
  teamId: number;
  deps?: BdlClientDeps;
  throttleMs?: number;
}): Promise<BdlGame[]> => {
  const { teamId, deps = {}, throttleMs = THROTTLE_MS } = args;
  const sleep = deps.sleep ?? defaultSleep;
  const pageSchema = bdlPaginatedPage(bdlGameRowSchema);

  const loadPage = async (cursor: number | null, acc: BdlGame[]): Promise<BdlGame[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint: "games",
      params: {
        seasons: [SEASON_YEAR],
        team_ids: [String(teamId)],
        postseason: "false",
        per_page: PER_PAGE,
        ...cursorParam,
      },
      apiKey: deps.apiKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
    });
    const page = pageSchema.parse(raw);
    const combined = acc.concat(page.data);
    const next = page.meta.next_cursor ?? null;
    if (next === null) {
      return combined;
    }
    await sleep(throttleMs);
    return loadPage(next, combined);
  };

  return loadPage(null, []);
};
