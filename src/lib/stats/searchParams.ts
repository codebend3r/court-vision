import { createLoader, parseAsStringLiteral } from "nuqs/server";

export type StatMode = "avg" | "game" | "totals" | "per36";
export type StatSpan = "5" | "10" | "20" | "40" | "60" | "season";

export const STAT_MODES: readonly StatMode[] = ["avg", "game", "totals", "per36"];
export const STAT_SPANS: readonly StatSpan[] = ["5", "10", "20", "40", "60", "season"];

export const DEFAULT_MODE: StatMode = "avg";
export const DEFAULT_SPAN: StatSpan = "season";

// Single source of truth for the ?mode=&span= contract — the RSC page loads
// through `loadStatFilters` and the client filters bind `useQueryStates` to
// these same parsers, so server and client cannot drift.
export const statFilterParsers = {
  mode: parseAsStringLiteral(STAT_MODES).withDefault(DEFAULT_MODE),
  span: parseAsStringLiteral(STAT_SPANS).withDefault(DEFAULT_SPAN),
};

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
