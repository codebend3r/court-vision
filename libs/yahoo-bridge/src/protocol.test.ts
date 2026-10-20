import { describe, expect, it } from "bun:test";

import {
  BRIDGE_VERSION,
  isBridgeLeaguePayload,
  isBridgeRequest,
  isBridgeResponse,
} from "#bridge/protocol";

describe("isBridgeRequest", () => {
  it("accepts each request shape", () => {
    expect(isBridgeRequest({ type: "ping" })).toBe(true);
    expect(isBridgeRequest({ type: "fetchLeague", leagueId: "106344" })).toBe(true);
  });

  it("rejects malformed requests", () => {
    const malformed: unknown[] = [
      null,
      "ping",
      { type: "fetchLeague" },
      { type: "fetchLeague", leagueId: 106344 },
      { type: "fetchLeague", leagueId: "abc" },
      { type: "fetchLeague", leagueId: "1234567890" },
      { type: "nuke" },
    ];
    expect(malformed.map((value) => isBridgeRequest(value))).toEqual(malformed.map(() => false));
  });
});

describe("isBridgeResponse", () => {
  it("accepts each response shape", () => {
    expect(isBridgeResponse({ type: "pong", version: BRIDGE_VERSION })).toBe(true);
    expect(
      isBridgeResponse({
        type: "league",
        payload: { game: {}, snapshot: {}, waiverPages: [] },
      }),
    ).toBe(true);
    expect(isBridgeResponse({ type: "error", reason: "logged_out" })).toBe(true);
  });

  it("rejects an error with an unknown reason", () => {
    expect(isBridgeResponse({ type: "error", reason: "exploded" })).toBe(false);
    expect(isBridgeResponse({ type: "error" })).toBe(false);
  });

  it("rejects malformed pong and league responses", () => {
    expect(isBridgeResponse({ type: "pong", version: "1" })).toBe(false);
    expect(isBridgeResponse({ type: "league", payload: { game: {} } })).toBe(false);
    expect(isBridgeResponse(null)).toBe(false);
    expect(isBridgeResponse({ type: "nuke" })).toBe(false);
  });
});

describe("isBridgeLeaguePayload", () => {
  it("accepts any game and snapshot with an array of waiver pages", () => {
    expect(isBridgeLeaguePayload({ game: null, snapshot: "x", waiverPages: [{}, 1] })).toBe(true);
  });

  it("requires waiverPages to be an array", () => {
    expect(isBridgeLeaguePayload({ game: {}, snapshot: {}, waiverPages: {} })).toBe(false);
    expect(isBridgeLeaguePayload({ game: {}, snapshot: {} })).toBe(false);
  });

  it("requires game and snapshot to be present", () => {
    expect(isBridgeLeaguePayload({ snapshot: {}, waiverPages: [] })).toBe(false);
    expect(isBridgeLeaguePayload({ game: {}, waiverPages: [] })).toBe(false);
    expect(isBridgeLeaguePayload(null)).toBe(false);
  });
});
