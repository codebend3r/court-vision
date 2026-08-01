// Method registry (design spec): drives the table columns, header tooltips,
// and legend so shipping a method is a registry entry plus its math module.
// `available: false` entries render as placeholder columns with the reason.

import { type WeightedMethodKey } from "@/lib/valuation/types";

export type FantasyMethodKey =
  | "zscore"
  | "gscore"
  | "points"
  | "vorp"
  | "positional"
  | "sgp"
  | "simvalue";

export type FantasyMethodMeta = {
  key: FantasyMethodKey;
  label: string; // column header
  fullName: string;
  description: string;
  // Plain-language "so what": what this column is actually good for when you
  // are setting a lineup, drafting, or weighing a trade. `description` says
  // what the number is; this says when to look at it.
  whyItMatters: string;
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
    whyItMatters:
      'Use this to answer "who is better?" in a category league. It puts a 25-point scorer and a shot-blocking center on one scale, so you can rank off a single number instead of squinting at seven stat columns.',
    formula: "Σ per category: (stat − pool avg) ÷ pool std dev × weight",
    available: true,
  },
  {
    key: "gscore",
    label: "G-Score",
    fullName: "G-Score Valuation",
    description:
      "Z-Score's edge divided by both the between-player spread and each category's game-to-game volatility, so unreliable weekly edges count for less in H2H.",
    whyItMatters:
      "Prefer this in weekly head-to-head. A player whose steals swing between 0 and 5 wins you that category some weeks and loses it others; G-Score trusts the steady producer more, and steady is what wins matchups.",
    formula: "Σ per category: (stat − pool avg) ÷ √(spread² + volatility²) × weight",
    available: true,
  },
  {
    key: "points",
    label: "PL Linear",
    fullName: "Points-League Linear",
    description:
      "The stat line priced in points-league scoring: PTS ×1, REB ×1.2, AST ×1.5, STL ×3, BLK ×3, TOV ×−1. Ignores category weights.",
    whyItMatters:
      "Only matters if your league adds up one score per player instead of tracking categories. If it does, this is the number that decides everything — ignore the other columns. If it doesn't, ignore this one.",
    formula: "pts×1 + reb×1.2 + ast×1.5 + stl×3 + blk×3 − tov×1",
    available: true,
  },
  {
    key: "vorp",
    label: "VORP",
    fullName: "Value Over Replacement",
    description:
      "Z-Score surplus over the last rostered player in your league (rank = teams × roster slots) — the real alternative on waivers.",
    whyItMatters:
      'Answers "how much would I actually lose by dropping him?" A player is only worth what he gives you over the best guy sitting on waivers, so this is the sanity check before you accept a trade or reach in a draft.',
    formula: "zScore(player) − zScore(replacement at teams × slots)",
    available: true,
  },
  {
    key: "positional",
    label: "Pos VORP",
    fullName: "Positional Value Over Replacement",
    description:
      "Z-Score surplus over the replacement player at the scarcest slot this player can fill (G/F/C parsed from position).",
    whyItMatters:
      "Same question, but position-aware. Good centers run out fast while guards are everywhere, so a center's edge over the next center counts for more. Use it when choosing between two similar players at different positions.",
    formula: "zScore(player) − min over eligible slots of zScore(slot replacement)",
    available: true,
  },
  {
    key: "sgp",
    label: "SGP",
    fullName: "Standings Gain Points",
    description:
      "Each category divided by how much of that stat separates two adjacent places in the standings, so the total reads in standings places. The denominators come from a synthetic league drafted out of the current pool, since no league history is available.",
    whyItMatters:
      'The most direct answer to "what do I need to catch third place?" in roto — it prices a stat by how many spots in the standings it buys you, rather than by how rare it is.',
    formula: "Σ per category: stat ÷ ((max − min team total) ÷ (teams − 1)) × weight",
    available: true,
  },
  {
    key: "simvalue",
    label: "Sim Value",
    fullName: "Monte Carlo Matchup Simulation",
    description:
      "Replays 400 simulated weeks and prices a player by the extra category wins they add to a league-average team, over what a freely available player would give you. Opponents are drawn from the spread between teams in your league settings.",
    whyItMatters:
      'Values a player by wins added rather than by raw production, so a stat you are already winning comfortably counts for less. Closest thing here to "will this player actually change my matchups?" — it is measured against an average team, not yet your own roster.',
    formula: "avg over simulated weeks: weighted category wins with player − without",
    available: true,
  },
];

export const ENABLED_METHODS: readonly FantasyMethodMeta[] = FANTASY_METHODS.filter(
  (method) => method.available,
);

export const methodMeta = (key: FantasyMethodKey): FantasyMethodMeta | undefined =>
  FANTASY_METHODS.find((method) => method.key === key);

// Weighted-column sort keys → registry keys, so the Weights panel can name the
// column it is editing with the same label the table header uses.
export const METHOD_KEY_BY_WEIGHTED: Record<WeightedMethodKey, FantasyMethodKey> = {
  z: "zscore",
  g: "gscore",
  vorp: "vorp",
  pos: "positional",
  sgp: "sgp",
  sim: "simvalue",
};
