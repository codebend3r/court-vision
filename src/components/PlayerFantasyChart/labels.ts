// The Z/G vocabulary every fantasy readout shares: the chart series, the
// Fantasy tab's list headers, and the game log's value columns. Kept apart
// from the chart code so a table that only prints "+1.4" never pulls the
// chart library into its bundle.

// The two series every category breakdown chart draws, in palette slot order.
export type MethodKey = "z" | "g";

export const METHOD_LABELS: Record<MethodKey, string> = { z: "Z-Score", g: "G-Score" };

export const formatSigned = (value: number): string =>
  value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
