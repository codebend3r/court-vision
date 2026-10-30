import { beforeEach, describe, expect, it, vi } from "bun:test";

import { type BridgeLeaguePayload } from "@vision/yahoo-bridge/protocol";

import { type ExtensionLeagueResult } from "@/lib/yahoo/extensionClient";
import { type YahooSyncResult } from "@/lib/yahoo/types";

type SyncYahooLeagueMockProps = { leagueId: string };

const syncYahooLeagueMock = vi.fn<(args: SyncYahooLeagueMockProps) => Promise<YahooSyncResult>>();

type SyncYahooLeagueProps = { leagueId: string };

vi.mock("@/lib/yahoo/actions", () => ({
  syncYahooLeague: (args: SyncYahooLeagueProps) => syncYahooLeagueMock(args),
}));

type SyncYahooLeagueFromSnapshotMockProps = { leagueId: string; payload: unknown };

const syncYahooLeagueFromSnapshotMock =
  vi.fn<(args: SyncYahooLeagueFromSnapshotMockProps) => Promise<YahooSyncResult>>();

type SyncYahooLeagueFromSnapshotProps = { leagueId: string; payload: unknown };

vi.mock("@/lib/yahoo/snapshotActions", () => ({
  syncYahooLeagueFromSnapshot: (args: SyncYahooLeagueFromSnapshotProps) =>
    syncYahooLeagueFromSnapshotMock(args),
}));

const getExtensionIdMock = vi.fn<() => string | null>();
type FetchLeagueViaExtensionMockProps = { extensionId: string; leagueId: string };

const fetchLeagueViaExtensionMock =
  vi.fn<(args: FetchLeagueViaExtensionMockProps) => Promise<ExtensionLeagueResult>>();

type FetchLeagueViaExtensionProps = { extensionId: string; leagueId: string };

vi.mock("@/lib/yahoo/extensionClient", () => ({
  getExtensionId: () => getExtensionIdMock(),
  fetchLeagueViaExtension: (args: FetchLeagueViaExtensionProps) =>
    fetchLeagueViaExtensionMock(args),
}));

import { syncLeagueFromClient } from "@/lib/yahoo/clientSync";

const LEAGUE_ID = "league-1";
const LEAGUE_URL = "https://basketball.fantasysports.yahoo.com/nba/106344";
const EXTENSION_ID = "court-vision-extension-id";
const PAYLOAD: BridgeLeaguePayload = { game: {}, snapshot: {}, waiverPages: [] };
const SYNCED: YahooSyncResult = {
  status: "ok",
  syncedAt: "2026-10-16T12:00:00.000Z",
  unmatched: [],
  matchupsMissing: false,
};

beforeEach(() => {
  syncYahooLeagueMock.mockReset();
  syncYahooLeagueMock.mockResolvedValue(SYNCED);
  syncYahooLeagueFromSnapshotMock.mockReset();
  syncYahooLeagueFromSnapshotMock.mockResolvedValue(SYNCED);
  getExtensionIdMock.mockReset();
  getExtensionIdMock.mockReturnValue(EXTENSION_ID);
  fetchLeagueViaExtensionMock.mockReset();
  fetchLeagueViaExtensionMock.mockResolvedValue({ status: "ok", payload: PAYLOAD });
});

describe("syncLeagueFromClient", () => {
  it("syncs a server league through the extension when it is installed", async () => {
    const result = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "server",
      externalUrl: LEAGUE_URL,
    });

    expect(result).toEqual(SYNCED);
    expect(fetchLeagueViaExtensionMock).toHaveBeenCalledWith({
      extensionId: EXTENSION_ID,
      leagueId: "106344",
    });
    expect(syncYahooLeagueFromSnapshotMock).toHaveBeenCalledWith({
      leagueId: LEAGUE_ID,
      payload: PAYLOAD,
    });
    expect(syncYahooLeagueMock).not.toHaveBeenCalled();
  });

  it("syncs a server league on the server when no extension id is configured", async () => {
    getExtensionIdMock.mockReturnValue(null);

    const result = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "server",
      externalUrl: LEAGUE_URL,
    });

    expect(result).toEqual(SYNCED);
    expect(syncYahooLeagueMock).toHaveBeenCalledWith({ leagueId: LEAGUE_ID });
    expect(fetchLeagueViaExtensionMock).not.toHaveBeenCalled();
    expect(syncYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
  });

  it("falls back to the server when the extension is absent or can't read a server league", async () => {
    fetchLeagueViaExtensionMock.mockResolvedValueOnce({ status: "failed", reason: "logged_out" });

    const failed = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "server",
      externalUrl: LEAGUE_URL,
    });

    fetchLeagueViaExtensionMock.mockResolvedValueOnce({ status: "missing" });

    const missing = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "server",
      externalUrl: LEAGUE_URL,
    });

    expect(failed).toEqual(SYNCED);
    expect(missing).toEqual(SYNCED);
    expect(syncYahooLeagueMock).toHaveBeenCalledTimes(2);
    expect(syncYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
  });

  it("syncs a server league with no readable Yahoo URL on the server", async () => {
    const result = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "server",
      externalUrl: null,
    });

    expect(result).toEqual(SYNCED);
    expect(syncYahooLeagueMock).toHaveBeenCalledWith({ leagueId: LEAGUE_ID });
    expect(fetchLeagueViaExtensionMock).not.toHaveBeenCalled();
  });

  it("syncs an extension league through the extension", async () => {
    const result = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "extension",
      externalUrl: LEAGUE_URL,
    });

    expect(result).toEqual(SYNCED);
    expect(fetchLeagueViaExtensionMock).toHaveBeenCalledWith({
      extensionId: EXTENSION_ID,
      leagueId: "106344",
    });
    expect(syncYahooLeagueFromSnapshotMock).toHaveBeenCalledWith({
      leagueId: LEAGUE_ID,
      payload: PAYLOAD,
    });
    expect(syncYahooLeagueMock).not.toHaveBeenCalled();
  });

  it("passes the snapshot sync's failure through", async () => {
    syncYahooLeagueFromSnapshotMock.mockResolvedValue({ status: "throttled" });

    const result = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "extension",
      externalUrl: LEAGUE_URL,
    });

    expect(result).toEqual({ status: "throttled" });
    expect(syncYahooLeagueMock).not.toHaveBeenCalled();
  });

  it("reports extension_missing without calling the server", async () => {
    getExtensionIdMock.mockReturnValue(null);

    expect(
      await syncLeagueFromClient({
        leagueId: LEAGUE_ID,
        syncVia: "extension",
        externalUrl: LEAGUE_URL,
      }),
    ).toEqual({ status: "extension_missing" });
    expect(fetchLeagueViaExtensionMock).not.toHaveBeenCalled();

    getExtensionIdMock.mockReturnValue(EXTENSION_ID);
    fetchLeagueViaExtensionMock.mockResolvedValue({ status: "missing" });

    expect(
      await syncLeagueFromClient({
        leagueId: LEAGUE_ID,
        syncVia: "extension",
        externalUrl: LEAGUE_URL,
      }),
    ).toEqual({ status: "extension_missing" });
    expect(syncYahooLeagueMock).not.toHaveBeenCalled();
    expect(syncYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
  });

  it("reports the extension's failure without calling the server", async () => {
    fetchLeagueViaExtensionMock.mockResolvedValue({ status: "failed", reason: "logged_out" });

    const result = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "extension",
      externalUrl: LEAGUE_URL,
    });

    expect(result).toEqual({ status: "extension_failed", reason: "logged_out" });
    expect(syncYahooLeagueMock).not.toHaveBeenCalled();
    expect(syncYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
  });

  it("reports a bad request for an extension league with no readable Yahoo URL", async () => {
    const missingUrl = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "extension",
      externalUrl: null,
    });
    const unreadableUrl = await syncLeagueFromClient({
      leagueId: LEAGUE_ID,
      syncVia: "extension",
      externalUrl: "https://football.fantasysports.yahoo.com/f1/12345",
    });

    expect(missingUrl).toEqual({ status: "extension_failed", reason: "bad_request" });
    expect(unreadableUrl).toEqual({ status: "extension_failed", reason: "bad_request" });
    expect(fetchLeagueViaExtensionMock).not.toHaveBeenCalled();
    expect(syncYahooLeagueMock).not.toHaveBeenCalled();
    expect(syncYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
  });
});
