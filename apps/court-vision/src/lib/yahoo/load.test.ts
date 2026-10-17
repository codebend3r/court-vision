import { describe, expect, it, vi } from "bun:test";

import type { FetchImpl } from "@vision/core/util/fetchImpl";
import { type Logger, silentLogger } from "@vision/core/util/logger";

import { YAHOO_API_BASE_URL, YAHOO_MAX_WAIVER_PAGES, YAHOO_PAGE_SIZE } from "@/lib/yahoo/constants";
import gameNba from "@/lib/yahoo/fixtures/game-nba.json";
import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import waivers106344 from "@/lib/yahoo/fixtures/waivers-106344.json";

// A pass-through: bun:test has no Next incremental cache. The double is still
// a spy because the cache key and revalidate window are part of what the
// module declares.
const unstableCache = vi.fn((fn: unknown) => fn);

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));

// Imported after the mock is installed: bun:test does not hoist `vi.mock`, and
// load.ts calls `unstable_cache` at module scope.
const { loadYahooLeague, parseYahooPayload } = await import("@/lib/yahoo/load");

type LoadResult = Awaited<ReturnType<typeof loadYahooLeague>>;
type Route = { status: number; body: unknown };

const GAME_PATH = "game/nba";
const SNAPSHOT_PATH = "league/478.l.106344;out=settings/teams/roster";
const waiverPath = ({ start }: { start: number }): string =>
  `league/478.l.106344/players;status=W;start=${start};count=${YAHOO_PAGE_SIZE}`;

const yahooUrl = ({ path }: { path: string }): string =>
  `${YAHOO_API_BASE_URL}/${path}?format=json_f`;

const ok = (body: unknown): Route => ({ status: 200, body });

// Serves each request by its full URL with a fresh Response. An unknown URL
// answers 404, which the client reports as unavailable without retrying.
const stubYahoo = ({ routes }: { routes: ReadonlyMap<string, Route> }) =>
  vi.fn<FetchImpl>().mockImplementation(async (input) => {
    const route = routes.get(String(input)) ?? { status: 404, body: {} };
    return new Response(JSON.stringify(route.body), {
      status: route.status,
      headers: { "content-type": "application/json" },
    });
  });

const routesFor = ({
  game = ok(gameNba),
  snapshot = ok(league106344),
  waiverPages = [ok(waivers106344)],
}: {
  game?: Route;
  snapshot?: Route;
  waiverPages?: readonly Route[];
}): ReadonlyMap<string, Route> =>
  new Map([
    [yahooUrl({ path: GAME_PATH }), game],
    [yahooUrl({ path: SNAPSHOT_PATH }), snapshot],
    ...waiverPages.map((page, index): [string, Route] => [
      yahooUrl({ path: waiverPath({ start: index * YAHOO_PAGE_SIZE }) }),
      page,
    ]),
  ]);

const requestedUrls = ({ fetchImpl }: { fetchImpl: ReturnType<typeof stubYahoo> }): string[] =>
  fetchImpl.mock.calls.map(([input]) => String(input));

const waiverPage = ({ from, count }: { from: number; count: number }): Route =>
  ok({
    fantasy_content: {
      league: {
        players: Array.from({ length: count }, (_, index) => ({
          player: { player_id: String(from + index), name: { full: `Waiver ${from + index}` } },
        })),
      },
    },
  });

const loaded = ({ result }: { result: LoadResult }) => {
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.status}`);
  return result;
};

describe("loadYahooLeague", () => {
  it("loads a league, its settings and its waiver list", async () => {
    const fetchImpl = stubYahoo({ routes: routesFor({}) });

    const result = loaded({
      result: await loadYahooLeague({ leagueId: "106344", fetchImpl, logger: silentLogger }),
    });

    expect(requestedUrls({ fetchImpl })).toEqual([
      yahooUrl({ path: GAME_PATH }),
      yahooUrl({ path: SNAPSHOT_PATH }),
      yahooUrl({ path: waiverPath({ start: 0 }) }),
    ]);
    expect(result.league.externalKey).toBe("478.l.106344");
    expect(result.league.name).toBe("Game of Courts");
    expect(result.league.teams).toHaveLength(12);
    expect(result.league.scoring.scoringType).toBe("h2h_categories");
    expect(result.waiverRefs).toEqual([
      {
        yahooPlayerId: "6408",
        fullName: "Isaiah Stewart",
        teamAbbr: "MEM",
        eligiblePositions: ["PF", "F", "C", "Util", "IL"],
        status: "O",
      },
    ]);
  });

  it("pages the waiver list until a short page", async () => {
    const fetchImpl = stubYahoo({
      routes: routesFor({
        waiverPages: [
          waiverPage({ from: 0, count: 25 }),
          waiverPage({ from: 25, count: 25 }),
          waiverPage({ from: 50, count: 3 }),
        ],
      }),
    });

    const result = loaded({
      result: await loadYahooLeague({ leagueId: "106344", fetchImpl, logger: silentLogger }),
    });

    expect(requestedUrls({ fetchImpl }).slice(2)).toEqual([
      yahooUrl({ path: waiverPath({ start: 0 }) }),
      yahooUrl({ path: waiverPath({ start: 25 }) }),
      yahooUrl({ path: waiverPath({ start: 50 }) }),
    ]);
    expect(result.waiverRefs).toHaveLength(53);
  });

  it("stops paging after YAHOO_MAX_WAIVER_PAGES full pages", async () => {
    const fetchImpl = stubYahoo({
      routes: routesFor({
        waiverPages: Array.from({ length: YAHOO_MAX_WAIVER_PAGES + 2 }, (_, index) =>
          waiverPage({ from: index * YAHOO_PAGE_SIZE, count: YAHOO_PAGE_SIZE }),
        ),
      }),
    });

    const result = loaded({
      result: await loadYahooLeague({ leagueId: "106344", fetchImpl, logger: silentLogger }),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2 + YAHOO_MAX_WAIVER_PAGES);
    expect(result.waiverRefs).toHaveLength(YAHOO_MAX_WAIVER_PAGES * YAHOO_PAGE_SIZE);
  });

  it("maps a 400 to not_found", async () => {
    const fetchImpl = stubYahoo({ routes: routesFor({ snapshot: { status: 400, body: {} } }) });

    const result = await loadYahooLeague({ leagueId: "106344", fetchImpl, logger: silentLogger });

    expect(result).toEqual({ status: "not_found" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects a league from another season", async () => {
    const fetchImpl = stubYahoo({
      routes: routesFor({
        game: ok({ fantasy_content: { game: { game_key: "478", season: "2027" } } }),
      }),
    });

    const result = await loadYahooLeague({ leagueId: "106344", fetchImpl, logger: silentLogger });

    expect(result).toEqual({ status: "past_season" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports a 200 that isn't fantasy_content as invalid_payload", async () => {
    const yahooError = ok({ error: { description: "Invalid league key" } });

    const fromSnapshot = await loadYahooLeague({
      leagueId: "106344",
      fetchImpl: stubYahoo({ routes: routesFor({ snapshot: yahooError }) }),
      logger: silentLogger,
    });
    const fromGame = await loadYahooLeague({
      leagueId: "106344",
      fetchImpl: stubYahoo({ routes: routesFor({ game: yahooError }) }),
      logger: silentLogger,
    });

    expect(fromSnapshot).toEqual({ status: "invalid_payload" });
    expect(fromGame).toEqual({ status: "invalid_payload" });
  });

  it("validates the snapshot before paging the waiver list", async () => {
    const fetchImpl = stubYahoo({
      routes: routesFor({
        snapshot: ok({ error: { description: "Invalid league key" } }),
        waiverPages: [{ status: 400, body: {} }],
      }),
    });

    const result = await loadYahooLeague({ leagueId: "106344", fetchImpl, logger: silentLogger });

    expect(result).toEqual({ status: "invalid_payload" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports a current game Yahoo won't serve as unavailable and logs why", async () => {
    const fetchImpl = stubYahoo({ routes: routesFor({ game: { status: 403, body: {} } }) });
    const logger = vi.fn<Logger>();

    const result = await loadYahooLeague({ leagueId: "106344", fetchImpl, logger });

    expect(result).toEqual({ status: "unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(
      "yahoo: Yahoo game read failed: Yahoo responded 403 for game/nba",
    );
  });

  it("logs the detail when a waiver page fails", async () => {
    const fetchImpl = stubYahoo({
      routes: routesFor({ waiverPages: [{ status: 403, body: {} }] }),
    });
    const logger = vi.fn<Logger>();

    const result = await loadYahooLeague({ leagueId: "106344", fetchImpl, logger });

    expect(result).toEqual({ status: "unavailable" });
    expect(logger).toHaveBeenCalledWith(
      `yahoo: Yahoo responded 403 for ${waiverPath({ start: 0 })}`,
    );
  });

  it("caches the current NBA game for a day", () => {
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ["yahoo-nba-game"], {
      revalidate: 86_400,
    });
  });
});

describe("parseYahooPayload", () => {
  it("parses bodies handed over by the extension", () => {
    const result = loaded({
      result: parseYahooPayload({
        currentSeason: 2026,
        snapshot: league106344,
        waiverPages: [waivers106344],
      }),
    });

    expect(result.league.teams).toHaveLength(12);
    expect(result.waiverRefs.map(({ fullName }) => fullName)).toEqual(["Isaiah Stewart"]);
  });

  it("refuses a waiver page that doesn't parse", () => {
    const result = parseYahooPayload({
      currentSeason: 2026,
      snapshot: league106344,
      waiverPages: [waivers106344, "<html>Temporary problem</html>"],
    });

    expect(result).toEqual({ status: "invalid_payload" });
  });

  it("passes an unsupported league through with its reason", () => {
    const highScore = {
      fantasy_content: {
        ...league106344.fantasy_content,
        league: { ...league106344.fantasy_content.league, is_highscore: 1 },
      },
    };

    const result = parseYahooPayload({ currentSeason: 2026, snapshot: highScore, waiverPages: [] });

    expect(result).toEqual({ status: "unsupported", reason: "highscore" });
  });
});
