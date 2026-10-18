import { type Category, type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

import { type WaiverModel, type WaiverRow } from "@/lib/waiverWire/types";

// Which sign-corrected score the chips compare: z, or g for the G-Score method.
export type ScoreKey = "z" | "g";

// "+REB" when the free agent is better in a category, "−FG%" when worse.
export type CategoryChip = { key: Category; text: string; improves: boolean };

export type SwapRow = WaiverRow & { gain: number; chips: CategoryChip[] };

// `target` is my weakest player; `rows` are the free agents who beat them.
export type SwapBoard = { target: WaiverRow | null; rows: SwapRow[] };

const MAX_CHIPS = 3;
const MINUS = "−";

const buildChips = ({
  free,
  target,
  scoreKey,
}: {
  free: FantasyCategoryBreakdown[];
  target: FantasyCategoryBreakdown[];
  scoreKey: ScoreKey;
}): CategoryChip[] =>
  free
    .flatMap((entry) => {
      const mine = target.find((candidate) => candidate.key === entry.key);
      return mine ? [{ entry, difference: entry[scoreKey] - mine[scoreKey] }] : [];
    })
    .filter(({ difference }) => difference !== 0)
    .toSorted((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, MAX_CHIPS)
    .map(({ entry, difference }) => ({
      key: entry.key,
      text: `${difference > 0 ? "+" : MINUS}${entry.label}`,
      improves: difference > 0,
    }));

// The free agents who beat my weakest player, biggest gain first (ties by
// player id), each with up to three category chips for what the swap changes.
export const buildSwapBoard = ({
  model,
  breakdownFor,
  scoreKey,
}: {
  model: WaiverModel;
  breakdownFor: ({ playerId }: { playerId: number }) => FantasyCategoryBreakdown[];
  scoreKey: ScoreKey;
}): SwapBoard => {
  const target = model.weakest[0] ?? null;
  if (!target) return { target: null, rows: [] };
  const targetBreakdown = breakdownFor({ playerId: target.playerId });
  const rows = model.freePool
    .map((free) => ({ ...free, gain: free.value - target.value }))
    .filter((free) => free.gain > 0)
    .toSorted((a, b) => b.gain - a.gain || a.playerId - b.playerId)
    .map((free): SwapRow => ({
      ...free,
      chips: buildChips({
        free: breakdownFor({ playerId: free.playerId }),
        target: targetBreakdown,
        scoreKey,
      }),
    }));
  return { target, rows };
};
