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

export type StatMeta = {
  key: StatKey;
  label: string;
  panel: StatPanel;
  color: string;
};

export type ChartChrome = {
  grid: string;
  axis: string;
  endLabel: string;
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

// Counting stats use all 7 slots (pts..tov); shooting stats reuse slots 0-2
// (fgPct/fg3Pct/ftPct) from the same palette.
const DARK_SERIES = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
] as const;

// The four new themes are all dark-surfaced, so they share the dark series;
// series identity never rides on color alone (dash patterns + labels carry
// it), which is what keeps this workable under colorblind-safe.
const SERIES_BY_THEME: Record<Theme, readonly string[]> = {
  dark: DARK_SERIES,
  light: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4"],
  "high-contrast": DARK_SERIES,
  "colorblind-safe": DARK_SERIES,
  "amber-crt": DARK_SERIES,
  "team-accent": DARK_SERIES,
};

// grid mirrors each theme's --color-border; axis/endLabel its --color-text-muted.
const CHROME_BY_THEME: Record<Theme, ChartChrome> = {
  dark: { grid: "#2a3050", axis: "#8b93b5", endLabel: "#8b93b5" },
  light: { grid: "#dfe3f0", axis: "#5a6280", endLabel: "#5a6280" },
  "high-contrast": { grid: "#7d86b4", axis: "#cfd4ec", endLabel: "#cfd4ec" },
  "colorblind-safe": { grid: "#2e3650", axis: "#98a1bd", endLabel: "#98a1bd" },
  "amber-crt": { grid: "#402f14", axis: "#b58c50", endLabel: "#b58c50" },
  "team-accent": { grid: "#333844", axis: "#9aa0b2", endLabel: "#9aa0b2" },
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
