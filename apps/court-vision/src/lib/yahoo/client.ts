import type { FetchImpl } from "@vision/core/util/fetchImpl";

import { YAHOO_API_BASE_URL } from "@/lib/yahoo/constants";

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

// Yahoo answers a throttled caller with the non-standard status 999.
const YAHOO_RATE_LIMIT_STATUS = 999;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const backoffMs = (attemptNumber: number): number => 2 ** attemptNumber * 500;

const describeError = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";

const buildUrl = (path: string): string =>
  `${YAHOO_API_BASE_URL}/${path}${path.includes("?") ? "&" : "?"}format=json_f`;

/**
 * Read-only GET against Yahoo's `pub-api-ro` host. Never throws: every outcome
 * is a `YahooFetchResult`. 5xx, 999, network errors, timeouts and non-JSON
 * bodies are retried with exponential backoff; a 400 means the league or game
 * does not exist; any other 4xx is not retried.
 */
export async function yahooFetch({
  path,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxRetries = 2,
  timeoutMs = 15_000,
}: YahooFetchOptions): Promise<YahooFetchResult> {
  const url = buildUrl(path);

  const retryOrGiveUp = async ({
    retriesLeft,
    detail,
  }: {
    retriesLeft: number;
    detail: string;
  }): Promise<YahooFetchResult> => {
    if (retriesLeft <= 0) return { status: "unavailable", detail };
    await sleep(backoffMs(maxRetries - retriesLeft));
    return attempt(retriesLeft - 1);
  };

  const attempt = async (retriesLeft: number): Promise<YahooFetchResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (response.status === 400) return { status: "not_found" };
      if (response.status >= 500 || response.status === YAHOO_RATE_LIMIT_STATUS) {
        return await retryOrGiveUp({
          retriesLeft,
          detail: `Yahoo responded ${response.status} for ${path}`,
        });
      }
      if (!response.ok) {
        return { status: "unavailable", detail: `Yahoo responded ${response.status} for ${path}` };
      }
      const text = await response.text();
      try {
        const body: unknown = JSON.parse(text);
        return { status: "ok", body };
      } catch {
        // A 200 with an HTML or truncated body is a transient upstream hiccup.
        return await retryOrGiveUp({
          retriesLeft,
          detail: `Yahoo sent an unparseable body for ${path}`,
        });
      }
    } catch (error) {
      return retryOrGiveUp({
        retriesLeft,
        detail: `Yahoo request failed for ${path} (${describeError(error)})`,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  return attempt(maxRetries);
}
