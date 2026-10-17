import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { restoreEnv, stubEnv } from "@vision/testing/env";

import {
  bridgeFailureMessage,
  GENERIC_SYNC_ERROR_MESSAGE,
  KEY_CHANGED_MESSAGE,
  notValuedMessage,
  unmatchedPlayersMessage,
  unmatchedSyncMessage,
  YAHOO_URL_HINT,
  yahooFailureMessage,
  type YahooMessageStatus,
} from "@/lib/yahoo/messages";

const COPY: ReadonlyArray<readonly [YahooMessageStatus, string]> = [
  [
    "invalid_url",
    "That doesn't look like a Yahoo league link. Paste the URL from your league's page, or just the league ID.",
  ],
  [
    "wrong_sport",
    "That's a Yahoo league for another sport. Only Yahoo Fantasy Basketball leagues can be imported.",
  ],
  ["past_season", "Only this season's leagues can be imported."],
  [
    "not_found",
    "Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings.",
  ],
  ["highscore", "Yahoo Fantasy High Score leagues aren't supported yet."],
  ["unsupported_scoring", "This league's scoring type isn't supported yet."],
  ["unavailable", "Yahoo isn't answering right now; try again in a minute."],
  ["invalid_payload", "Yahoo sent something we couldn't read. Try again in a minute."],
  ["duplicate", "You've already imported this league."],
  ["limit", "You've reached the 10-league limit. Delete a league to import another."],
  ["invalid_team", "Pick your team from the list."],
  ["throttled", "Synced less than a minute ago."],
  ["needs_extension", "Syncing this league needs the Court Vision extension in this browser."],
  ["unauthenticated", "Your session expired. Sign in again to continue."],
  ["error", "Something went wrong. Try again."],
];

const NOT_FOUND_WITH_EXTENSION =
  "Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings, or you can import it with the Court Vision extension.";

// Bun loads the app's `.env`, so pin the extension off unless a test turns it on.
beforeEach(() => {
  stubEnv({ key: "NEXT_PUBLIC_COURT_VISION_EXTENSION_ID", value: "" });
});

afterEach(() => {
  restoreEnv();
});

describe("yahooFailureMessage", () => {
  it("gives every status a non-empty message", () => {
    COPY.forEach(([status]) => {
      expect(yahooFailureMessage({ status }).length).toBeGreaterThan(0);
    });
  });

  it("explains how to read a private league", () => {
    expect(yahooFailureMessage({ status: "not_found" })).toBe(
      "Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings.",
    );
    expect(yahooFailureMessage({ status: "not_found" })).not.toContain("extension");
  });

  it("offers the extension for a private league only when the extension is available", () => {
    expect(yahooFailureMessage({ status: "not_found", extensionAvailable: true })).toBe(
      NOT_FOUND_WITH_EXTENSION,
    );
    expect(yahooFailureMessage({ status: "not_found", extensionAvailable: false })).not.toContain(
      "extension",
    );
  });

  it("offers the extension for a private league when an extension id is configured", () => {
    stubEnv({
      key: "NEXT_PUBLIC_COURT_VISION_EXTENSION_ID",
      value: "kkonhioibmfcogphfmoplgmfdpkngjif",
    });

    expect(yahooFailureMessage({ status: "not_found" })).toBe(NOT_FOUND_WITH_EXTENSION);
  });

  it("keeps the extension out of the copy when no extension id is configured", () => {
    expect(yahooFailureMessage({ status: "not_found" })).not.toContain("extension");
  });

  it("leaves every other status unchanged when the extension is available", () => {
    COPY.filter(([status]) => status !== "not_found").forEach(([status, message]) => {
      expect(yahooFailureMessage({ status, extensionAvailable: true })).toBe(message);
    });
  });

  it("uses the spec's copy for each status", () => {
    COPY.forEach(([status, message]) => {
      expect(yahooFailureMessage({ status })).toBe(message);
    });
  });
});

describe("bridgeFailureMessage", () => {
  it("explains each way the extension can fail", () => {
    expect(bridgeFailureMessage({ reason: "logged_out" })).toBe(
      "Couldn't read this league with your Yahoo login. Make sure you're signed in to Yahoo in this browser. If you block third-party cookies, allow them for yahoo.com and try again.",
    );
    expect(bridgeFailureMessage({ reason: "not_found" })).toBe(
      "Couldn't read this league with your Yahoo login. Check that you're signed in to the Yahoo account that's in this league.",
    );
    expect(bridgeFailureMessage({ reason: "unavailable" })).toBe(
      "Yahoo isn't answering right now; try again in a minute.",
    );
    expect(bridgeFailureMessage({ reason: "forbidden_origin" })).toBe(
      "The Court Vision extension only works on court-vizion.netlify.app.",
    );
    expect(bridgeFailureMessage({ reason: "bad_request" })).toBe(
      "Something went wrong. Try again.",
    );
    expect(bridgeFailureMessage({ reason: "missing" })).toBe(
      "The Court Vision extension isn't responding. Check that it's installed and enabled, then try again.",
    );
  });
});

describe("sync messages", () => {
  it("tells the user to import again when the league key changed", () => {
    expect(KEY_CHANGED_MESSAGE).toBe("This league's Yahoo key changed; import it again.");
  });

  it("records the generic error copy when a sync fails after loading", () => {
    expect(GENERIC_SYNC_ERROR_MESSAGE).toBe("Something went wrong. Try again.");
  });
});

describe("unmatchedPlayersMessage", () => {
  it("names a single unmatched player", () => {
    expect(unmatchedPlayersMessage({ names: ["Jalen Smith"] })).toBe(
      "Imported. 1 player couldn't be matched: Jalen Smith. They won't count as rostered, so they may show up as free agents.",
    );
  });

  it("counts and lists several unmatched players", () => {
    expect(unmatchedPlayersMessage({ names: ["Jalen Smith", "Kai Jones"] })).toBe(
      "Imported. 2 players couldn't be matched: Jalen Smith, Kai Jones. They won't count as rostered, so they may show up as free agents.",
    );
  });
});

describe("unmatchedSyncMessage", () => {
  it("names a single player a sync could not match", () => {
    expect(unmatchedSyncMessage({ names: ["Jalen Smith"] })).toBe(
      "1 player couldn't be matched: Jalen Smith. They won't count as rostered, so they may show up as free agents.",
    );
  });

  it("counts and lists several players a sync could not match", () => {
    expect(unmatchedSyncMessage({ names: ["Jalen Smith", "Kai Jones"] })).toBe(
      "2 players couldn't be matched: Jalen Smith, Kai Jones. They won't count as rostered, so they may show up as free agents.",
    );
  });
});

describe("import form copy", () => {
  it("hints where to find the league URL", () => {
    expect(YAHOO_URL_HINT).toBe(
      "Paste the link from your league's page on basketball.fantasysports.yahoo.com, or just the league ID.",
    );
  });

  it("lists the categories Court Vision can't value", () => {
    expect(notValuedMessage({ categories: ["DD", "TD"] })).toBe("Not valued: DD, TD");
  });
});
