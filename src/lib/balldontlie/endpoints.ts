import { bdlFetch, BdlParamValue } from "./client";
import { PER_PAGE, SEASON_YEAR, THROTTLE_MS } from "./constants";
import { BdlStat, BdlTeam, bdlPage, bdlStatSchema, bdlTeamSchema } from "./schemas";

export interface BdlClientDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  apiKey?: string;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const fetchTeams = async (deps: BdlClientDeps = {}): Promise<BdlTeam[]> => {
  const raw = await bdlFetch({
    endpoint: "teams",
    apiKey: deps.apiKey,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });
  return bdlPage(bdlTeamSchema).parse(raw).data;
};

export const fetchAllStats = async (deps: BdlClientDeps = {}): Promise<BdlStat[]> => {
  const sleep = deps.sleep ?? defaultSleep;
  const pageSchema = bdlPage(bdlStatSchema);

  const loadPage = async (cursor: number | null, acc: BdlStat[]): Promise<BdlStat[]> => {
    const cursorParam: Record<string, BdlParamValue> =
      cursor === null ? {} : { cursor: String(cursor) };
    const raw = await bdlFetch({
      endpoint: "stats",
      params: {
        seasons: [SEASON_YEAR],
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
    await sleep(THROTTLE_MS);
    return loadPage(next, combined);
  };

  return loadPage(null, []);
};
