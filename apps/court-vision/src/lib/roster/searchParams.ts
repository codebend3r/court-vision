import { createLoader, parseAsStringLiteral } from "nuqs/server";

import {
  DEFAULT_GAME_RANGE,
  DEFAULT_STAT_MODE,
  listParsers,
  type PlayerGameRange,
  type PlayerStatMode,
  type RawSearchParams,
} from "@/lib/players/searchParams";

export const ROSTER_TABS = ["regular", "advanced", "fantasy"] as const;
export type RosterTab = (typeof ROSTER_TABS)[number];
export const DEFAULT_ROSTER_TAB: RosterTab = "regular";

export const ROSTER_TAB_LABELS: Record<RosterTab, string> = {
  regular: "Regular Stats",
  advanced: "Advanced Stats",
  fantasy: "Fantasy Value",
};

export const ROSTER_PATH = "/roster";

// The roster page's server-read URL state. The Fantasy tab owns the rest of
// its keys client-side through nuqs, and reads `range` from the same place.
const loadRosterParams = createLoader({
  tab: parseAsStringLiteral(ROSTER_TABS).withDefault(DEFAULT_ROSTER_TAB),
  range: listParsers.range,
  mode: listParsers.mode,
});

export type RosterParams = { tab: RosterTab; range: PlayerGameRange; mode: PlayerStatMode };

export const parseRosterParams = ({ raw }: { raw: RawSearchParams }): RosterParams =>
  loadRosterParams(raw);

// Defaults stay out of the URL, in a fixed key order, so every view has one
// canonical href.
export const buildRosterHref = ({ tab, range, mode }: RosterParams): string => {
  const entries: Array<[string, string] | false> = [
    tab !== DEFAULT_ROSTER_TAB && ["tab", tab],
    range !== DEFAULT_GAME_RANGE && ["range", range],
    mode !== DEFAULT_STAT_MODE && ["mode", mode],
  ];
  const query = new URLSearchParams(
    entries.filter((entry): entry is [string, string] => entry !== false),
  ).toString();
  return query === "" ? ROSTER_PATH : `${ROSTER_PATH}?${query}`;
};
