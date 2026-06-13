import { NBA_BASE_URL, NBA_HEADERS } from "./constants";

export interface NbaFetchOptions {
  endpoint: string;
  params: Record<string, string>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  timeoutMs?: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const backoffMs = (attemptNumber: number): number => 2 ** attemptNumber * 500;

const isRetryableError = (error: unknown): boolean =>
  error instanceof Error && (error.name === "AbortError" || error.name === "TypeError");

export async function nbaFetch({
  endpoint,
  params,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxRetries = 3,
  timeoutMs = 30000,
}: NbaFetchOptions): Promise<unknown> {
  const url = `${NBA_BASE_URL}/${endpoint}?${new URLSearchParams(params).toString()}`;

  const attempt = async (retriesLeft: number): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { headers: NBA_HEADERS, signal: controller.signal });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && retriesLeft > 0) {
          await sleep(backoffMs(maxRetries - retriesLeft));
          return attempt(retriesLeft - 1);
        }
        throw new Error(`NBA request failed (${response.status}) for ${endpoint}`);
      }
      return await response.json();
    } catch (error) {
      if (retriesLeft > 0 && isRetryableError(error)) {
        await sleep(backoffMs(maxRetries - retriesLeft));
        return attempt(retriesLeft - 1);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  return attempt(maxRetries);
}
