import { BDL_BASE_URL, getApiKey } from "@/lib/balldontlie/constants";

export type BdlParamValue = string | string[];

export interface BdlFetchOptions {
  endpoint: string;
  params?: Record<string, BdlParamValue>;
  apiKey?: string;
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

const buildQuery = (params: Record<string, BdlParamValue>): string =>
  Object.entries(params)
    .flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((entry) => `${encodeURIComponent(key)}[]=${encodeURIComponent(entry)}`)
        : [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`],
    )
    .join("&");

const retryAfterMs = (response: Response, fallback: number): number => {
  const header = response.headers.get("retry-after");
  const seconds = header === null ? Number.NaN : Number.parseInt(header, 10);
  return Number.isNaN(seconds) ? fallback : seconds * 1000;
};

export async function bdlFetch({
  endpoint,
  params = {},
  apiKey,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxRetries = 3,
  timeoutMs = 30000,
}: BdlFetchOptions): Promise<unknown> {
  const key = apiKey ?? getApiKey();
  const query = buildQuery(params);
  const url = query === "" ? `${BDL_BASE_URL}/${endpoint}` : `${BDL_BASE_URL}/${endpoint}?${query}`;

  const attempt = async (retriesLeft: number): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { Authorization: key },
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && retriesLeft > 0) {
          const fallback = backoffMs(maxRetries - retriesLeft);
          await sleep(response.status === 429 ? retryAfterMs(response, fallback) : fallback);
          return attempt(retriesLeft - 1);
        }
        throw new Error(`Balldontlie request failed (${response.status}) for ${endpoint}`);
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
