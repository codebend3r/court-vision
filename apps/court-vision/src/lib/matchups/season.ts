import { rankCategory, scoreMatchup } from "@/lib/matchups/standings";
import { type LeagueWeek, type WeekCategory, type WeekTeam } from "@/lib/matchups/types";

// How one week went for my team. Only a `postevent` week is final; the rest
// say why there is no result yet, or that there was no opponent.
export type WeekOutcome = "won" | "lost" | "tied" | "in_progress" | "upcoming" | "bye";

export const WEEK_OUTCOME_LABELS: Record<WeekOutcome, string> = {
  won: "Won",
  lost: "Lost",
  tied: "Tied",
  in_progress: "In progress",
  upcoming: "Upcoming",
  bye: "Bye",
};

export type SeasonWeekRow = {
  week: number;
  weekStart: string | null;
  weekEnd: string | null;
  opponent: WeekTeam | null;
  wins: number;
  losses: number;
  ties: number;
  outcome: WeekOutcome;
};

export type SeasonCategoryRow = {
  category: WeekCategory;
  wins: number;
  losses: number;
  ties: number;
  // My weekly total averaged over final weeks; null before any week is final
  // or when the host never showed a number.
  weeklyAverage: number | null;
  // My place in the league in this category, averaged over final weeks.
  averageRank: number | null;
};

export type SeasonRecord = { won: number; lost: number; tied: number };

export type SeasonSummary = {
  weeks: SeasonWeekRow[];
  categories: SeasonCategoryRow[];
  record: SeasonRecord;
  finalWeeks: number;
};

const FINAL_STATUS = "postevent";

/** My team and my opponent in one week. Either is undefined when absent. */
type FindMatchupProps = { week: LeagueWeek; myTeamId: string };

export const findMatchup = ({
  week,
  myTeamId,
}: FindMatchupProps): { mine: WeekTeam | undefined; opponent: WeekTeam | undefined } => {
  const pairing = week.pairings.find(
    ({ teamAId, teamBId }) => teamAId === myTeamId || teamBId === myTeamId,
  );
  const opponentId = pairing?.teamAId === myTeamId ? pairing.teamBId : pairing?.teamAId;
  return {
    mine: week.teams.find((team) => team.teamId === myTeamId),
    opponent: week.teams.find((team) => team.teamId === opponentId),
  };
};

type OutcomeOfProps = { status: string | null; wins: number; losses: number };

const outcomeOf = ({ status, wins, losses }: OutcomeOfProps): WeekOutcome => {
  if (status === "preevent") return "upcoming";
  if (status !== FINAL_STATUS) return "in_progress";
  if (wins === losses) return "tied";
  return wins > losses ? "won" : "lost";
};

type WeekRowProps = { week: LeagueWeek; myTeamId: string };

const toWeekRow = ({ week, myTeamId }: WeekRowProps): SeasonWeekRow => {
  const { mine, opponent } = findMatchup({ week, myTeamId });
  const base = {
    week: week.week,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    opponent: opponent ?? null,
  };
  if (mine === undefined || opponent === undefined) {
    return { ...base, wins: 0, losses: 0, ties: 0, outcome: "bye" };
  }
  const { wins, losses, ties } = scoreMatchup({
    categories: week.categories,
    mine,
    theirs: opponent,
  });
  return { ...base, wins, losses, ties, outcome: outcomeOf({ status: week.status, wins, losses }) };
};

const mean = (values: readonly number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

type CategoryRowProps = {
  category: WeekCategory;
  finals: readonly LeagueWeek[];
  myTeamId: string;
};

const toCategoryRow = ({ category, finals, myTeamId }: CategoryRowProps): SeasonCategoryRow => {
  const key = String(category.statId);
  const results = finals.flatMap((week) => {
    const { mine, opponent } = findMatchup({ week, myTeamId });
    if (mine === undefined || opponent === undefined) return [];
    const [row] = scoreMatchup({ categories: [category], mine, theirs: opponent }).rows;
    return row === undefined ? [] : [row.result];
  });
  const totals = finals.flatMap((week) => {
    const value = week.teams.find((team) => team.teamId === myTeamId)?.values[key] ?? null;
    return value === null ? [] : [value];
  });
  const ranks = finals.flatMap((week) => {
    const rank = rankCategory({ category, teams: week.teams }).get(myTeamId);
    return rank === undefined ? [] : [rank];
  });
  return {
    category,
    wins: results.filter((result) => result === "win").length,
    losses: results.filter((result) => result === "loss").length,
    ties: results.filter((result) => result === "tie").length,
    weeklyAverage: mean(totals),
    averageRank: mean(ranks),
  };
};

/**
 * My season so far: one row per stored week, the matchup record over final
 * weeks, and per category the record, weekly average and average league rank,
 * also over final weeks so a half-played week never drags the averages. The
 * categories are the latest week's, which is the league's current set.
 */
type BuildSeasonSummaryProps = { season: readonly LeagueWeek[]; myTeamId: string };

export const buildSeasonSummary = ({
  season,
  myTeamId,
}: BuildSeasonSummaryProps): SeasonSummary => {
  const weeks = season.map((week) => toWeekRow({ week, myTeamId }));
  const finals = season.filter((week) => week.status === FINAL_STATUS);
  const categories = season.at(-1)?.categories ?? [];
  const count = (outcome: WeekOutcome): number =>
    weeks.filter((row) => row.outcome === outcome).length;
  return {
    weeks,
    categories: categories.map((category) => toCategoryRow({ category, finals, myTeamId })),
    record: { won: count("won"), lost: count("lost"), tied: count("tied") },
    finalWeeks: finals.length,
  };
};

/** The week the URL asks for when it is stored, else the latest. Undefined with no weeks. */
type PickWeekProps = { season: readonly LeagueWeek[]; week: number | null };

export const pickWeek = ({ season, week }: PickWeekProps): LeagueWeek | undefined =>
  season.find((entry) => entry.week === week) ?? season.at(-1);
