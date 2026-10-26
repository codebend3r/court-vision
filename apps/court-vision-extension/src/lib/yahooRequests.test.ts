import { afterEach, describe, expect, it, vi } from "bun:test";

import type { FetchImpl } from "@vision/core/util/fetchImpl";
import { YAHOO_API_BASE_URL } from "@vision/yahoo-bridge/constants";

import { fetchLeaguePayload } from "@/lib/yahooRequests";

const GAME_URL = `${YAHOO_API_BASE_URL}/game/nba?format=json_f`;
const LEAGUE_URL = `${YAHOO_API_BASE_URL}/league/nba.l.106344;out=settings/teams/roster?format=json_f`;
const LOGIN_PROBE_URL = `${YAHOO_API_BASE_URL}/users;use_login=1/games;game_keys=nba?format=json_f`;
const SCOREBOARD_URL = `${YAHOO_API_BASE_URL}/league/nba.l.106344/scoreboard?format=json_f`;
type WaiverUrlProps = { start: number };

const waiverUrl = ({ start }: WaiverUrlProps): string =>
  `${YAHOO_API_BASE_URL}/league/nba.l.106344/players;status=W;start=${start};count=25?format=json_f`;

const gameBody = { fantasy_content: { game: { game_key: "478", season: 2026 } } };
const leagueBody = { fantasy_content: { league: { league_key: "478.l.106344", teams: [] } } };

const scoreboardBody = {
  fantasy_content: { league: { scoreboard: { matchups: [] } } },
};

type WaiverPageProps = { size: number };

const waiverPage = ({ size }: WaiverPageProps) => ({
  fantasy_content: {
    league: {
      players: Array.from({ length: size }, (_, index) => ({ player_id: index + 1 })),
    },
  },
});

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

// `Response` refuses statuses outside 200–599, and Yahoo's rate-limit signal is
// 999, so the stub overrides the two fields a caller reads.
const statusResponse = (status: number): Response =>
  Object.defineProperties(new Response("", { status: 200 }), {
    status: { value: status },
    ok: { value: status >= 200 && status < 300 },
  });

type Route = Response | (() => Promise<Response>);

// Serves each URL from a route table; an unknown URL is a 404. Every test asks
// for a URL at most once, so a stored response is never read twice.
type FetchByUrlProps = { routes: Record<string, Route> };

const fetchByUrl = ({ routes }: FetchByUrlProps) =>
  vi.fn<FetchImpl>(async (input) => {
    const route = routes[String(input)];
    if (route === undefined) return statusResponse(404);
    return typeof route === "function" ? route() : route;
  });

type RequestedUrlsProps = { fetchImpl: ReturnType<typeof fetchByUrl> };

const requestedUrls = ({ fetchImpl }: RequestedUrlsProps): string[] =>
  fetchImpl.mock.calls.map(([input]) => String(input));

// Answers every request after `delayMs` (on the fake clock): the game, the
// league, and a full waiver page for any other URL, so paging never stops on
// its own. An aborted request rejects at once, as `fetch` does.
type SlowYahooProps = { delayMs: number };

const slowYahoo = ({ delayMs }: SlowYahooProps) => {
  const signals: AbortSignal[] = [];
  const fetchImpl = vi.fn<FetchImpl>(
    (input, init) =>
      new Promise<Response>((resolve, reject) => {
        const signal = init?.signal ?? null;
        if (!signal) return;
        signals.push(signal);
        const url = String(input);
        const body =
          url === GAME_URL ? gameBody : url === LEAGUE_URL ? leagueBody : waiverPage({ size: 25 });
        const timer = setTimeout(() => resolve(jsonResponse(body)), delayMs);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason);
        });
      }),
  );
  return { fetchImpl, signals };
};

// Moves the fake clock a second at a time, letting each request's promise
// chain run between ticks the way the real event loop would.
type AdvanceByProps = { ms: number };

const advanceBy = async ({ ms }: AdvanceByProps) => {
  const flush = async (rounds: number): Promise<void> => {
    if (rounds === 0) return;
    await Promise.resolve();
    return flush(rounds - 1);
  };
  const ticks = Array.from({ length: Math.ceil(ms / 1_000) }, (_, index) =>
    Math.min(1_000, ms - index * 1_000),
  );
  await ticks.reduce<Promise<void>>(async (previous, tick) => {
    await previous;
    vi.advanceTimersByTime(tick);
    await flush(20);
  }, flush(20));
};

describe("fetchLeaguePayload", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches the game, the league and the waiver list with the user's cookies", async () => {
    const page = waiverPage({ size: 3 });
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: jsonResponse(leagueBody),
        [waiverUrl({ start: 0 })]: jsonResponse(page),
        [SCOREBOARD_URL]: jsonResponse(scoreboardBody),
      },
    });

    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(requestedUrls({ fetchImpl })).toEqual([
      GAME_URL,
      LEAGUE_URL,
      waiverUrl({ start: 0 }),
      SCOREBOARD_URL,
    ]);
    fetchImpl.mock.calls.forEach(([, init]) => {
      expect(init?.credentials ?? null).toBe("include");
      expect(init?.method ?? "GET").toBe("GET");
      expect(init?.signal ?? null).toBeInstanceOf(AbortSignal);
    });
    expect(result).toEqual({
      type: "league",
      payload: {
        game: gameBody,
        snapshot: leagueBody,
        waiverPages: [page],
        scoreboard: scoreboardBody,
      },
    });
  });

  it("starts the scoreboard before waiver pagination finishes", async () => {
    const waiver = Promise.withResolvers<Response>();
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: jsonResponse(leagueBody),
        [waiverUrl({ start: 0 })]: () => waiver.promise,
        [SCOREBOARD_URL]: async () => {
          waiver.resolve(jsonResponse(waiverPage({ size: 3 })));
          return jsonResponse(scoreboardBody);
        },
      },
    });
    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });
    expect(result.type === "league" && result.payload.scoreboard).toEqual(scoreboardBody);
  });

  it("still returns the league when the scoreboard can't be read", async () => {
    const page = waiverPage({ size: 3 });
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: jsonResponse(leagueBody),
        [waiverUrl({ start: 0 })]: jsonResponse(page),
        [SCOREBOARD_URL]: statusResponse(500),
      },
    });

    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(result).toEqual({
      type: "league",
      payload: { game: gameBody, snapshot: leagueBody, waiverPages: [page] },
    });
  });

  it("pages waivers until a short page and never past ten", async () => {
    const shortPaged = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: jsonResponse(leagueBody),
        [waiverUrl({ start: 0 })]: jsonResponse(waiverPage({ size: 25 })),
        [waiverUrl({ start: 25 })]: jsonResponse(waiverPage({ size: 25 })),
        [waiverUrl({ start: 50 })]: jsonResponse(waiverPage({ size: 3 })),
      },
    });

    const shortResult = await fetchLeaguePayload({ leagueId: "106344", fetchImpl: shortPaged });

    expect(shortResult.type === "league" && shortResult.payload.waiverPages.length).toBe(3);

    const fullPages = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => [
        waiverUrl({ start: index * 25 }),
        jsonResponse(waiverPage({ size: 25 })),
      ]),
    );
    const capped = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: jsonResponse(leagueBody),
        ...fullPages,
      },
    });

    const cappedResult = await fetchLeaguePayload({ leagueId: "106344", fetchImpl: capped });

    const waiverRequests = requestedUrls({ fetchImpl: capped }).filter((url) =>
      url.includes("/players;status=W;"),
    );
    expect(waiverRequests).toEqual(
      Array.from({ length: 10 }, (_, index) => waiverUrl({ start: index * 25 })),
    );
    expect(cappedResult.type === "league" && cappedResult.payload.waiverPages.length).toBe(10);
  });

  it("treats a page whose players aren't a list as the last page", async () => {
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: jsonResponse(leagueBody),
        [waiverUrl({ start: 0 })]: jsonResponse({ fantasy_content: { league: { players: {} } } }),
      },
    });

    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(result.type === "league" && result.payload.waiverPages.length).toBe(1);
  });

  it("reports logged_out when Yahoo sees no session", async () => {
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: statusResponse(400),
        [LOGIN_PROBE_URL]: statusResponse(401),
      },
    });

    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(result).toEqual({ type: "error", reason: "logged_out" });
    expect(requestedUrls({ fetchImpl })).toEqual([GAME_URL, LEAGUE_URL, LOGIN_PROBE_URL]);
    expect(fetchImpl.mock.calls[2]?.[1]?.credentials ?? null).toBe("include");
  });

  it("reports not_found when the session can't see the league", async () => {
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: statusResponse(400),
        [LOGIN_PROBE_URL]: jsonResponse({ fantasy_content: { users: [] } }),
      },
    });

    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(result).toEqual({ type: "error", reason: "not_found" });
    expect(requestedUrls({ fetchImpl })).toEqual([GAME_URL, LEAGUE_URL, LOGIN_PROBE_URL]);
  });

  it("reports not_found when the session check answers 200 with a body that isn't JSON", async () => {
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: statusResponse(400),
        [LOGIN_PROBE_URL]: new Response("<html>Your games</html>", { status: 200 }),
      },
    });

    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(result).toEqual({ type: "error", reason: "not_found" });
  });

  it("reports not_found when the session check answers any other non-401 status", async () => {
    const outcomes = await Promise.all(
      [302, 400, 403, 404].map((status) =>
        fetchLeaguePayload({
          leagueId: "106344",
          fetchImpl: fetchByUrl({
            routes: {
              [GAME_URL]: jsonResponse(gameBody),
              [LEAGUE_URL]: statusResponse(400),
              [LOGIN_PROBE_URL]: statusResponse(status),
            },
          }),
        }),
      ),
    );

    outcomes.forEach((outcome) => {
      expect(outcome).toEqual({ type: "error", reason: "not_found" });
    });
  });

  it("reports unavailable when the session check answers 503 or 999", async () => {
    const outcomes = await Promise.all(
      [503, 999].map((status) =>
        fetchLeaguePayload({
          leagueId: "106344",
          fetchImpl: fetchByUrl({
            routes: {
              [GAME_URL]: jsonResponse(gameBody),
              [LEAGUE_URL]: statusResponse(400),
              [LOGIN_PROBE_URL]: statusResponse(status),
            },
          }),
        }),
      ),
    );

    outcomes.forEach((outcome) => {
      expect(outcome).toEqual({ type: "error", reason: "unavailable" });
    });
  });

  it("checks the session only when the league answers 400", async () => {
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: statusResponse(503),
        [LOGIN_PROBE_URL]: statusResponse(401),
      },
    });

    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(result).toEqual({ type: "error", reason: "unavailable" });
    expect(requestedUrls({ fetchImpl })).not.toContain(LOGIN_PROBE_URL);
  });

  it("reports unavailable for 5xx, 999 and network errors", async () => {
    const failures: Route[] = [
      statusResponse(500),
      statusResponse(503),
      statusResponse(999),
      () => Promise.reject(new TypeError("Failed to fetch")),
    ];
    const outcomes = await Promise.all(
      failures.flatMap((failure) => [
        fetchLeaguePayload({
          leagueId: "106344",
          fetchImpl: fetchByUrl({ routes: { [GAME_URL]: failure } }),
        }),
        fetchLeaguePayload({
          leagueId: "106344",
          fetchImpl: fetchByUrl({
            routes: { [GAME_URL]: jsonResponse(gameBody), [LEAGUE_URL]: failure },
          }),
        }),
        fetchLeaguePayload({
          leagueId: "106344",
          fetchImpl: fetchByUrl({
            routes: {
              [GAME_URL]: jsonResponse(gameBody),
              [LEAGUE_URL]: jsonResponse(leagueBody),
              [waiverUrl({ start: 0 })]: failure,
            },
          }),
        }),
      ]),
    );

    expect(outcomes).toHaveLength(12);
    outcomes.forEach((outcome) => {
      expect(outcome).toEqual({ type: "error", reason: "unavailable" });
    });
  });

  it("reports unavailable when the session check itself fails to answer", async () => {
    const fetchImpl = fetchByUrl({
      routes: {
        [GAME_URL]: jsonResponse(gameBody),
        [LEAGUE_URL]: statusResponse(400),
        [LOGIN_PROBE_URL]: () => Promise.reject(new TypeError("Failed to fetch")),
      },
    });

    const result = await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(result).toEqual({ type: "error", reason: "unavailable" });
  });

  it("reports unavailable for a body that isn't JSON", async () => {
    const html = () => Promise.resolve(new Response("<html>Sign in</html>", { status: 200 }));
    const outcomes = await Promise.all([
      fetchLeaguePayload({
        leagueId: "106344",
        fetchImpl: fetchByUrl({ routes: { [GAME_URL]: html } }),
      }),
      fetchLeaguePayload({
        leagueId: "106344",
        fetchImpl: fetchByUrl({
          routes: { [GAME_URL]: jsonResponse(gameBody), [LEAGUE_URL]: html },
        }),
      }),
      fetchLeaguePayload({
        leagueId: "106344",
        fetchImpl: fetchByUrl({
          routes: {
            [GAME_URL]: jsonResponse(gameBody),
            [LEAGUE_URL]: jsonResponse(leagueBody),
            [waiverUrl({ start: 0 })]: html,
          },
        }),
      }),
    ]);

    outcomes.forEach((outcome) => {
      expect(outcome).toEqual({ type: "error", reason: "unavailable" });
    });
  });

  it("does not retry a failed request", async () => {
    const fetchImpl = fetchByUrl({ routes: { [GAME_URL]: statusResponse(503) } });

    await fetchLeaguePayload({ leagueId: "106344", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up on a request that takes longer than 15 seconds", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn<FetchImpl>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal ?? null;
          if (!signal) return;
          signals.push(signal);
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    );

    const pending = fetchLeaguePayload({ leagueId: "106344", fetchImpl });
    vi.advanceTimersByTime(14_999);
    expect(signals.map((signal) => signal.aborted)).toEqual([false]);
    vi.advanceTimersByTime(1);

    expect(await pending).toEqual({ type: "error", reason: "unavailable" });
    expect(signals.map((signal) => signal.aborted)).toEqual([true]);
  });

  it("gives up on the whole read after 45 seconds even when each request answers in time", async () => {
    vi.useFakeTimers();
    const { fetchImpl, signals } = slowYahoo({ delayMs: 10_000 });
    const settled: unknown[] = [];

    void fetchLeaguePayload({ leagueId: "106344", fetchImpl }).then((result) => {
      settled.push(result);
    });
    await advanceBy({ ms: 44_999 });

    // The scoreboard ran alongside waivers; the third waiver page is still on its way.
    expect(settled).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(signals.map((signal) => signal.aborted)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);

    await advanceBy({ ms: 1 });

    expect(settled).toEqual([{ type: "error", reason: "unavailable" }]);
    expect(signals.at(-1)?.aborted ?? false).toBe(true);

    await advanceBy({ ms: 60_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("returns a league that finishes reading inside the deadline", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<FetchImpl>(
      (input) =>
        new Promise<Response>((resolve) => {
          const url = String(input);
          const body =
            url === GAME_URL
              ? gameBody
              : url === LEAGUE_URL
                ? leagueBody
                : url === SCOREBOARD_URL
                  ? scoreboardBody
                  : waiverPage({ size: 3 });
          setTimeout(() => resolve(jsonResponse(body)), 10_000);
        }),
    );
    const settled: unknown[] = [];

    void fetchLeaguePayload({ leagueId: "106344", fetchImpl }).then((result) => {
      settled.push(result);
    });
    await advanceBy({ ms: 42_000 });

    expect(settled).toEqual([
      {
        type: "league",
        payload: {
          game: gameBody,
          snapshot: leagueBody,
          waiverPages: [waiverPage({ size: 3 })],
          scoreboard: scoreboardBody,
        },
      },
    ]);
  });
});
