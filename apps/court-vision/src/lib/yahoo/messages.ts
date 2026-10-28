import { MAX_LEAGUES } from "@vision/core/league/constants";
import { type BridgeErrorReason } from "@vision/yahoo-bridge/protocol";

import { type LeagueSyncVia } from "@/lib/leagues/types";
import { getExtensionId } from "@/lib/yahoo/extensionClient";
import { type YahooFailure } from "@/lib/yahoo/types";

// The one home for the Yahoo importer's user-facing copy: the import page
// shows it, and a failed sync records it on the league for the league page.
export type YahooMessageStatus =
  | YahooFailure["status"]
  | "duplicate"
  | "limit"
  | "invalid_team"
  | "throttled"
  | "needs_extension";

const GENERIC_MESSAGE = "Something went wrong. Try again.";

const YAHOO_FAILURE_MESSAGES: Readonly<Record<YahooMessageStatus, string>> = {
  invalid_url:
    "That doesn't look like a Yahoo league link. Paste the URL from your league's page, or just the league ID.",
  wrong_sport:
    "That's a Yahoo league for another sport. Only Yahoo Fantasy Basketball leagues can be imported.",
  past_season: "Only this season's leagues can be imported.",
  not_found:
    "Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings.",
  highscore: "Yahoo Fantasy High Score leagues aren't supported yet.",
  unsupported_scoring: "This league's scoring type isn't supported yet.",
  unavailable: "Yahoo isn't answering right now; try again in a minute.",
  invalid_payload: "Yahoo sent something we couldn't read. Try again in a minute.",
  duplicate: "You've already imported this league.",
  limit: `You've reached the ${MAX_LEAGUES}-league limit. Delete a league to import another.`,
  invalid_team: "Pick your team from the list.",
  throttled: "Synced less than a minute ago.",
  needs_extension: "Syncing this league needs the Court Vision extension in this browser.",
  unauthenticated: "Your session expired. Sign in again to continue.",
  error: GENERIC_MESSAGE,
};

// A private league can still be read through the extension, so the not_found
// copy offers it, but only where the extension is configured and reachable.
const NOT_FOUND_WITH_EXTENSION_MESSAGE =
  "Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings, or you can import it with the Court Vision extension.";

type YahooFailureMessageProps = {
  status: YahooMessageStatus;
  extensionAvailable?: boolean;
};

export const yahooFailureMessage = ({
  status,
  extensionAvailable = getExtensionId() !== null,
}: YahooFailureMessageProps): string =>
  status === "not_found" && extensionAvailable
    ? NOT_FOUND_WITH_EXTENSION_MESSAGE
    : YAHOO_FAILURE_MESSAGES[status];

// Why an import through the extension failed: one of its error reasons, or
// "missing" when it never answered.
const BRIDGE_FAILURE_MESSAGES: Readonly<Record<BridgeErrorReason | "missing", string>> = {
  logged_out:
    "Couldn't read this league with your Yahoo login. Make sure you're signed in to Yahoo in this browser. If you block third-party cookies, allow them for yahoo.com and try again.",
  not_found:
    "Couldn't read this league with your Yahoo login. Check that you're signed in to the Yahoo account that's in this league.",
  unavailable: "Yahoo isn't answering right now; try again in a minute.",
  forbidden_origin: "The Court Vision extension only works on court-vizion.netlify.app.",
  bad_request: GENERIC_MESSAGE,
  missing:
    "The Court Vision extension isn't responding. Check that it's installed and enabled, then try again.",
};

type BridgeFailureMessageProps = {
  reason: BridgeErrorReason | "missing";
};

export const bridgeFailureMessage = ({ reason }: BridgeFailureMessageProps): string =>
  BRIDGE_FAILURE_MESSAGES[reason];

// Describes the import page's URL field.
export const YAHOO_URL_HINT =
  "Paste the link from your league's page on basketball.fantasysports.yahoo.com, or just the league ID.";

// Names the categories a league scores that the valuation engine can't value.
type NotValuedMessageProps = { categories: string[] };

export const notValuedMessage = ({ categories }: NotValuedMessageProps): string =>
  `Not valued: ${categories.join(", ")}`;

// Recorded on a league whose sync Yahoo answered with another season's league.
export const KEY_CHANGED_MESSAGE = "This league's Yahoo key changed; import it again.";

// Recorded on a league whose sync loaded but then failed to write.
export const GENERIC_SYNC_ERROR_MESSAGE = GENERIC_MESSAGE;

// Announced after a sync that left some of Yahoo's players unmatched.
type UnmatchedSyncMessageProps = { names: string[] };

export const unmatchedSyncMessage = ({ names }: UnmatchedSyncMessageProps): string => {
  const count = names.length === 1 ? "1 player" : `${names.length} players`;
  return `${count} couldn't be matched: ${names.join(", ")}. They won't count as rostered, so they may show up as free agents.`;
};

// Announced after a sync whose rosters landed but whose scoreboard didn't, so
// the matchup page still shows the week it last read. An extension league is
// usually running a build from before the scoreboard import, which only a
// reload of the extension replaces.
type MatchupsMissingMessageProps = { syncVia: LeagueSyncVia };

export const matchupsMissingMessage = ({ syncVia }: MatchupsMissingMessageProps): string =>
  syncVia === "extension"
    ? "Synced, but this week's matchups didn't come through. Reload the Court Vision extension in chrome://extensions, then sync again."
    : "Synced, but Yahoo's scoreboard didn't load, so this week's matchups weren't updated. Sync again in a minute.";

// Announced after an import that left some of Yahoo's players unmatched.
type UnmatchedPlayersMessageProps = { names: string[] };

export const unmatchedPlayersMessage = ({ names }: UnmatchedPlayersMessageProps): string =>
  `Imported. ${unmatchedSyncMessage({ names })}`;
