import { buildCategoryBreakdown, methodMeta } from "@vision/sport-basketball/engine";

import { buildAdvice } from "@/lib/advisor/advice";
import { cachedBreakdownFor } from "@/lib/advisor/breakdown";
import { getAdvisorLeagueData } from "@/lib/advisor/loader";
import { findTradeTargets } from "@/lib/advisor/target";
import { type AdvisorPlayer, type CategoryNeed, type FreeAgentPick } from "@/lib/advisor/types";
import { getActiveRosterPlayers } from "@/lib/fantasyTeams/loader";
import { rosterGate } from "@/lib/leagues/rosterGate";
import { type LeagueSummary } from "@/lib/leagues/types";
import { type LeagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { type SeasonValuation } from "@/lib/valuation/seasonValuation";
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
  // The page's one season valuation, shared with the trend charts; awaited
  // here alongside the league reads rather than before them.
  valuation: Promise<SeasonValuation>;
};

// The league's advisor inputs, or null when rosterGate blocks it (the same
// rule the Roster Advisor page applies).
type LoadAdviceInputsProps = { league: LeagueSummary | null };

const loadAdviceInputs = async ({ league }: LoadAdviceInputsProps) => {
  const gate = rosterGate({ league });
  if (gate.kind !== "ready") return null;
  const [leagueData, activeRoster] = await Promise.all([
    getAdvisorLeagueData({ leagueId: gate.league.id, myTeamId: gate.myTeamId }),
    getActiveRosterPlayers(),
  ]);
  return { leagueData, activePlayerIds: new Set(activeRoster.map((player) => player.playerId)) };
};

// The dashboard's valuation, done on the server on the league's settings and
// the user's method (see leagueValuationSettings), so a number here matches
// the Roster Advisor's and the Waiver Wire's.
export const getHomeInsights = async ({
  league,
  settings: { method, config, methodWeights },
  valuation,
}: GetHomeInsightsProps): Promise<HomeInsights> => {
  const { valueKey, scoreKey } = scoreKeysFor({ method });
  const [{ lines, values, poolStats }, inputs] = await Promise.all([
    valuation,
    loadAdviceInputs({ league }),
  ]);
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
  if (advice === null) return { valueById, methodLabel, advice: null };

  return {
    valueById,
    methodLabel,
    advice: {
      weakness: advice.weakness,
      focusLabel: advice.focusLabel,
      tradeTargets: findTradeTargets(advice).slice(0, HOME_PICK_LIMIT),
      freeAgents: advice.freeAgents.slice(0, HOME_PICK_LIMIT),
    },
  };
};
