import { describe, expect, it, vi } from "bun:test";

import type { FetchImpl } from "@vision/core/util/fetchImpl";
import { BRIDGE_VERSION } from "@vision/yahoo-bridge/protocol";

import { handleExternalMessage } from "@/lib/handleMessage";
import { allowedOrigins } from "@/lib/origins";

const PRODUCTION_ORIGINS = allowedOrigins({ isDev: false });
const COURT_VISION = "https://court-vizion.netlify.app";

const gameBody = { fantasy_content: { game: { game_key: "478" } } };
const leagueBody = { fantasy_content: { league: { league_key: "478.l.106344" } } };
const waiverBody = { fantasy_content: { league: { players: [] } } };

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

// Answers the game, league and waiver requests by the path each one asks for.
const yahooFetch = () =>
  vi.fn<FetchImpl>(async (input) => {
    const url = String(input);
    if (url.includes("/players;status=W;")) return jsonResponse(waiverBody);
    if (url.includes("/league/")) return jsonResponse(leagueBody);
    return jsonResponse(gameBody);
  });

describe("handleExternalMessage", () => {
  it("refuses a sender that isn't Court Vision", async () => {
    const senders = [
      "https://evil.example",
      "https://deploy-preview-12--court-vizion.netlify.app",
      "http://localhost:46644",
      "https://court-vizion.netlify.app.evil.example",
      null,
    ];

    await Promise.all(
      senders.map(async (senderOrigin) => {
        const fetchImpl = yahooFetch();

        const response = await handleExternalMessage({
          message: { type: "fetchLeague", leagueId: "106344" },
          senderOrigin,
          allowedOrigins: PRODUCTION_ORIGINS,
          fetchImpl,
        });

        expect(response).toEqual({ type: "error", reason: "forbidden_origin" });
        expect(fetchImpl).not.toHaveBeenCalled();
      }),
    );
  });

  it("checks the sender before the message's shape", async () => {
    const fetchImpl = yahooFetch();

    const response = await handleExternalMessage({
      message: { type: "deleteEverything" },
      senderOrigin: "https://evil.example",
      allowedOrigins: PRODUCTION_ORIGINS,
      fetchImpl,
    });

    expect(response).toEqual({ type: "error", reason: "forbidden_origin" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers a ping with the protocol version", async () => {
    const fetchImpl = yahooFetch();

    const response = await handleExternalMessage({
      message: { type: "ping" },
      senderOrigin: COURT_VISION,
      allowedOrigins: PRODUCTION_ORIGINS,
      fetchImpl,
    });

    expect(response).toEqual({ type: "pong", version: BRIDGE_VERSION });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a malformed request", async () => {
    const messages = [
      null,
      "ping",
      { type: "fetchLeague" },
      { type: "fetchLeague", leagueId: "106344/../users" },
      { type: "deleteEverything" },
    ];

    await Promise.all(
      messages.map(async (message) => {
        const fetchImpl = yahooFetch();

        const response = await handleExternalMessage({
          message,
          senderOrigin: COURT_VISION,
          allowedOrigins: PRODUCTION_ORIGINS,
          fetchImpl,
        });

        expect(response).toEqual({ type: "error", reason: "bad_request" });
        expect(fetchImpl).not.toHaveBeenCalled();
      }),
    );
  });

  it("returns the league payload", async () => {
    const fetchImpl = yahooFetch();

    const response = await handleExternalMessage({
      message: { type: "fetchLeague", leagueId: "106344" },
      senderOrigin: COURT_VISION,
      allowedOrigins: PRODUCTION_ORIGINS,
      fetchImpl,
    });

    expect(response).toEqual({
      type: "league",
      payload: { game: gameBody, snapshot: leagueBody, waiverPages: [waiverBody] },
    });
  });

  it("passes Yahoo's failure through unchanged", async () => {
    const fetchImpl = vi.fn<FetchImpl>(() => Promise.reject(new TypeError("Failed to fetch")));

    const response = await handleExternalMessage({
      message: { type: "fetchLeague", leagueId: "106344" },
      senderOrigin: COURT_VISION,
      allowedOrigins: PRODUCTION_ORIGINS,
      fetchImpl,
    });

    expect(response).toEqual({ type: "error", reason: "unavailable" });
  });

  it("answers the local dev server when the allowlist includes it", async () => {
    const response = await handleExternalMessage({
      message: { type: "ping" },
      senderOrigin: "http://localhost:46644",
      allowedOrigins: allowedOrigins({ isDev: true }),
      fetchImpl: yahooFetch(),
    });

    expect(response).toEqual({ type: "pong", version: BRIDGE_VERSION });
  });
});
