import { createLoader, parseAsStringLiteral } from "nuqs/server";

export const MATCHUP_VIEWS = ["matchup", "league"] as const;
export type MatchupView = (typeof MATCHUP_VIEWS)[number];

export const MATCHUP_VIEW_LABELS: Record<MatchupView, string> = {
  matchup: "My matchup",
  league: "League totals",
};

// The Matchup page's URL state: which of its two views shows.
export const matchupParsers = {
  view: parseAsStringLiteral(MATCHUP_VIEWS).withDefault("matchup"),
};

export const loadMatchupSearchParams = createLoader(matchupParsers);

type MatchupHrefProps = { view: MatchupView };

export const matchupHref = ({ view }: MatchupHrefProps): string =>
  view === "matchup" ? "/matchup" : `/matchup?view=${view}`;
