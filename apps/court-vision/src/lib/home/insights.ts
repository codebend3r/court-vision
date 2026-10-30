import { buildCategoryBreakdown, methodMeta, valuePlayers } from "@vision/sport-basketball/engine";

import { buildAdvice } from "@/lib/advisor/advice";
import { cachedBreakdownFor } from "@/lib/advisor/breakdown";
import { getAdvisorLeagueData } from "@/lib/advisor/loader";
import { type AdvisorPlayer, type CategoryNeed, type FreeAgentPick } from "@/lib/advisor/types";
import { getActiveRosterPlayers } from "@/lib/fantasyTeams/loader";
import { type LeagueSummary } from "@/lib/leagues/types";
import { type LeagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { getFantasyPool } from "@/lib/valuation/loader";
import { scoreKeysFor } from "@/lib/waiverWire/model";

// How many trade targets and free agents each dashboard panel lists.
export const HOME_PICK_LIMIT = 5;

// The Roster Advisor's answer, cut down to what the dashboard shows: the
// weak categories it is fixing, the best fits on other teams, and the best
// free agents for them.
export type HomeAdvice = {
  // The single weakest category and where the roster ranks in it.
  weakness: CategoryNeed;
  focusLabel: string;
  tradeTargets: AdvisorPlayer[];
  freeAgents: FreeAgentPick[];
};

export type HomeInsights = {
  // Every valued player's season value on the user's method, by player id.
  valueById: ReadonlyMap<number, number>;
  // The method's short label ("Z-Score"), for the value column.
  methodLabel: string;
  // Null when the league can't be advised: not imported, points scoring, no
  // team of mine, or nothing valued yet.
  advice: HomeAdvice | null;
};

type GetHomeInsightsProps = {
  league: LeagueSummary | null;
  settings: LeagueValuationSettings;
};

// The league's advisor inputs, or null when it can't be advised: not
// imported, points scoring, or no team of mine (exactly when the Roster
// Advisor page would refuse).
type LoadAdviceInputsProps = { league: LeagueSummary | null };

const loadAdviceInputs = async ({ league }: LoadAdviceInputsProps) => {
  if (
    league === null ||
    !league.isImported ||
    league.scoringType === "h2h_points" ||
    league.myTeamId === null
  ) {
    return null;
  }
  const [leagueData, activeRoster] = await Promise.all([
    getAdvisorLeagueData({ leagueId: league.id, myTeamId: league.myTeamId }),
    getActiveRosterPlayers(),
  ]);
  return { leagueData, activePlayerIds: new Set(activeRoster.map((player) => player.playerId)) };
};

// The dashboard's valuation, done on the server: the season's pool valued
// once on the league's settings and the user's method (see
// leagueValuationSettings), so a number here matches the Roster Advisor's and
// the Waiver Wire's.
export const getHomeInsights = async ({
  league,
  settings: { method, config, methodWeights },
}: GetHomeInsightsProps): Promise<HomeInsights> => {
  const { valueKey, scoreKey } = scoreKeysFor({ method });
  const [lines, inputs] = await Promise.all([
    getFantasyPool({ range: "all" }),
    loadAdviceInputs({ league }),
  ]);
  const { values, poolStats } = valuePlayers({ lines, config, methodWeights, windowGames: null });
  const valueById = new Map(values.map((entry) => [entry.playerId, entry[valueKey]]));
  const methodLabel = methodMeta({ key: method })?.label ?? "Value";
  if (inputs === null) return { valueById, methodLabel, advice: null };

  const advice = buildAdvice({
    lines,
    values,
    valueKey,
    league: inputs.leagueData,
    activePlayerIds: inputs.activePlayerIds,
    breakdownFor: cachedBreakdownFor({
      lines,
      lineBreakdown: ({ line }) =>
        buildCategoryBreakdown({ line, poolStats, config, methodWeights }),
    }),
    scoreKey,
    focus: null,
    targetId: null,
  });

  return {
    valueById,
    methodLabel,
    advice:
      advice === null
        ? null
        : {
            weakness: advice.weakness,
            focusLabel: advice.focusLabel,
            tradeTargets: advice.tradeTargets.slice(0, HOME_PICK_LIMIT),
            freeAgents: advice.freeAgents.slice(0, HOME_PICK_LIMIT),
          },
  };
};
