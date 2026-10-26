import { getSeriesPalette } from "@vision/ui/charts/palette";
import { type Theme } from "@vision/ui/theme/themes";

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
