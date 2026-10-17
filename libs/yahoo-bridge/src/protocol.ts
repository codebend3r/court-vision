export const BRIDGE_VERSION = 1;

export type BridgeRequest = { type: "ping" } | { type: "fetchLeague"; leagueId: string };

export type BridgeLeaguePayload = {
  game: unknown;
  snapshot: unknown;
  waiverPages: unknown[];
};

export type BridgeErrorReason =
  | "forbidden_origin"
  | "bad_request"
  | "logged_out"
  | "not_found"
  | "unavailable";

export type BridgeResponse =
  | { type: "pong"; version: number }
  | { type: "league"; payload: BridgeLeaguePayload }
  | { type: "error"; reason: BridgeErrorReason };

const ERROR_REASONS: readonly string[] = [
  "forbidden_origin",
  "bad_request",
  "logged_out",
  "not_found",
  "unavailable",
];

const LEAGUE_ID_PATTERN = /^\d{1,9}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isBridgeRequest = (value: unknown): value is BridgeRequest => {
  if (!isRecord(value)) return false;
  if (value.type === "ping") return true;
  return (
    value.type === "fetchLeague" &&
    typeof value.leagueId === "string" &&
    LEAGUE_ID_PATTERN.test(value.leagueId)
  );
};

export const isBridgeLeaguePayload = (value: unknown): value is BridgeLeaguePayload =>
  isRecord(value) &&
  value.game !== undefined &&
  value.snapshot !== undefined &&
  Array.isArray(value.waiverPages);

export const isBridgeResponse = (value: unknown): value is BridgeResponse => {
  if (!isRecord(value)) return false;
  if (value.type === "pong") return typeof value.version === "number";
  if (value.type === "league") return isBridgeLeaguePayload(value.payload);
  return (
    value.type === "error" &&
    typeof value.reason === "string" &&
    ERROR_REASONS.includes(value.reason)
  );
};
