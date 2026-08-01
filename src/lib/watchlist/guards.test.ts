import { describe, expect, it } from "bun:test";

import { isWatchlistActionResult } from "@/lib/watchlist/guards";

describe("isWatchlistActionResult", () => {
  it("accepts an ok result with a count", () => {
    expect(isWatchlistActionResult({ status: "ok", count: 3 })).toBe(true);
  });

  it("accepts a limit result with a count", () => {
    expect(isWatchlistActionResult({ status: "limit", count: 50 })).toBe(true);
  });

  it("accepts the countless statuses", () => {
    expect(isWatchlistActionResult({ status: "unauthenticated" })).toBe(true);
    expect(isWatchlistActionResult({ status: "error" })).toBe(true);
  });

  it("rejects ok without a numeric count", () => {
    expect(isWatchlistActionResult({ status: "ok" })).toBe(false);
    expect(isWatchlistActionResult({ status: "ok", count: "3" })).toBe(false);
  });

  it("rejects unknown statuses and non-objects", () => {
    expect(isWatchlistActionResult({ status: "nope" })).toBe(false);
    expect(isWatchlistActionResult(null)).toBe(false);
    expect(isWatchlistActionResult("ok")).toBe(false);
    expect(isWatchlistActionResult(undefined)).toBe(false);
  });
});
