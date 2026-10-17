import { describe, expect, it, vi } from "bun:test";

import type { FetchImpl } from "@vision/core/util/fetchImpl";

import { YAHOO_API_BASE_URL } from "@/lib/yahoo/constants";
import { yahooFetch } from "@/lib/yahoo/client";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// The Response constructor rejects statuses outside 200-599, and Yahoo's rate
// limit signal is 999, so the stub overrides the two fields the client reads.
const statusResponse = (status: number): Response =>
  Object.defineProperties(new Response("", { status: 200 }), {
    status: { value: status },
    ok: { value: status >= 200 && status < 300 },
  });

const noSleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

describe("yahooFetch", () => {
  it("requests json_f from the read-only host", async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockImplementation(async () => jsonResponse({}));
    await yahooFetch({ path: "game/nba", fetchImpl, sleep: noSleep });
    await yahooFetch({
      path: "league/478.l.106344;out=settings/teams/roster?start=25",
      fetchImpl,
      sleep: noSleep,
    });
    expect(fetchImpl.mock.calls[0]?.[0]?.toString()).toBe(
      `${YAHOO_API_BASE_URL}/game/nba?format=json_f`,
    );
    expect(fetchImpl.mock.calls[1]?.[0]?.toString()).toBe(
      `${YAHOO_API_BASE_URL}/league/478.l.106344;out=settings/teams/roster?start=25&format=json_f`,
    );
  });

  it("returns the parsed body on 200", async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse({ fantasy_content: 1 }));
    const result = await yahooFetch({ path: "game/nba", fetchImpl, sleep: noSleep });
    expect(result).toEqual({ status: "ok", body: { fantasy_content: 1 } });
  });

  it("reports a 400 as not_found without retrying", async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockImplementation(async () => statusResponse(400));
    const result = await yahooFetch({ path: "league/x", fetchImpl, sleep: noSleep });
    expect(result).toEqual({ status: "not_found" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx and 999 then reports unavailable", async () => {
    const statuses = [503, 999, 500];
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockImplementation(async () => statusResponse(statuses.shift() ?? 500));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const result = await yahooFetch({ path: "game/nba", fetchImpl, sleep, maxRetries: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
    expect(result.status).toBe("unavailable");
  });

  it("reports any other 4xx as unavailable with the status in the detail", async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockImplementation(async () => statusResponse(403));
    const result = await yahooFetch({ path: "game/nba", fetchImpl, sleep: noSleep });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "unavailable" });
    expect(result.status === "unavailable" && result.detail).toContain("403");
  });

  it("retries a body that is not JSON", async () => {
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValueOnce(new Response("<html>", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const result = await yahooFetch({ path: "game/nba", fetchImpl, sleep: noSleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: "ok", body: { ok: true } });
  });

  it("never throws when fetch rejects", async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockRejectedValue(new TypeError("network down"));
    const result = await yahooFetch({ path: "game/nba", fetchImpl, sleep: noSleep });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("unavailable");
  });

  it("reports unavailable when the request times out", async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const result = await yahooFetch({
      path: "game/nba",
      fetchImpl,
      sleep: noSleep,
      maxRetries: 0,
      timeoutMs: 5,
    });
    expect(result.status).toBe("unavailable");
  });
});
