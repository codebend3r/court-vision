import { describe, expect, it, vi } from "vitest";

import { nbaFetch } from "./client";

const noopSleep = async (): Promise<void> => {};

const okResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const errorResponse = (status: number): Response =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

describe("nbaFetch", () => {
  it("requests the right URL with NBA headers and returns parsed JSON", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => okResponse({ resultSets: [] }));
    const result = await nbaFetch({
      endpoint: "playerindex",
      params: { Season: "2025-26", LeagueID: "00" },
      fetchImpl,
      sleep: noopSleep,
    });

    expect(result).toEqual({ resultSets: [] });
    const url = fetchImpl.mock.lastCall?.[0]?.toString() ?? "";
    const init = fetchImpl.mock.lastCall?.[1] ?? {};
    expect(url).toContain("/playerindex?");
    expect(url).toContain("Season=2025-26");
    expect(init).toMatchObject({
      headers: expect.objectContaining({ "x-nba-stats-token": "true" }),
    });
  });

  it("retries on 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse({ ok: 1 }));
    const result = await nbaFetch({
      endpoint: "x",
      params: {},
      fetchImpl,
      sleep: noopSleep,
    });
    expect(result).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on 500", async () => {
    const fetchImpl = vi.fn(async () => errorResponse(500));
    await expect(
      nbaFetch({ endpoint: "x", params: {}, fetchImpl, sleep: noopSleep, maxRetries: 2 }),
    ).rejects.toThrow(/500/);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("retries a timeout (AbortError) then rethrows", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchImpl = vi.fn(async () => {
      throw abort;
    });
    await expect(
      nbaFetch({ endpoint: "x", params: {}, fetchImpl, sleep: noopSleep, maxRetries: 1 }),
    ).rejects.toThrow(/aborted/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
