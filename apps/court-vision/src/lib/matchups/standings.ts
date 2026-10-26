import { type WeekCategory, type WeekTeam } from "@/lib/matchups/types";

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/** A host's stat string as a number: ".481" is 0.481; "-", "" and "42/87" are null. */
type ParseStatValueProps = { raw: string };

export const parseStatValue = ({ raw }: ParseStatValueProps): number | null => {
  const text = raw.trim();
  return NUMBER.test(text) ? Number(text) : null;
};

export type CategoryResult = "win" | "loss" | "tie";

/** How `mine` fares against `theirs` in one category. A missing number loses to a real one. */
type CompareTotalsProps = {
  mine: number | null;
  theirs: number | null;
  higherIsBetter: boolean;
};

export const compareTotals = ({
  mine,
  theirs,
  higherIsBetter,
}: CompareTotalsProps): CategoryResult => {
  if (mine === theirs) return "tie";
  if (mine === null) return "loss";
  if (theirs === null) return "win";
  return mine > theirs === higherIsBetter ? "win" : "loss";
};

export type MatchupRow = {
  category: WeekCategory;
  mine: string;
  theirs: string;
  result: CategoryResult;
};

export type MatchupScore = {
  rows: MatchupRow[];
  wins: number;
  losses: number;
  ties: number;
};

const NO_TOTAL = "-";

/** Category by category, my team against one opponent, with the tally. */
type ScoreMatchupProps = {
  categories: readonly WeekCategory[];
  mine: WeekTeam;
  theirs: WeekTeam;
};

export const scoreMatchup = ({ categories, mine, theirs }: ScoreMatchupProps): MatchupScore => {
  const rows = categories.map((category): MatchupRow => {
    const key = String(category.statId);
    return {
      category,
      mine: mine.display[key] ?? NO_TOTAL,
      theirs: theirs.display[key] ?? NO_TOTAL,
      result: compareTotals({
        mine: mine.values[key] ?? null,
        theirs: theirs.values[key] ?? null,
        higherIsBetter: category.higherIsBetter,
      }),
    };
  });
  const count = (result: CategoryResult): number =>
    rows.filter((row) => row.result === result).length;
  return { rows, wins: count("win"), losses: count("loss"), ties: count("tie") };
};

/**
 * Each team's place in one category, 1 being best. Teams on the same total share
 * a place, and the next place skips ("1, 2, 2, 4"), as a league table does.
 */
type RankCategoryProps = {
  category: WeekCategory;
  teams: readonly WeekTeam[];
};

export const rankCategory = ({
  category,
  teams,
}: RankCategoryProps): ReadonlyMap<string, number> => {
  const key = String(category.statId);
  const totals = teams.map((team) => ({ teamId: team.teamId, value: team.values[key] ?? null }));
  return new Map(
    totals.map(({ teamId, value }) => {
      const ahead = totals.filter(
        (other) =>
          other.teamId !== teamId &&
          compareTotals({
            mine: other.value,
            theirs: value,
            higherIsBetter: category.higherIsBetter,
          }) === "win",
      ).length;
      return [teamId, ahead + 1];
    }),
  );
};

export type CategoryStanding = {
  category: WeekCategory;
  rank: number;
  of: number;
  isBest: boolean;
  isWorst: boolean;
};

type BuildStandingsProps = {
  categories: readonly WeekCategory[];
  teams: readonly WeekTeam[];
};

/** Rank each category once; summaries, averages and tables share these results. */
export const buildStandings = ({
  categories,
  teams,
}: BuildStandingsProps): ReadonlyMap<string, CategoryStanding[]> => {
  const categoriesWithRanks = categories.map((category) => {
    const ranks = rankCategory({ category, teams });
    const places = [...ranks.values()];
    return { category, ranks, best: Math.min(...places), worst: Math.max(...places) };
  });
  return new Map(
    teams.map(({ teamId }) => [
      teamId,
      categoriesWithRanks.flatMap(({ category, ranks, best, worst }) => {
        const rank = ranks.get(teamId);
        return rank === undefined
          ? []
          : [
              {
                category,
                rank,
                of: teams.length,
                // Everyone level is neither best nor worst.
                isBest: best !== worst && rank === best,
                isWorst: best !== worst && rank === worst,
              },
            ];
      }),
    ]),
  );
};

type AverageRankProps = { standings: readonly CategoryStanding[] };

/** A team's average place across the categories: lower is stronger. Null with no categories. */
export const averageRank = ({ standings }: AverageRankProps): number | null =>
  standings.length ? standings.reduce((sum, { rank }) => sum + rank, 0) / standings.length : null;
