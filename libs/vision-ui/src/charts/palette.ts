import { type Theme } from "#ui/theme/themes";

export type ChartChrome = {
  grid: string;
  axis: string;
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

// Chart chrome reads the live theme tokens, so it re-inks with the theme on
// its own: grid lines and axis rules in the border color; ticks, axis labels,
// reference lines and line-end labels in the muted text color.
export const CHART_CHROME: ChartChrome = {
  grid: "var(--color-border)",
  axis: "var(--color-text-muted)",
};

// Axis styling every chart shares: muted 12px tick labels, with the axis rule
// drawn in either the grid colour (the player charts) or the muted text
// colour (the trend charts). Spread it onto an XAxis or YAxis.
type ChartAxisPropsProps = {
  rule: keyof ChartChrome;
};

export const chartAxisProps = ({
  rule,
}: ChartAxisPropsProps): { stroke: string; tick: { fill: string; fontSize: number } } => ({
  stroke: CHART_CHROME[rule],
  tick: { fill: CHART_CHROME.axis, fontSize: 12 },
});

// Five solid hues for the watchlist trend charts, one per starred player, in
// fixed order. Validated with the dataviz six checks on adjacent pairs:
//   dark  — all checks pass; worst CVD ΔE 8.4 (protan), above the 8 target.
//   light — darker steps so every 3px line clears 3:1 on white; worst CVD
//           ΔE 6.6 sits in the 6–8 floor band, which is legal here because each
//           line is also directly labelled at its right end and named in the
//           legend, so identity never rests on colour alone.
const DARK_TREND_SERIES = ["#3987e5", "#c98500", "#199e70", "#9085e9", "#d55181"] as const;

// The four newer themes share the dark series (all dark-surfaced); each line is
// directly labelled and named in the legend, so identity never rests on
// colour alone.
const TREND_SERIES_BY_THEME: Record<Theme, readonly string[]> = {
  dark: DARK_TREND_SERIES,
  light: ["#2a78d6", "#a86a00", "#0f7d55", "#4a3aa7", "#c2185b"],
  "high-contrast": DARK_TREND_SERIES,
  "colorblind-safe": DARK_TREND_SERIES,
  "amber-crt": DARK_TREND_SERIES,
  "team-accent": DARK_TREND_SERIES,
};

type GetTrendPaletteProps = { theme: Theme };

export const getTrendPalette = ({ theme }: GetTrendPaletteProps): readonly string[] =>
  TREND_SERIES_BY_THEME[theme];

// The categorical series palette, in fixed slot order. Every player-page
// chart assigns hues from it by position within its own panel, so a metric
// keeps its colour however the neighbouring chips are toggled.
type GetSeriesPaletteProps = { theme: Theme };

export const getSeriesPalette = ({ theme }: GetSeriesPaletteProps): readonly string[] =>
  SERIES_BY_THEME[theme];
