import { createLoader, parseAsInteger, parseAsStringLiteral } from "nuqs/server";

export const MATCHUP_VIEWS = ["matchup", "league", "season"] as const;
export type MatchupView = (typeof MATCHUP_VIEWS)[number];

export const MATCHUP_VIEW_LABELS: Record<MatchupView, string> = {
  matchup: "My matchup",
  league: "League totals",
  season: "Season",
};

// The Matchup page's URL state: which view shows, and for the two week views
// which stored week. No week means the latest.
export const matchupParsers = {
  view: parseAsStringLiteral(MATCHUP_VIEWS).withDefault("matchup"),
  week: parseAsInteger,
};

export const loadMatchupSearchParams = createLoader(matchupParsers);

// The Season view covers every week, so its link never names one.
type MatchupHrefProps = { view: MatchupView; week?: number | null };

export const matchupHref = ({ view, week = null }: MatchupHrefProps): string => {
  const params = new URLSearchParams([
    ...(view === "matchup" ? [] : [["view", view]]),
    ...(week === null || view === "season" ? [] : [["week", String(week)]]),
  ]);
  const query = params.toString();
  return query ? `/matchup?${query}` : "/matchup";
};
