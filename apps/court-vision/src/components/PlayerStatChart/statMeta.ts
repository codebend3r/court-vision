import { getSeriesPalette } from "@vision/ui/charts/palette";
import type { Theme } from "@vision/ui/theme/themes";

export const STAT_KEYS = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "min",
  "tov",
  "fgPct",
  "fg3Pct",
  "ftPct",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type StatPanel = "counting" | "shooting";

export type StatMeta = {
  key: StatKey;
  label: string;
  panel: StatPanel;
  color: string;
};

const COUNTING_STATS: ReadonlyArray<{ key: StatKey; label: string }> = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "min", label: "MIN" },
  { key: "tov", label: "TOV" },
];

const SHOOTING_STATS: ReadonlyArray<{ key: StatKey; label: string }> = [
  { key: "fgPct", label: "FG%" },
  { key: "fg3Pct", label: "3P%" },
  { key: "ftPct", label: "FT%" },
];

// Counting stats use all 7 palette slots (pts..tov); shooting stats reuse
// slots 0-2 (fgPct/fg3Pct/ftPct).
export const getStatMeta = ({ theme }: { theme: Theme }): StatMeta[] => {
  const palette = getSeriesPalette({ theme });
  const counting = COUNTING_STATS.map((stat, index): StatMeta => ({
    ...stat,
    panel: "counting",
    color: palette[index],
  }));
  const shooting = SHOOTING_STATS.map((stat, index): StatMeta => ({
    ...stat,
    panel: "shooting",
    color: palette[index],
  }));

  return [...counting, ...shooting];
};

export const DEFAULT_ACTIVE_KEYS: StatKey[] = getStatMeta({ theme: "dark" }).map(
  (meta) => meta.key,
);
