import { createLoader, parseAsInteger, parseAsStringLiteral } from "nuqs/server";

import { listParsers } from "@/lib/players/searchParams";

export const WAIVER_VIEWS = ["swap", "h2h", "cut"] as const;
export type WaiverView = (typeof WAIVER_VIEWS)[number];
export const WAIVER_POSITIONS = ["all", "G", "F", "C"] as const;
export const CUT_SCOPES = ["all", "fa"] as const;

// The Waiver Wire's URL state. A new range is a new server pool, so it
// refetches; the rest only change what the client shows.
export const waiverWireParsers = {
  view: parseAsStringLiteral(WAIVER_VIEWS).withDefault("swap"),
  range: listParsers.range.withOptions({ shallow: false }),
  pos: parseAsStringLiteral(WAIVER_POSITIONS).withDefault("all"),
  scope: parseAsStringLiteral(CUT_SCOPES).withDefault("all"),
  fa: parseAsInteger,
  mine: parseAsInteger,
};

export const loadWaiverWireSearchParams = createLoader(waiverWireParsers);
