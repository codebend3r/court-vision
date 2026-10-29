import { type Category, type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

import { NON_ROSTER_SLOTS } from "@/lib/leagues/slots";
import { type AdvisorTeam, type CategoryNeed } from "@/lib/advisor/types";
import { type ScoreKey } from "@/lib/waiverWire/swapBoard";

type BreakdownForProps = { playerId: number };
export type BreakdownFor = ({ playerId }: BreakdownForProps) => FantasyCategoryBreakdown[];

/** A team's healthy players, each once: IL and IL+ are not part of the active roster. */
type HealthyPlayersProps = { team: AdvisorTeam };

export const healthyPlayers = ({ team }: HealthyPlayersProps): AdvisorTeam["players"] =>
  team.players.filter(
    (player, index) =>
      !NON_ROSTER_SLOTS.includes(player.slotType) &&
      team.players.findIndex((other) => other.playerId === player.playerId) === index,
  );

type HealthyIdsProps = { team: AdvisorTeam };

export const healthyIds = ({ team }: HealthyIdsProps): number[] =>
  healthyPlayers({ team }).map((player) => player.playerId);

type TeamTotals = { teamId: string; totals: ReadonlyMap<Category, number> };

type TotalsOfProps = { team: AdvisorTeam; breakdownFor: BreakdownFor; scoreKey: ScoreKey };

const totalsOf = ({ team, breakdownFor, scoreKey }: TotalsOfProps): TeamTotals => ({
  teamId: team.teamId,
  totals: healthyIds({ team })
    .flatMap((playerId) => breakdownFor({ playerId }))
    .reduce(
      (totals, entry) =>
        new Map([...totals, [entry.key, (totals.get(entry.key) ?? 0) + entry[scoreKey]]]),
      new Map<Category, number>(),
    ),
});

/**
 * Every scored category, weakest first: each team's healthy roster summed on
 * the method's sign-corrected score, so a higher total is always better (even
 * for turnovers), and my team ranked against the league, 1 best. Ties on rank
 * go to the category furthest below the league average. Empty when I have no
 * team or nobody has a valued player.
 */
type BuildNeedsProps = {
  teams: readonly AdvisorTeam[];
  breakdownFor: BreakdownFor;
  scoreKey: ScoreKey;
};

export const buildNeeds = ({ teams, breakdownFor, scoreKey }: BuildNeedsProps): CategoryNeed[] => {
  const mine = teams.find((team) => team.isMine);
  if (mine === undefined) return [];
  // The categories in table order, read off the first valued player.
  const categories = teams
    .flatMap((team) => healthyIds({ team }))
    .map((playerId) => breakdownFor({ playerId }))
    .find((breakdown) => breakdown.length);
  if (categories === undefined) return [];

  const league = teams.map((team) => totalsOf({ team, breakdownFor, scoreKey }));
  const myTotals = league.find((entry) => entry.teamId === mine.teamId);

  return categories
    .map(({ key, label }): CategoryNeed => {
      const myTotal = myTotals?.totals.get(key) ?? 0;
      const all = league.map((entry) => entry.totals.get(key) ?? 0);
      return {
        key,
        label,
        myTotal,
        leagueAverage: all.reduce((sum, value) => sum + value, 0) / all.length,
        rank: all.filter((value) => value > myTotal).length + 1,
        of: all.length,
      };
    })
    .toSorted(
      (a, b) => b.rank - a.rank || a.myTotal - a.leagueAverage - (b.myTotal - b.leagueAverage),
    );
};

// At most this many categories count as needs at once.
export const MAX_WEAK_NEEDS = 3;

/**
 * The categories worth fixing: every one where my roster sits in the bottom
 * half of the league, weakest first, at most three. Never empty while there
 * is any category: the weakest always counts.
 */
type PickWeakNeedsProps = { needs: readonly CategoryNeed[] };

export const pickWeakNeeds = ({ needs }: PickWeakNeedsProps): CategoryNeed[] => {
  const bottomHalf = needs.filter(({ rank, of }) => rank > of / 2).slice(0, MAX_WEAK_NEEDS);
  return bottomHalf.length ? bottomHalf : needs.slice(0, 1);
};
