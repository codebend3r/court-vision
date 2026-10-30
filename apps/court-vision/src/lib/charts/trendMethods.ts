import { METHOD_VALUE_KEYS } from "@vision/core/valuation/registry";
import { type MethodValueKey } from "@vision/core/valuation/types";

// The rolling charts draw one small chart per method, all seven on by
// default. A reader may hide any of them, but never the last one: an empty
// row of charts reads as broken, not as a choice.
type VisibleMethodsProps = { hidden: readonly MethodValueKey[] };

export const visibleMethods = ({ hidden }: VisibleMethodsProps): MethodValueKey[] => {
  const shown = METHOD_VALUE_KEYS.filter((key) => !hidden.includes(key));
  return shown.length ? shown : [...METHOD_VALUE_KEYS];
};

// The hidden set after a reader flips one method. Hiding the only visible
// chart is refused (the set comes back unchanged), and the result keeps the
// registry's order so the URL stays stable.
type ToggleMethodProps = { hidden: readonly MethodValueKey[]; key: MethodValueKey };

export const toggleMethod = ({ hidden, key }: ToggleMethodProps): MethodValueKey[] => {
  if (hidden.includes(key)) return hidden.filter((entry) => entry !== key);
  const next = METHOD_VALUE_KEYS.filter((entry) => entry === key || hidden.includes(entry));
  return next.length === METHOD_VALUE_KEYS.length ? [...hidden] : next;
};

// How far back the rolling charts look, in games, or the whole season.
export const TREND_SPANS = ["5", "10", "20", "40", "season"] as const;
export type TrendSpan = (typeof TREND_SPANS)[number];

export const DEFAULT_TREND_SPAN: TrendSpan = "season";

export const TREND_SPAN_LABELS: Record<TrendSpan, string> = {
  "5": "Last 5",
  "10": "Last 10",
  "20": "Last 20",
  "40": "Last 40",
  season: "Season",
};

export const isTrendSpan = (value: unknown): value is TrendSpan =>
  TREND_SPANS.some((span) => span === value);

// The span as a game count for the trend builder; null is the whole season.
type GamesForSpanProps = { span: TrendSpan };

export const gamesForSpan = ({ span }: GamesForSpanProps): number | null =>
  span === "season" ? null : Number.parseInt(span, 10);

// A y-scale fitted to what is actually drawn rather than padded out to zero
// or shared with a calmer neighbour: the chart's job is to make a jump in
// form obvious, so the line fills the plot. A flat series still gets a little
// headroom (a tenth of its size, or a tenth of a point) so it doesn't sit on
// an edge.
const PAD_SHARE = 0.1;
const MIN_PAD = 0.1;

type FittedDomainProps = { values: readonly (number | null | undefined)[] };

export const fittedDomain = ({ values }: FittedDomainProps): [number, number] => {
  const drawn = values.filter((value): value is number => typeof value === "number");
  if (!drawn.length) return [-1, 1];
  const low = Math.min(...drawn);
  const high = Math.max(...drawn);
  const pad = high > low ? (high - low) * PAD_SHARE : Math.max(Math.abs(high) * PAD_SHARE, MIN_PAD);
  return [low - pad, high + pad];
};
