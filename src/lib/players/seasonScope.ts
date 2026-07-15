import { createLoader, parseAsString } from "nuqs/server";

// Sentinel `?season=` value for the all-seasons (career) view.
export const CAREER_SCOPE = "career";

// Single source of truth for the ?season= contract: the RSC page reads it
// through `loadSeasonScope` and the client dropdown binds `useQueryStates` to
// these same parsers, so server and client cannot drift. The default is blank
// so `resolveSeasonScope` can fall back to the player's most recent season.
export const seasonScopeParsers = {
  season: parseAsString.withDefault(""),
};

export const loadSeasonScope = createLoader(seasonScopeParsers);

export type SeasonScope = { kind: "season"; season: string } | { kind: "career" };

// Resolve the raw ?season= value against the seasons the player actually has:
// "career" is always allowed; a known season is used as-is; anything else
// (blank, stale, or unknown) falls back to the most recent available season, or
// career when the player has no season rows at all.
export const resolveSeasonScope = (args: {
  requested: string;
  availableSeasons: readonly string[]; // most-recent first
}): SeasonScope => {
  const { requested, availableSeasons } = args;
  if (requested === CAREER_SCOPE) {
    return { kind: "career" };
  }
  if (availableSeasons.includes(requested)) {
    return { kind: "season", season: requested };
  }
  const latest = availableSeasons[0];
  return latest ? { kind: "season", season: latest } : { kind: "career" };
};

// The value the <select> should show for a resolved scope.
export const seasonScopeValue = (scope: SeasonScope): string =>
  scope.kind === "career" ? CAREER_SCOPE : scope.season;
