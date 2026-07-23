// Method registry (design spec): drives the table columns, header tooltips,
// and legend so shipping a method is a registry entry plus its math module.
// `available: false` entries render as placeholder columns with the reason.

export type FantasyMethodKey = "zscore" | "gscore" | "points" | "vorp" | "positional" | "sgp";

export type FantasyMethodMeta = {
  key: FantasyMethodKey;
  label: string; // column header
  fullName: string;
  description: string;
  formula: string;
  available: boolean;
  unavailableReason?: string;
};

export const FANTASY_METHODS: readonly FantasyMethodMeta[] = [
  {
    key: "zscore",
    label: "Z-Score",
    fullName: "Z-Score Valuation",
    description:
      "Distance from the average pool player in each category, scaled by how spread out the category is, then summed with your weights.",
    formula: "Σ per category: (stat − pool avg) ÷ pool std dev × weight",
    available: true,
  },
  {
    key: "gscore",
    label: "G-Score",
    fullName: "G-Score Valuation",
    description:
      "Z-Score's edge divided by both the between-player spread and each category's game-to-game volatility, so unreliable weekly edges count for less in H2H.",
    formula: "Σ per category: (stat − pool avg) ÷ √(spread² + volatility²) × weight",
    available: true,
  },
  {
    key: "points",
    label: "Points",
    fullName: "Points-League Linear",
    description:
      "The stat line priced in points-league scoring: PTS ×1, REB ×1.2, AST ×1.5, STL ×3, BLK ×3, TOV ×−1. Ignores category weights.",
    formula: "pts×1 + reb×1.2 + ast×1.5 + stl×3 + blk×3 − tov×1",
    available: true,
  },
  {
    key: "vorp",
    label: "VORP",
    fullName: "Value Over Replacement",
    description:
      "Z-Score surplus over the last rostered player in your league (rank = teams × roster slots) — the real alternative on waivers.",
    formula: "zScore(player) − zScore(replacement at teams × slots)",
    available: true,
  },
  {
    key: "positional",
    label: "Pos VORP",
    fullName: "Positional Value Over Replacement",
    description:
      "Z-Score surplus over the replacement player at the scarcest slot this player can fill (G/F/C parsed from position).",
    formula: "zScore(player) − min over eligible slots of zScore(slot replacement)",
    available: true,
  },
  {
    key: "sgp",
    label: "SGP",
    fullName: "Standings Gain Points",
    description: "How far a stat moves you up the standings, calibrated to your league's history.",
    formula: "stat ÷ standings-gain denominator per category",
    available: false,
    unavailableReason:
      "Needs standings-gain denominators from league history — no sourced defaults table exists yet.",
  },
];

export const ENABLED_METHODS: readonly FantasyMethodMeta[] = FANTASY_METHODS.filter(
  (method) => method.available,
);

export const methodMeta = (key: FantasyMethodKey): FantasyMethodMeta | undefined =>
  FANTASY_METHODS.find((method) => method.key === key);
