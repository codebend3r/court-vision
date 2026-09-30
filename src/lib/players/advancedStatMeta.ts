import type { AdvancedMetricKey } from "@/lib/players/searchParams";

// How a metric is stored and read: a "percentage" is a 0–1 share of something
// (PIE, TS%, USG%, the rebound shares) and displays like FG%; a "rating" is a
// per-100-possession rating, a ratio, or a pace, read to one decimal as-is.
export type AdvancedStatKind = "percentage" | "rating";

export type AdvancedStatMeta = {
  key: AdvancedMetricKey;
  label: string;
  fullName: string;
  description: string;
  formula: string;
  kind: AdvancedStatKind;
};

// Single source of truth for the Advanced tab and the player page's advanced
// view: header row, body cells, header tooltips, the legend panel, the summary
// card, and the chart chips all render from this list, in column order.
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
    kind: "percentage",
  },
  {
    key: "pace",
    label: "Pace",
    fullName: "Pace",
    description:
      "Possessions the player's team plays per 48 minutes with them on the floor — how fast the game runs.",
    formula: "48 × possessions ÷ minutes played",
    kind: "rating",
  },
  {
    key: "assistPercentage",
    label: "AST%",
    fullName: "Assist Percentage",
    description: "The share of teammate field goals the player assisted while on the floor.",
    formula: "AST ÷ teammate FGM while on floor",
    kind: "percentage",
  },
  {
    key: "assistRatio",
    label: "AST Ratio",
    fullName: "Assist Ratio",
    description: "Assists per 100 possessions the player uses.",
    formula: "100 × AST ÷ (FGA + 0.44 × FTA + AST + TOV)",
    kind: "rating",
  },
  {
    key: "assistToTurnover",
    label: "AST/TO",
    fullName: "Assist-to-Turnover Ratio",
    description: "Assists recorded for every turnover committed.",
    formula: "AST ÷ TOV",
    kind: "rating",
  },
  {
    key: "defensiveRating",
    label: "DRTG",
    fullName: "Defensive Rating",
    description:
      "Points opponents score per 100 possessions while the player is on the floor. Lower is better.",
    formula: "100 × opponent PTS ÷ possessions",
    kind: "rating",
  },
  {
    key: "defensiveReboundPercentage",
    label: "DREB%",
    fullName: "Defensive Rebound Percentage",
    description: "The share of available defensive rebounds the player grabs while on the floor.",
    formula: "DREB ÷ available defensive rebounds",
    kind: "percentage",
  },
  {
    key: "effectiveFieldGoalPercentage",
    label: "EFG%",
    fullName: "Effective Field Goal Percentage",
    description:
      "Field goal percentage with made threes counted as 1.5 makes, since they are worth an extra point.",
    formula: "(FGM + 0.5 × 3PM) ÷ FGA",
    kind: "percentage",
  },
  {
    key: "netRating",
    label: "Net Rtg",
    fullName: "Net Rating",
    description:
      "Point differential per 100 possessions with the player on the floor. Positive means the team outscores opponents.",
    formula: "ORTG − DRTG",
    kind: "rating",
  },
  {
    key: "offensiveRating",
    label: "ORTG",
    fullName: "Offensive Rating",
    description: "Points the team scores per 100 possessions while the player is on the floor.",
    formula: "100 × team PTS ÷ possessions",
    kind: "rating",
  },
  {
    key: "offensiveReboundPercentage",
    label: "OREB%",
    fullName: "Offensive Rebound Percentage",
    description: "The share of available offensive rebounds the player grabs while on the floor.",
    formula: "OREB ÷ available offensive rebounds",
    kind: "percentage",
  },
  {
    key: "reboundPercentage",
    label: "REB%",
    fullName: "Rebound Percentage",
    description: "The share of all available rebounds the player grabs while on the floor.",
    formula: "REB ÷ available rebounds",
    kind: "percentage",
  },
  {
    key: "trueShootingPercentage",
    label: "TS%",
    fullName: "True Shooting Percentage",
    description: "Shooting efficiency in one number: twos, threes, and free throws all count.",
    formula: "PTS ÷ (2 × (FGA + 0.44 × FTA))",
    kind: "percentage",
  },
  {
    key: "turnoverRatio",
    label: "TOV Ratio",
    fullName: "Turnover Ratio",
    description: "Turnovers per 100 possessions the player uses.",
    formula: "100 × TOV ÷ (FGA + 0.44 × FTA + AST + TOV)",
    kind: "rating",
  },
  {
    key: "usagePercentage",
    label: "USG%",
    fullName: "Usage Percentage",
    description:
      "The share of team plays the player finishes — with a shot, free throws, or a turnover — while on the floor.",
    formula: "(FGA + 0.44 × FTA + TOV) ÷ team plays while on floor",
    kind: "percentage",
  },
];

export const advancedStatMeta = (key: AdvancedMetricKey): AdvancedStatMeta | undefined =>
  ADVANCED_STAT_META.find((meta) => meta.key === key);

// Player-page display: percentages read like the season card's FG% ("58.8%"),
// ratings to one decimal; a game with no advanced row is a dash.
export const formatAdvancedStat = ({
  key,
  value,
}: {
  key: AdvancedMetricKey;
  value: number | null;
}): string => {
  if (value === null) return "—";
  return advancedStatMeta(key)?.kind === "percentage"
    ? `${(value * 100).toFixed(1)}%`
    : value.toFixed(1);
};
