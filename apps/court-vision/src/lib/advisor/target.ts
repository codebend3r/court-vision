import { type AdvisorPlayer } from "@/lib/advisor/types";

type MedianProps = { values: readonly number[] };

export const median = ({ values }: MedianProps): number | null => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return null;
  return sorted.length % 2
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

const byCategoryThenValue = (a: AdvisorPlayer, b: AdvisorPlayer): number =>
  b.categoryScore - a.categoryScore || b.value - a.value || a.playerId - b.playerId;

// Best fits shown at once.
export const TARGET_LIMIT = 5;

/**
 * The players who fix the focus most, best first, up to five: the best focus
 * scores among players on other teams and free agents worth at least my
 * roster's median, so a fix is a real player rather than a one-category
 * specialist. When fewer than five clear that bar, the next best by focus
 * score fill in.
 */
type FindTargetsProps = {
  candidates: readonly AdvisorPlayer[];
  myRoster: readonly AdvisorPlayer[];
};

export const findTargets = ({ candidates, myRoster }: FindTargetsProps): AdvisorPlayer[] => {
  const bar = median({ values: myRoster.map((player) => player.value) });
  const ranked = candidates.toSorted(byCategoryThenValue);
  const clears = (player: AdvisorPlayer): boolean => bar === null || player.value >= bar;
  return [...ranked.filter(clears), ...ranked.filter((player) => !clears(player))].slice(
    0,
    TARGET_LIMIT,
  );
};
