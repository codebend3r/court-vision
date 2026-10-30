import { getSeriesPalette } from "@vision/ui/charts/palette";
import { type Theme } from "@vision/ui/theme/themes";
import { recordFromKeys } from "@vision/core/util/record";
import { LABEL_BY_VALUE_KEY, METHOD_VALUE_KEYS } from "@vision/core/valuation/registry";
import { type MethodValueKey } from "@vision/core/valuation/types";

// The Z/G vocabulary every fantasy chart shares: the series, their labels and
// colours, and the one scale a page of them is drawn on. Kept apart from the
// chart code so a list that only prints "+1.4" never pulls the chart library
// into its bundle.

// The two series every category breakdown chart draws, in palette slot order.
export type MethodKey = "z" | "g";

export const METHOD_KEYS: readonly MethodKey[] = ["z", "g"];

export const METHOD_LABELS: Record<MethodKey, string> = { z: "Z-Score", g: "G-Score" };

export type MethodColors = Record<MethodKey, string>;

// Z and G take the theme's first two series colours, so the player page and
// the Fantasy tab's lists draw them alike.
type MethodColorsProps = { theme: Theme };

export const methodColors = ({ theme }: MethodColorsProps): MethodColors => {
  const palette = getSeriesPalette({ theme });
  return { z: palette[0], g: palette[1] };
};

// Every method's short label, by value key, for the rolling charts' pickers,
// legends and tooltips: the registry's column headers, so a chart names a
// method exactly as the table does.
export const VALUE_LABELS: Record<MethodValueKey, string> = LABEL_BY_VALUE_KEY;

export type ValueColors = Record<MethodValueKey, string>;

// Each method takes the palette slot of its registry position (Z first, G
// second, as the Z/G charts have them), so a method is drawn in the same
// colour on every chart that shows it.
type ValueColorsProps = { theme: Theme };

export const valueColors = ({ theme }: ValueColorsProps): ValueColors => {
  const palette = getSeriesPalette({ theme });
  const slot = (index: number): string => palette[index % palette.length] ?? palette[0];
  return recordFromKeys({
    keys: METHOD_VALUE_KEYS,
    value: (key) => slot(METHOD_VALUE_KEYS.indexOf(key)),
  });
};

// One symmetric scale around zero for a set of Z/G points (every row on a
// page, say), so a star's marks and a bench player's are comparable at a
// glance. A set of near-average points still gets a standard deviation of
// headroom rather than magnifying noise; a missing value counts as zero.
type SymmetricDomainProps = {
  points: readonly Record<MethodKey, number | null>[];
};

export const symmetricDomain = ({ points }: SymmetricDomainProps): [number, number] => {
  const extent = points.reduce(
    (max, point) =>
      METHOD_KEYS.reduce((inner, key) => Math.max(inner, Math.abs(point[key] ?? 0)), max),
    1,
  );
  return [-extent, extent];
};
