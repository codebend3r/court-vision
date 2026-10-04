import { type AdvancedMetricKey } from "@/lib/players/searchParams";

// The fifteen advanced metrics span four incompatible scales; each panel plots
// one scale so no line is flattened by a neighbour a hundred times larger.
export type AdvancedPanelKey = "efficiency" | "shares" | "ratings" | "ratios";

export type AdvancedPanel = {
  key: AdvancedPanelKey;
  title: string;
  keys: readonly AdvancedMetricKey[];
};

export const ADVANCED_PANELS: readonly AdvancedPanel[] = [
  {
    key: "efficiency",
    title: "Shooting efficiency",
    keys: ["trueShootingPercentage", "effectiveFieldGoalPercentage"],
  },
  {
    key: "shares",
    title: "Shares",
    keys: [
      "pie",
      "usagePercentage",
      "assistPercentage",
      "reboundPercentage",
      "offensiveReboundPercentage",
      "defensiveReboundPercentage",
    ],
  },
  {
    key: "ratings",
    title: "Ratings & pace",
    keys: ["offensiveRating", "defensiveRating", "netRating", "pace"],
  },
  {
    key: "ratios",
    title: "Ratios",
    keys: ["assistRatio", "turnoverRatio", "assistToTurnover"],
  },
];
