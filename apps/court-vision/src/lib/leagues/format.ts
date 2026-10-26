import { type LeagueSummary } from "@/lib/leagues/types";

// Terse league descriptor for the header pill: "12-team · 9-cat". Category
// counts come from the league's own scoring config, not a fixed default.
type FormatLeagueMetaProps = {
  league: Pick<LeagueSummary, "teamCount" | "scoringType" | "scoringConfig">;
};

export const formatLeagueMeta = ({ league }: FormatLeagueMetaProps): string => {
  const scoring =
    "categories" in league.scoringConfig
      ? `${league.scoringConfig.categories.length}-cat${league.scoringType === "roto" ? " roto" : ""}`
      : "points";
  return `${league.teamCount}-team · ${scoring}`;
};
