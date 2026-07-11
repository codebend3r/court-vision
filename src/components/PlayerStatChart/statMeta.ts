import type { Theme } from "@/lib/theme/ThemeProvider";

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

export interface StatMeta {
  key: StatKey;
  label: string;
  panel: StatPanel;
  color: string;
}

export interface ChartChrome {
  grid: string;
  axis: string;
  endLabel: string;
}

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

// Counting stats use all 7 slots (pts..tov); shooting stats reuse slots 0-2
// (fgPct/fg3Pct/ftPct) from the same palette.
const SERIES_BY_THEME: Record<Theme, readonly string[]> = {
  dark: ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181"],
  light: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4"],
};

const CHROME_BY_THEME: Record<Theme, ChartChrome> = {
  // grid mirrors --color-border, axis/endLabel mirror --color-text-muted (dark theme).
  dark: { grid: "#2a3050", axis: "#8b93b5", endLabel: "#8b93b5" },
  // grid mirrors --color-border, axis/endLabel mirror --color-text-muted (light theme).
  light: { grid: "#dfe3f0", axis: "#5a6280", endLabel: "#5a6280" },
};

export const getStatMeta = ({ theme }: { theme: Theme }): StatMeta[] => {
  const palette = SERIES_BY_THEME[theme];
  const counting = COUNTING_STATS.map(
    (stat, index): StatMeta => ({
      ...stat,
      panel: "counting",
      color: palette[index],
    }),
  );
  const shooting = SHOOTING_STATS.map(
    (stat, index): StatMeta => ({
      ...stat,
      panel: "shooting",
      color: palette[index],
    }),
  );

  return [...counting, ...shooting];
};

export const getChartChrome = ({ theme }: { theme: Theme }): ChartChrome => CHROME_BY_THEME[theme];

export const DEFAULT_ACTIVE_KEYS: StatKey[] = getStatMeta({ theme: "dark" }).map(
  (meta) => meta.key,
);
