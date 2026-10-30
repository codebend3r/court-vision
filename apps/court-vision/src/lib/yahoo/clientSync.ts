import { type BridgeErrorReason } from "@vision/yahoo-bridge/protocol";

import { type LeagueSyncVia } from "@/lib/leagues/types";
import { syncYahooLeague } from "@/lib/yahoo/actions";
import { fetchLeagueViaExtension, getExtensionId } from "@/lib/yahoo/extensionClient";
import { syncYahooLeagueFromSnapshot } from "@/lib/yahoo/snapshotActions";
import { type YahooSyncResult } from "@/lib/yahoo/types";
import { parseYahooLeagueUrl } from "@/lib/yahoo/url";

export type ClientSyncResult =
  | YahooSyncResult
  // No extension id is configured, or the extension never answered.
  | { status: "extension_missing" }
  | { status: "extension_failed"; reason: BridgeErrorReason };

// Reads the league through the extension in this browser and hands it to the
// server as a snapshot.
type SyncThroughExtensionProps = {
  leagueId: string;
  // The Yahoo league id is parsed back out of it.
  externalUrl: string | null;
};

const syncThroughExtension = async ({
  leagueId,
  externalUrl,
}: SyncThroughExtensionProps): Promise<ClientSyncResult> => {
  const extensionId = getExtensionId();
  if (extensionId === null) return { status: "extension_missing" };

  const parsed = parseYahooLeagueUrl({ input: externalUrl ?? "" });
  if (parsed.status !== "ok") return { status: "extension_failed", reason: "bad_request" };

  const fetched = await fetchLeagueViaExtension({ extensionId, leagueId: parsed.leagueId });
  if (fetched.status === "missing") return { status: "extension_missing" };
  if (fetched.status === "failed") return { status: "extension_failed", reason: fetched.reason };
  return syncYahooLeagueFromSnapshot({ leagueId, payload: fetched.payload });
};

// Every league tries the extension first: it reads Yahoo with the user's own
// login, so it can sync a private league. When it can't read the league, a
// server league falls back to the server sync. An extension league never
// reaches the server sync, which can't read a private league and would record
// a syncError for it.
type SyncLeagueFromClientProps = {
  leagueId: string;
  syncVia: LeagueSyncVia;
  externalUrl: string | null;
};

export const syncLeagueFromClient = async ({
  leagueId,
  syncVia,
  externalUrl,
}: SyncLeagueFromClientProps): Promise<ClientSyncResult> => {
  const viaExtension = await syncThroughExtension({ leagueId, externalUrl });
  const extensionCouldNotRead =
    viaExtension.status === "extension_missing" || viaExtension.status === "extension_failed";
  return syncVia === "server" && extensionCouldNotRead
    ? syncYahooLeague({ leagueId })
    : viaExtension;
};
