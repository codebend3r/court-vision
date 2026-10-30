import { type FantasyMethodKey } from "@vision/core/valuation/types";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";
import { type MethodWeights, type ValuationConfig } from "@vision/sport-basketball/types";

import { buildLeagueSeed, configFromSeed } from "@/lib/leagues/fantasyDefaults";
import { type LeagueSummary } from "@/lib/leagues/types";

export type LeagueValuationSettings = {
  // The user's preferred formula, or Z-Score.
  method: FantasyMethodKey;
  config: ValuationConfig;
  methodWeights: MethodWeights;
};

// How a server page values players for this user and league: the Fantasy
// tab's first load for the league (its size, slots, categories and weights),
// on the user's preferred method. Every server surface that shows a fantasy
// value (the Roster Advisor, the Waiver Wire, the dashboard) reads it here, so
// a player's value matches the one the tab shows before anyone touches its
// controls.
type LeagueValuationSettingsProps = {
  league: LeagueSummary | null;
  preferredFormula: string | null;
};

export const leagueValuationSettings = ({
  league,
  preferredFormula,
}: LeagueValuationSettingsProps): LeagueValuationSettings => ({
  method: FANTASY_METHODS.find((entry) => entry.key === preferredFormula)?.key ?? "zscore",
  ...configFromSeed({
    seed: buildLeagueSeed({ league, preferredFormula: null, presentKeys: new Set() }),
  }),
});
