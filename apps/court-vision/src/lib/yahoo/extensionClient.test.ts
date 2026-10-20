import { afterEach, describe, expect, it, vi } from "bun:test";

import { restoreEnv, stubEnv } from "@vision/testing/env";
import { BRIDGE_VERSION } from "@vision/yahoo-bridge/protocol";

import {
  chromeSend,
  type ExtensionSend,
  extensionStoreUrl,
  fetchLeagueViaExtension,
  getExtensionId,
  pingExtension,
} from "@/lib/yahoo/extensionClient";

const EXTENSION_ID = "kkonhioibmfcogphfmoplgmfdpkngjif";

const PAYLOAD = { game: {}, snapshot: {}, waiverPages: [] };

const neverAnswers: ExtensionSend = () => new Promise<unknown>(() => {});

afterEach(() => {
  restoreEnv();
  Reflect.deleteProperty(globalThis, "chrome");
});

describe("getExtensionId", () => {
  it("hides the extension when no id is configured", () => {
    stubEnv({ key: "NEXT_PUBLIC_COURT_VISION_EXTENSION_ID", value: "" });
    expect(getExtensionId()).toBeNull();

    stubEnv({ key: "NEXT_PUBLIC_COURT_VISION_EXTENSION_ID", value: "  " });
    expect(getExtensionId()).toBeNull();

    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_COURT_VISION_EXTENSION_ID");
    expect(getExtensionId()).toBeNull();
  });

  it("returns the trimmed id when one is configured", () => {
    stubEnv({ key: "NEXT_PUBLIC_COURT_VISION_EXTENSION_ID", value: ` ${EXTENSION_ID}\n` });

    expect(getExtensionId()).toBe(EXTENSION_ID);
  });
});

describe("extensionStoreUrl", () => {
  it("links to the extension's Chrome Web Store page", () => {
    expect(extensionStoreUrl({ extensionId: EXTENSION_ID })).toBe(
      `https://chromewebstore.google.com/detail/${EXTENSION_ID}`,
    );
  });
});

describe("chromeSend", () => {
  it("treats a missing chrome.runtime as missing", async () => {
    expect(Reflect.get(globalThis, "chrome")).toBeUndefined();

    await expect(
      chromeSend({ extensionId: EXTENSION_ID, message: { type: "ping" } }),
    ).rejects.toThrow();
    expect(await pingExtension({ extensionId: EXTENSION_ID })).toBe(false);
  });

  it("rejects when chrome.runtime has no sendMessage", async () => {
    Reflect.set(globalThis, "chrome", { runtime: {} });

    await expect(
      chromeSend({ extensionId: EXTENSION_ID, message: { type: "ping" } }),
    ).rejects.toThrow();
  });

  it("sends the message to the extension through chrome.runtime.sendMessage", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ type: "pong", version: BRIDGE_VERSION });
    Reflect.set(globalThis, "chrome", { runtime: { sendMessage } });

    expect(await chromeSend({ extensionId: EXTENSION_ID, message: { type: "ping" } })).toEqual({
      type: "pong",
      version: BRIDGE_VERSION,
    });
    expect(sendMessage).toHaveBeenCalledWith(EXTENSION_ID, { type: "ping" });
  });
});

describe("pingExtension", () => {
  it("answers true when the extension pongs", async () => {
    const send = vi.fn<ExtensionSend>().mockResolvedValue({
      type: "pong",
      version: BRIDGE_VERSION,
    });

    expect(await pingExtension({ extensionId: EXTENSION_ID, send })).toBe(true);
    expect(send).toHaveBeenCalledWith({ extensionId: EXTENSION_ID, message: { type: "ping" } });
  });

  it("answers false for any answer other than a pong", async () => {
    const answers: unknown[] = [
      undefined,
      { nonsense: true },
      { type: "pong", version: "1" },
      { type: "error", reason: "forbidden_origin" },
    ];

    const results = await Promise.all(
      answers.map((answer) =>
        pingExtension({ extensionId: EXTENSION_ID, send: () => Promise.resolve(answer) }),
      ),
    );

    expect(results).toEqual(answers.map(() => false));
  });

  it("clears its timer once the extension answers", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const send = vi.fn<ExtensionSend>().mockResolvedValue({
      type: "pong",
      version: BRIDGE_VERSION,
    });

    await pingExtension({ extensionId: EXTENSION_ID, send });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("gives up on a ping after the timeout", async () => {
    expect(
      await pingExtension({ extensionId: EXTENSION_ID, send: neverAnswers, timeoutMs: 5 }),
    ).toBe(false);
  });
});

describe("fetchLeagueViaExtension", () => {
  it("returns the payload, a failure reason, or missing", async () => {
    const answer = (value: unknown): ExtensionSend =>
      vi.fn<ExtensionSend>().mockResolvedValue(value);

    const ok = fetchLeagueViaExtension({
      extensionId: EXTENSION_ID,
      leagueId: "106344",
      send: answer({ type: "league", payload: PAYLOAD }),
    });
    const failed = fetchLeagueViaExtension({
      extensionId: EXTENSION_ID,
      leagueId: "106344",
      send: answer({ type: "error", reason: "logged_out" }),
    });
    const missing = fetchLeagueViaExtension({
      extensionId: EXTENSION_ID,
      leagueId: "106344",
      send: answer({ nonsense: true }),
    });

    expect(await ok).toEqual({ status: "ok", payload: PAYLOAD });
    expect(await failed).toEqual({ status: "failed", reason: "logged_out" });
    expect(await missing).toEqual({ status: "missing" });
  });

  it("asks the extension for the league by id", async () => {
    const send = vi.fn<ExtensionSend>().mockResolvedValue({ type: "league", payload: PAYLOAD });

    await fetchLeagueViaExtension({ extensionId: EXTENSION_ID, leagueId: "106344", send });

    expect(send).toHaveBeenCalledWith({
      extensionId: EXTENSION_ID,
      message: { type: "fetchLeague", leagueId: "106344" },
    });
  });

  it("treats a rejected send as missing", async () => {
    const send = vi
      .fn<ExtensionSend>()
      .mockRejectedValue(new Error("Could not establish connection"));

    expect(
      await fetchLeagueViaExtension({ extensionId: EXTENSION_ID, leagueId: "106344", send }),
    ).toEqual({ status: "missing" });
  });

  it("treats a pong as missing, since it carries no league", async () => {
    const send = vi
      .fn<ExtensionSend>()
      .mockResolvedValue({ type: "pong", version: BRIDGE_VERSION });

    expect(
      await fetchLeagueViaExtension({ extensionId: EXTENSION_ID, leagueId: "106344", send }),
    ).toEqual({ status: "missing" });
  });

  it("gives up on a league after the timeout", async () => {
    expect(
      await fetchLeagueViaExtension({
        extensionId: EXTENSION_ID,
        leagueId: "106344",
        send: neverAnswers,
        timeoutMs: 5,
      }),
    ).toEqual({ status: "missing" });
  });
});
