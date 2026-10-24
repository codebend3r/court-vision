import type { FetchImpl } from "@vision/core/util/fetchImpl";

import { YAHOO_API_BASE_URL } from "@vision/yahoo-bridge/constants";

export type YahooFetchResult =
  | { status: "ok"; body: unknown }
  | { status: "not_found" }
  | { status: "unavailable"; detail: string };

type YahooFetchOptions = {
  path: string;
  fetchImpl?: FetchImpl;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  timeoutMs?: number;
};

// What Yahoo says for a league it won't show an anonymous caller: 400 when it
// doesn't exist, 401 or 403 when it is private.
const NOT_FOUND_STATUSES: readonly number[] = [400, 401, 403];

// Yahoo answers a throttled caller with the non-standard status 999.
const YAHOO_RATE_LIMIT_STATUS = 999;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const backoffMs = (attemptNumber: number): number => 2 ** attemptNumber * 500;

const describeError = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";

const buildUrl = (path: string): string =>
  `${YAHOO_API_BASE_URL}/${path}${path.includes("?") ? "&" : "?"}format=json_f`;

// One request's outcome: final, or a transient failure worth another attempt.
type AttemptOutcome = YahooFetchResult | { status: "retry"; detail: string };

/**
 * Read-only GET against Yahoo's `pub-api-ro` host. Never throws: every outcome
 * is a `YahooFetchResult`. 5xx, 999, network errors, timeouts and non-JSON
 * bodies are retried with exponential backoff; a 400 means the league or game
 * does not exist, and a 401 or 403 means a private league, which this
 * unauthenticated host won't read: both are `not_found`. Any other 4xx is not
 * retried. The defaults keep a load's
 * handful of requests inside a serverless function's time limit.
 */
export async function yahooFetch({
  path,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxRetries = 1,
  timeoutMs = 4_000,
}: YahooFetchOptions): Promise<YahooFetchResult> {
  const url = buildUrl(path);

  // One request, timed from the call until its body is read. The timer is
  // cleared before any backoff, so it never outlives its own attempt.
  const fetchOnce = async (): Promise<AttemptOutcome> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (NOT_FOUND_STATUSES.includes(response.status)) return { status: "not_found" };
      if (response.status >= 500 || response.status === YAHOO_RATE_LIMIT_STATUS) {
        return { status: "retry", detail: `Yahoo responded ${response.status} for ${path}` };
      }
      if (!response.ok) {
        return { status: "unavailable", detail: `Yahoo responded ${response.status} for ${path}` };
      }
      const text = await response.text();
      clearTimeout(timer);
      try {
        const body: unknown = JSON.parse(text);
        return { status: "ok", body };
      } catch {
        // A 200 with an HTML or truncated body is a transient upstream hiccup.
        return { status: "retry", detail: `Yahoo sent an unparseable body for ${path}` };
      }
    } catch (error) {
      return {
        status: "retry",
        detail: `Yahoo request failed for ${path} (${describeError(error)})`,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  const attempt = async (retriesLeft: number): Promise<YahooFetchResult> => {
    const outcome = await fetchOnce();
    if (outcome.status !== "retry") return outcome;
    if (retriesLeft <= 0) return { status: "unavailable", detail: outcome.detail };
    await sleep(backoffMs(maxRetries - retriesLeft));
    return attempt(retriesLeft - 1);
  };

  return attempt(maxRetries);
}
