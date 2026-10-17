import { isRecord } from "@vision/core/util/record";
import {
  type BridgeErrorReason,
  type BridgeLeaguePayload,
  type BridgeRequest,
  isBridgeResponse,
} from "@vision/yahoo-bridge/protocol";

// The app's side of the Court Vision extension: it finds the extension by the
// id Netlify carries, asks it to ping or to read a league through the user's
// Yahoo login, and turns every answer into one of a few outcomes.

export type ExtensionSend = (args: {
  extensionId: string;
  message: BridgeRequest;
}) => Promise<unknown>;

export type ExtensionLeagueResult =
  | { status: "ok"; payload: BridgeLeaguePayload }
  // No chrome.runtime, no answer in time, or an answer that isn't a bridge response.
  | { status: "missing" }
  | { status: "failed"; reason: BridgeErrorReason };

const PING_TIMEOUT_MS = 1_500;
const LEAGUE_TIMEOUT_MS = 60_000;

// Next inlines NEXT_PUBLIC_* at build time only for a direct property access,
// so the variable is read by name. With no id, every extension path hides.
export const getExtensionId = (): string | null => {
  const extensionId = process.env.NEXT_PUBLIC_COURT_VISION_EXTENSION_ID?.trim() ?? "";
  return extensionId === "" ? null : extensionId;
};

export const extensionStoreUrl = ({ extensionId }: { extensionId: string }): string =>
  `https://chromewebstore.google.com/detail/${extensionId}`;

// Chrome exposes chrome.runtime.sendMessage to a page only when an installed
// extension lists the page in externally_connectable; elsewhere it is absent.
export const chromeSend: ExtensionSend = async ({ extensionId, message }) => {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  const runtime = isRecord(chromeValue) ? chromeValue.runtime : undefined;
  if (!isRecord(runtime) || typeof runtime.sendMessage !== "function") {
    throw new Error("chrome.runtime.sendMessage is unavailable");
  }
  const answer: unknown = await runtime.sendMessage(extensionId, message);
  return answer;
};

// Resolves with the extension's answer, or rejects when it fails or takes
// longer than `timeoutMs`. The timer is cleared either way.
const sendWithTimeout = ({
  extensionId,
  message,
  send,
  timeoutMs,
}: {
  extensionId: string;
  message: BridgeRequest;
  send: ExtensionSend;
  timeoutMs: number;
}): Promise<unknown> =>
  new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`The extension didn't answer within ${timeoutMs}ms`));
    }, timeoutMs);
    Promise.resolve()
      .then(() => send({ extensionId, message }))
      .then(
        (answer) => {
          clearTimeout(timer);
          resolve(answer);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
  });

export const pingExtension = async ({
  extensionId,
  send = chromeSend,
  timeoutMs = PING_TIMEOUT_MS,
}: {
  extensionId: string;
  send?: ExtensionSend;
  timeoutMs?: number;
}): Promise<boolean> => {
  try {
    const answer = await sendWithTimeout({
      extensionId,
      message: { type: "ping" },
      send,
      timeoutMs,
    });
    return isBridgeResponse(answer) && answer.type === "pong";
  } catch {
    return false;
  }
};

export const fetchLeagueViaExtension = async ({
  extensionId,
  leagueId,
  send = chromeSend,
  timeoutMs = LEAGUE_TIMEOUT_MS,
}: {
  extensionId: string;
  leagueId: string;
  send?: ExtensionSend;
  timeoutMs?: number;
}): Promise<ExtensionLeagueResult> => {
  try {
    const answer = await sendWithTimeout({
      extensionId,
      message: { type: "fetchLeague", leagueId },
      send,
      timeoutMs,
    });
    if (!isBridgeResponse(answer)) return { status: "missing" };
    if (answer.type === "league") return { status: "ok", payload: answer.payload };
    if (answer.type === "error") return { status: "failed", reason: answer.reason };
    return { status: "missing" };
  } catch {
    return { status: "missing" };
  }
};
