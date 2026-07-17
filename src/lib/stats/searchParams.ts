import { createLoader, parseAsStringLiteral } from "nuqs/server";

import {
  BACKFILL_START_YEAR,
  SEASON_LABEL,
  SEASON_YEAR,
  seasonLabelFromYear,
} from "@/lib/balldontlie/constants";

export type StatMode = "avg" | "game" | "totals" | "per36";
export type StatSpan = "5" | "10" | "20" | "40" | "60" | "season";

export const STAT_MODES: readonly StatMode[] = ["game", "avg", "totals", "per36"];
export const STAT_SPANS: readonly StatSpan[] = ["5", "10", "20", "40", "60", "season"];

export const DEFAULT_MODE: StatMode = "game";
export const DEFAULT_SPAN: StatSpan = "season";

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
