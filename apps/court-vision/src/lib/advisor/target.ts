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

/**
 * The player who fixes the weak category most: the best score in it among
 * players on other teams and free agents worth at least my roster's median, so
 * the fix is a real player rather than a one-category specialist. When nobody
 * clears that bar, simply the best in the category. Null with no candidates.
 */
type FindTargetProps = {
  candidates: readonly AdvisorPlayer[];
  myRoster: readonly AdvisorPlayer[];
};

export const findTarget = ({ candidates, myRoster }: FindTargetProps): AdvisorPlayer | null => {
  const bar = median({ values: myRoster.map((player) => player.value) });
  const ranked = candidates.toSorted(byCategoryThenValue);
  return ranked.find((player) => bar === null || player.value >= bar) ?? ranked[0] ?? null;
};
