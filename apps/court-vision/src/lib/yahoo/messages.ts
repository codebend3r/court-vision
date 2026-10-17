import { MAX_LEAGUES } from "@vision/core/league/constants";

import { type YahooFailure } from "@/lib/yahoo/types";

// The one home for the Yahoo importer's user-facing copy: the import page
// shows it, and a failed sync records it on the league for the league page.
export type YahooMessageStatus =
  | YahooFailure["status"]
  | "duplicate"
  | "limit"
  | "invalid_team"
  | "throttled";

const GENERIC_MESSAGE = "Something went wrong. Try again.";

const YAHOO_FAILURE_MESSAGES: Readonly<Record<YahooMessageStatus, string>> = {
  invalid_url:
    "That doesn't look like a Yahoo league link. Paste the URL from your league's page, or just the league ID.",
  wrong_sport:
    "That's a Yahoo league for another sport. Only Yahoo Fantasy Basketball leagues can be imported.",
  past_season: "Only this season's leagues can be imported.",
  not_found:
    "Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings, or you can import it with the Court Vision extension.",
  highscore: "Yahoo Fantasy High Score leagues aren't supported yet.",
  unsupported_scoring: "This league's scoring type isn't supported yet.",
  unavailable: "Yahoo isn't answering right now; try again in a minute.",
  invalid_payload: "Yahoo sent something we couldn't read. Try again in a minute.",
  duplicate: "You've already imported this league.",
  limit: `You've reached the ${MAX_LEAGUES}-league limit. Delete a league to import another.`,
  invalid_team: "Pick your team from the list.",
  throttled: "Synced less than a minute ago.",
  unauthenticated: "Your session expired. Sign in again to continue.",
  error: GENERIC_MESSAGE,
};

export const yahooFailureMessage = ({ status }: { status: YahooMessageStatus }): string =>
  YAHOO_FAILURE_MESSAGES[status];

// Describes the import page's URL field.
export const YAHOO_URL_HINT =
  "Paste the link from your league's page on basketball.fantasysports.yahoo.com, or just the league ID.";

// Names the categories a league scores that the valuation engine can't value.
export const notValuedMessage = ({ categories }: { categories: string[] }): string =>
  `Not valued: ${categories.join(", ")}`;

// Recorded on a league whose sync Yahoo answered with another season's league.
export const KEY_CHANGED_MESSAGE = "This league's Yahoo key changed; import it again.";

// Recorded on a league whose sync loaded but then failed to write.
export const GENERIC_SYNC_ERROR_MESSAGE = GENERIC_MESSAGE;

// Announced after a sync that left some of Yahoo's players unmatched.
export const unmatchedSyncMessage = ({ names }: { names: string[] }): string => {
  const count = names.length === 1 ? "1 player" : `${names.length} players`;
  return `${count} couldn't be matched: ${names.join(", ")}. They won't count as rostered, so they may show up as free agents.`;
};

// Announced after an import that left some of Yahoo's players unmatched.
export const unmatchedPlayersMessage = ({ names }: { names: string[] }): string =>
  `Imported. ${unmatchedSyncMessage({ names })}`;
