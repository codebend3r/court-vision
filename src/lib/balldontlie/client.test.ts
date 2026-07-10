import { describe, expect, it, vi } from "vitest";

import { bdlFetch } from "./client";

const jsonResponse = (
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.headers ?? { "content-type": "application/json" },
  });

describe("bdlFetch", () => {
  it("sends the api key header and serializes array params", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }));
    await bdlFetch({
      endpoint: "stats",
      params: { seasons: ["2025"], postseason: "false", per_page: "100" },
      apiKey: "test-key",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = fetchImpl.mock.lastCall?.[0]?.toString() ?? "";
    const init = fetchImpl.mock.lastCall?.[1] ?? {};
    expect(url).toContain("https://api.balldontlie.io/v1/stats?");
    expect(url).toContain("seasons[]=2025");
    expect(url).toContain("postseason=false");
    expect(init).toMatchObject({ headers: { Authorization: "test-key" } });
  });

  it("retries on 429 then resolves, sleeping between attempts", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ data: [1] }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const result = await bdlFetch({ endpoint: "teams", apiKey: "k", fetchImpl, sleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: [1] });
  });

  it("honors a Retry-After header on 429", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await bdlFetch({ endpoint: "teams", apiKey: "k", fetchImpl, sleep });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("retries on a network TypeError", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const result = await bdlFetch({ endpoint: "teams", apiKey: "k", fetchImpl, sleep });
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on 5xx", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, { status: 500 }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(
      bdlFetch({ endpoint: "teams", apiKey: "k", fetchImpl, sleep, maxRetries: 2 }),
    ).rejects.toThrow(/failed \(500\)/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
