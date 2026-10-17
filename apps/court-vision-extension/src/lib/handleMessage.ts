import type { FetchImpl } from "@vision/core/util/fetchImpl";
import { BRIDGE_VERSION, isBridgeRequest } from "@vision/yahoo-bridge/protocol";
import type { BridgeResponse } from "@vision/yahoo-bridge/protocol";

import { fetchLeaguePayload } from "@/lib/yahooRequests";

/**
 * Answers one message from a web page. The sender's origin is checked before
 * anything else, so a page that isn't Court Vision never causes a Yahoo request.
 */
export const handleExternalMessage = async ({
  message,
  senderOrigin,
  allowedOrigins,
  fetchImpl,
}: {
  message: unknown;
  senderOrigin: string | null;
  allowedOrigins: readonly string[];
  fetchImpl: FetchImpl;
}): Promise<BridgeResponse> => {
  if (senderOrigin === null || !allowedOrigins.includes(senderOrigin)) {
    return { type: "error", reason: "forbidden_origin" };
  }
  if (!isBridgeRequest(message)) return { type: "error", reason: "bad_request" };
  if (message.type === "ping") return { type: "pong", version: BRIDGE_VERSION };
  return fetchLeaguePayload({ leagueId: message.leagueId, fetchImpl });
};
