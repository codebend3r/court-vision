import { createLoader, parseAsStringLiteral } from "nuqs/server";

import {
  BACKFILL_START_YEAR,
  SEASON_LABEL,
  SEASON_YEAR,
  seasonLabelFromYear,
} from "@/lib/balldontlie/constants";
import type { PlayerGameRange } from "@/lib/players/searchParams";

export type StatMode = "avg" | "game" | "totals" | "per36";
export type StatSpan = "5" | "10" | "20" | "40" | "60" | "season";

export const STAT_MODES: readonly StatMode[] = ["game", "avg", "totals", "per36"];
export const STAT_SPANS: readonly StatSpan[] = ["5", "10", "20", "40", "60", "season"];

export const DEFAULT_MODE: StatMode = "game";
export const DEFAULT_SPAN: StatSpan = "season";

// The three player-page views, mirroring the /players stat tabs (minus
// Starred, which is a list, not a lens on one player).
export type PlayerView = "regular" | "advanced" | "fantasy";
export const PLAYER_VIEWS: readonly PlayerView[] = ["regular", "advanced", "fantasy"];
export const DEFAULT_VIEW: PlayerView = "regular";

export const isPlayerView = (value: string | undefined): value is PlayerView =>
  PLAYER_VIEWS.some((view) => view === value);

export const CAREER = "career";

// Every season label the database can hold (newest first), bounded by the
// backfill window; these are the only seasons a ?season= value could name.
export const SEASON_OPTIONS: readonly string[] = Array.from(
  { length: Number(SEASON_YEAR) - BACKFILL_START_YEAR + 1 },
  (_, index) => seasonLabelFromYear(Number(SEASON_YEAR) - index),
);

const SEASON_SELECTIONS: readonly string[] = [...SEASON_OPTIONS, CAREER];

// Single source of truth for the ?mode=&span=&season= contract: the RSC page
// loads through `loadStatFilters` and the client filters bind `useQueryStates`
// to these same parsers, so server and client cannot drift. `season` has no
// static default; absent resolves per player via `resolveSeasonSelection`.
export const statFilterParsers = {
  mode: parseAsStringLiteral(STAT_MODES).withDefault(DEFAULT_MODE),
  span: parseAsStringLiteral(STAT_SPANS).withDefault(DEFAULT_SPAN),
  season: parseAsStringLiteral(SEASON_SELECTIONS),
  view: parseAsStringLiteral(PLAYER_VIEWS).withDefault(DEFAULT_VIEW),
};

// Requested season (already literal-validated) wins even if the player never
// played it; otherwise the player's most recent season with data; otherwise
// the current league season so an empty page still labels itself sensibly.
export const resolveSeasonSelection = ({
  requested,
  playerSeasons,
}: {
  requested: string | null;
  playerSeasons: readonly string[];
}): string => requested ?? playerSeasons[0] ?? SEASON_LABEL;

export const loadStatFilters = createLoader(statFilterParsers);

const GAMES_BY_SPAN: Record<StatSpan, number | null> = {
  "5": 5,
  "10": 10,
  "20": 20,
  "40": 40,
  "60": 60,
  season: null,
};

export const gamesForSpan = ({ span }: { span: StatSpan }): number | null => GAMES_BY_SPAN[span];

// Not every view can plot every mode: rate metrics have no "totals" or
// "per 36" reading, and fantasy value has no per-game mode at all. The URL keeps
// whatever the regular view chose; each view coerces it to a mode it offers, so
// switching tabs never lands on an unpressed filter. Server and client share
// this so the pressed key and the plotted series cannot disagree.
export const coerceStatMode = ({
  mode,
  modes,
}: {
  mode: StatMode;
  modes: readonly StatMode[];
}): StatMode => {
  if (modes.some((offered) => offered === mode)) return mode;
  if (modes.some((offered) => offered === "avg")) return "avg";
  return modes[0] ?? DEFAULT_MODE;
};

const RANGE_BY_SPAN: Record<StatSpan, PlayerGameRange> = {
  "5": "last5",
  "10": "last10",
  "20": "last20",
  "40": "last40",
  "60": "last60",
  season: "all",
};

// The player page's timeframe and the players list's game range describe the
// same window; the fantasy view valuates against the list's cached pool, which
// is keyed by range.
export const rangeForSpan = ({ span }: { span: StatSpan }): PlayerGameRange => RANGE_BY_SPAN[span];

// The window in words, matching the Fantasy tab's Games select.
export const spanLabel = ({ span }: { span: StatSpan }): string =>
  span === "season" ? "All games" : `Last ${span} games`;
