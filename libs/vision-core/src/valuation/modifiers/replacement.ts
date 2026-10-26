import { byTotalDescending } from "#core/valuation/rank";

// Replacement baseline (PRD §6.5): the value of the last rostered player,
// the one ranked at teams × rosterSlots. VORP is a shift by this level over
// any base method's totals.
type ReplacementLevelProps = {
  totals: readonly { playerId: number; total: number }[];
  rank: number;
};

export const replacementLevel = ({ totals, rank }: ReplacementLevelProps): number => {
  if (totals.length === 0) return 0;
  const sorted = [...totals].sort(byTotalDescending);
  const index = Math.min(Math.max(Math.floor(rank), 1), sorted.length) - 1;
  return sorted[index]?.total ?? 0;
};
