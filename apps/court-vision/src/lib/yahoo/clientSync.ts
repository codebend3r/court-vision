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

// Syncs a league along the path it was imported on. A server league asks the
// server to read Yahoo; an extension league is read by the extension in this
// browser and handed to the server as a snapshot. An extension league never
// reaches the server sync, which can't read a private league and would record
// a syncError for it.
type SyncLeagueFromClientProps = {
  leagueId: string;
  syncVia: LeagueSyncVia;
  // The Yahoo league id is parsed back out of it.
  externalUrl: string | null;
};

export const syncLeagueFromClient = async ({
  leagueId,
  syncVia,
  externalUrl,
}: SyncLeagueFromClientProps): Promise<ClientSyncResult> => {
  if (syncVia === "server") return syncYahooLeague({ leagueId });

  const extensionId = getExtensionId();
  if (extensionId === null) return { status: "extension_missing" };

  const parsed = parseYahooLeagueUrl({ input: externalUrl ?? "" });
  if (parsed.status !== "ok") return { status: "extension_failed", reason: "bad_request" };

  const fetched = await fetchLeagueViaExtension({ extensionId, leagueId: parsed.leagueId });
  if (fetched.status === "missing") return { status: "extension_missing" };
  if (fetched.status === "failed") return { status: "extension_failed", reason: fetched.reason };
  return syncYahooLeagueFromSnapshot({ leagueId, payload: fetched.payload });
};
