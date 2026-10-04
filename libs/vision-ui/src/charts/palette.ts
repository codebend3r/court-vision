import { type Theme } from "#ui/theme/themes";

export type ChartChrome = {
  grid: string;
  axis: string;
  endLabel: string;
};

// Seven categorical hues per theme, in fixed slot order.
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

// The categorical series palette, in fixed slot order. Every player-page
// chart assigns hues from it by position within its own panel, so a metric
// keeps its colour however the neighbouring chips are toggled.
export const getSeriesPalette = ({ theme }: { theme: Theme }): readonly string[] =>
  SERIES_BY_THEME[theme];

export const getChartChrome = ({ theme }: { theme: Theme }): ChartChrome => CHROME_BY_THEME[theme];
