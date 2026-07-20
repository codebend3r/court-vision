import type { AdvancedMetricKey } from "@/lib/players/searchParams";

export type AdvancedStatMeta = {
  key: AdvancedMetricKey;
  label: string;
  fullName: string;
  description: string;
  formula: string;
};

// Single source of truth for the Advanced tab: header row, body cells, header
// tooltips, and the legend panel all render from this list, in column order.
// Formulas are the readable simplified forms (PIE/USG% especially); the
// description carries the intuition. Definitions match NBA.com advanced stats.
export const ADVANCED_STAT_META: readonly AdvancedStatMeta[] = [
  {
    key: "pie",
    label: "PIE",
    fullName: "Player Impact Estimate",
    description:
      "The share of all positive game events — points, rebounds, assists, stops — the player accounts for while in the game.",
    formula: "player events ÷ total game events",
  },
  {
    key: "pace",
    label: "Pace",
    fullName: "Pace",
    description:
      "Possessions the player's team plays per 48 minutes with them on the floor — how fast the game runs.",
    formula: "48 × possessions ÷ minutes played",
  },
  {
    key: "assistPercentage",
    label: "AST%",
    fullName: "Assist Percentage",
    description: "The share of teammate field goals the player assisted while on the floor.",
    formula: "AST ÷ teammate FGM while on floor",
  },
  {
    key: "assistRatio",
    label: "AST Ratio",
    fullName: "Assist Ratio",
    description: "Assists per 100 possessions the player uses.",
    formula: "100 × AST ÷ (FGA + 0.44 × FTA + AST + TOV)",
  },
  {
    key: "assistToTurnover",
    label: "AST/TO",
    fullName: "Assist-to-Turnover Ratio",
    description: "Assists recorded for every turnover committed.",
    formula: "AST ÷ TOV",
  },
  {
    key: "defensiveRating",
    label: "DRTG",
    fullName: "Defensive Rating",
    description:
      "Points opponents score per 100 possessions while the player is on the floor. Lower is better.",
    formula: "100 × opponent PTS ÷ possessions",
  },
  {
    key: "defensiveReboundPercentage",
    label: "DREB%",
    fullName: "Defensive Rebound Percentage",
    description: "The share of available defensive rebounds the player grabs while on the floor.",
    formula: "DREB ÷ available defensive rebounds",
  },
  {
    key: "effectiveFieldGoalPercentage",
    label: "EFG%",
    fullName: "Effective Field Goal Percentage",
    description:
      "Field goal percentage with made threes counted as 1.5 makes, since they are worth an extra point.",
    formula: "(FGM + 0.5 × 3PM) ÷ FGA",
  },
  {
    key: "netRating",
    label: "Net Rtg",
    fullName: "Net Rating",
    description:
      "Point differential per 100 possessions with the player on the floor. Positive means the team outscores opponents.",
    formula: "ORTG − DRTG",
  },
  {
    key: "offensiveRating",
    label: "ORTG",
    fullName: "Offensive Rating",
    description: "Points the team scores per 100 possessions while the player is on the floor.",
    formula: "100 × team PTS ÷ possessions",
  },
  {
    key: "offensiveReboundPercentage",
    label: "OREB%",
    fullName: "Offensive Rebound Percentage",
    description: "The share of available offensive rebounds the player grabs while on the floor.",
    formula: "OREB ÷ available offensive rebounds",
  },
  {
    key: "reboundPercentage",
    label: "REB%",
    fullName: "Rebound Percentage",
    description: "The share of all available rebounds the player grabs while on the floor.",
    formula: "REB ÷ available rebounds",
  },
  {
    key: "trueShootingPercentage",
    label: "TS%",
    fullName: "True Shooting Percentage",
    description: "Shooting efficiency in one number: twos, threes, and free throws all count.",
    formula: "PTS ÷ (2 × (FGA + 0.44 × FTA))",
  },
  {
    key: "turnoverRatio",
    label: "TOV Ratio",
    fullName: "Turnover Ratio",
    description: "Turnovers per 100 possessions the player uses.",
    formula: "100 × TOV ÷ (FGA + 0.44 × FTA + AST + TOV)",
  },
  {
    key: "usagePercentage",
    label: "USG%",
    fullName: "Usage Percentage",
    description:
      "The share of team plays the player finishes — with a shot, free throws, or a turnover — while on the floor.",
    formula: "(FGA + 0.44 × FTA + TOV) ÷ team plays while on floor",
  },
];
