import { describe, expect, it } from "bun:test";

import {
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
  ["unauthenticated", "Your session expired. Sign in again to continue."],
  ["error", "Something went wrong. Try again."],
];

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
    // The extension that imports a private league doesn't ship yet.
    expect(yahooFailureMessage({ status: "not_found" })).not.toContain("extension");
  });

  it("uses the spec's copy for each status", () => {
    COPY.forEach(([status, message]) => {
      expect(yahooFailureMessage({ status })).toBe(message);
    });
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
