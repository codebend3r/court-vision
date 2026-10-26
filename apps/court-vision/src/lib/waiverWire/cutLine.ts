import { type WaiverModel, type WaiverRow } from "@/lib/waiverWire/types";

export type CutScope = "all" | "fa";

export type CutLineEntry =
  | { kind: "row"; row: WaiverRow; isUpgrade: boolean } // a free agent above the line
  | { kind: "line" }; // drawn under your lowest-valued player

export type CutLine = { entries: CutLineEntry[]; hiddenAbove: number; hiddenBelow: number };

const ROWS_ABOVE_FIRST_UPGRADE = 3;
const ROWS_BELOW_LINE = 5;
const ROWS_WITHOUT_ROSTER = 8;

// Value descending, ties by player id ascending.
const byValue = (a: WaiverRow, b: WaiverRow): number =>
  b.value - a.value || a.playerId - b.playerId;

const isLine = (entry: CutLineEntry): boolean => entry.kind === "line";

const isUpgradeEntry = (entry: CutLineEntry): boolean => entry.kind === "row" && entry.isUpgrade;

// One ranked list of my roster and the free pool, with a line drawn under my
// lowest-valued player, windowed around the line unless `showAll`.
type BuildCutLineProps = {
  model: WaiverModel;
  scope: CutScope;
  showAll: boolean;
};

export const buildCutLine = ({ model, scope, showAll }: BuildCutLineProps): CutLine => {
  const merged = [...model.roster, ...model.freePool].toSorted(byValue);
  const worst = merged.findLast((candidate) => candidate.owner === "mine");

  if (!worst) {
    const entries: CutLineEntry[] = merged.map((candidate) => ({
      kind: "row",
      row: candidate,
      isUpgrade: false,
    }));
    const shown = showAll ? entries : entries.slice(0, ROWS_WITHOUT_ROSTER);
    return { entries: shown, hiddenAbove: 0, hiddenBelow: entries.length - shown.length };
  }

  const worstIndex = merged.indexOf(worst);
  const entries = merged.flatMap<CutLineEntry>((candidate, index) => {
    const isMine = candidate.owner === "mine";
    const row: CutLineEntry = {
      kind: "row",
      row: candidate,
      isUpgrade: !isMine && candidate.value > worst.value,
    };
    const items: CutLineEntry[] = scope === "fa" && isMine ? [] : [row];
    return index === worstIndex ? [...items, { kind: "line" }] : items;
  });

  if (showAll) return { entries, hiddenAbove: 0, hiddenBelow: 0 };

  const lineIndex = entries.findIndex(isLine);
  const firstUpgrade = entries.findIndex(isUpgradeEntry);
  // With no upgrade, anchor on the line itself so your bottom players still
  // show above it instead of the window opening at the line.
  const anchor = firstUpgrade < 0 ? lineIndex : firstUpgrade;
  const start = Math.max(0, anchor - ROWS_ABOVE_FIRST_UPGRADE);
  const end = Math.min(entries.length, lineIndex + 1 + ROWS_BELOW_LINE);

  return {
    entries: entries.slice(start, end),
    hiddenAbove: start,
    hiddenBelow: entries.length - end,
  };
};
