import { type Direction } from "@vision/core/sport/types";
import { type CategoryKind } from "@vision/core/valuation/categories";
import { categoryPerGame, teamCategoryTotals } from "@vision/sport-basketball/engine";
import { type Category, type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

import { type FantasyStatLine } from "@/lib/valuation/types";
import { type ScoreKey } from "@/lib/waiverWire/swapBoard";
import { type WaiverModel, type WaiverRow } from "@/lib/waiverWire/types";

// The free agent and the player of mine they are measured against.
export type HeadToHeadPair = { fa: WaiverRow; mine: WaiverRow };

export type HeadToHeadRow = {
  key: Category;
  label: string;
  kind: CategoryKind;
  faPerGame: number;
  minePerGame: number;
  winner: "fa" | "mine" | "tie";
  teamDelta: number; // your team's per-game total after the swap minus before
  teamDeltaImproves: boolean | null; // null when teamDelta is 0
};

export type HeadToHead = { rows: HeadToHeadRow[]; faWins: number; categoryCount: number };

// The pair the URL names, when both are still available. A free agent who has
// since been rostered falls back to the swap board's top pick, then the best
// free agent; a player of mine who is gone falls back to my weakest. Null when
// either side has nobody to show.
export const resolvePair = ({
  model,
  swapTop,
  fa,
  mine,
}: {
  model: WaiverModel;
  swapTop: WaiverRow | null;
  fa: number | null;
  mine: number | null;
}): HeadToHeadPair | null => {
  const freeAgent =
    model.freePool.find((candidate) => candidate.playerId === fa) ??
    swapTop ??
    model.freePool[0] ??
    null;
  const mineRow =
    model.roster.find((candidate) => candidate.playerId === mine) ?? model.weakest[0] ?? null;
  return freeAgent && mineRow ? { fa: freeAgent, mine: mineRow } : null;
};

const perGameFor = ({
  line,
  category,
}: {
  line: FantasyStatLine | undefined;
  category: Category;
}): number => (line ? categoryPerGame({ line, category }) : 0);

const winnerOf = ({ fa, mine }: { fa: number; mine: number }): HeadToHeadRow["winner"] => {
  if (fa === mine) return "tie";
  return fa > mine ? "fa" : "mine";
};

// Whether a change in my team's total helps: up for higher-is-better
// categories, down for lower-is-better ones, and neither when nothing moves.
const improves = ({
  delta,
  direction,
}: {
  delta: number;
  direction: Direction;
}): boolean | null => {
  if (delta === 0) return null;
  return direction === "higher" ? delta > 0 : delta < 0;
};

// One row per league category, in the breakdown's order: each player's
// per-game number, who wins it on the method's score, and what the swap does
// to my team's per-game total.
export const buildHeadToHead = ({
  pair,
  linesById,
  rosterIds,
  breakdownFor,
  scoreKey,
}: {
  pair: HeadToHeadPair;
  linesById: ReadonlyMap<number, FantasyStatLine>;
  rosterIds: readonly number[];
  breakdownFor: ({ playerId }: { playerId: number }) => FantasyCategoryBreakdown[];
  scoreKey: ScoreKey;
}): HeadToHead => {
  const faLine = linesById.get(pair.fa.playerId);
  const mineLine = linesById.get(pair.mine.playerId);
  // Each roster player once, never the free agent, in the order given.
  const rosterLines = [...new Set(rosterIds)]
    .filter((id) => id !== pair.fa.playerId)
    .flatMap((id) => {
      const found = linesById.get(id);
      return found ? [found] : [];
    });
  // The free agent takes my player's place in the list, so the totals sum in
  // the same order and a like-for-like swap reads exactly 0, not float noise.
  const faLines = faLine ? [faLine] : [];
  const swappedLines = rosterLines.some((entry) => entry.playerId === pair.mine.playerId)
    ? rosterLines.flatMap((entry) => (entry.playerId === pair.mine.playerId ? faLines : [entry]))
    : [...rosterLines, ...faLines];
  const before = teamCategoryTotals({ lines: rosterLines });
  const after = teamCategoryTotals({ lines: swappedLines });
  const mineBreakdown = breakdownFor({ playerId: pair.mine.playerId });

  const rows = breakdownFor({ playerId: pair.fa.playerId }).flatMap((faEntry): HeadToHeadRow[] => {
    const mineEntry = mineBreakdown.find((candidate) => candidate.key === faEntry.key);
    const beforeTotal = before.find((total) => total.key === faEntry.key);
    const afterTotal = after.find((total) => total.key === faEntry.key);
    if (!mineEntry || !beforeTotal || !afterTotal) return [];
    const teamDelta = afterTotal.value - beforeTotal.value;
    return [
      {
        key: faEntry.key,
        label: faEntry.label,
        kind: faEntry.kind,
        faPerGame: perGameFor({ line: faLine, category: faEntry.key }),
        minePerGame: perGameFor({ line: mineLine, category: faEntry.key }),
        winner: winnerOf({ fa: faEntry[scoreKey], mine: mineEntry[scoreKey] }),
        teamDelta,
        teamDeltaImproves: improves({ delta: teamDelta, direction: beforeTotal.direction }),
      },
    ];
  });

  return {
    rows,
    faWins: rows.filter((entry) => entry.winner === "fa").length,
    categoryCount: rows.length,
  };
};

// "Wendell Carter Jr. wins 5 of 9".
export const headToHeadSummary = ({
  pair,
  result,
}: {
  pair: HeadToHeadPair;
  result: HeadToHead;
}): string => `${pair.fa.fullName} wins ${result.faWins} of ${result.categoryCount}`;
