// Method registry (design spec): drives the table columns, header tooltips,
// and legend so shipping a method is a registry entry plus its math module.
// `available: false` entries render as placeholder columns with the reason.
// The copy here is sport-neutral; a sport rewords any of it with examples of
// its own through `methodCopy` on its descriptor.

import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import {
  type FantasyMethodKey,
  type MethodCopy,
  type WeightedMethodKey,
} from "#core/valuation/types";

export type FantasyMethodMeta = MethodCopy & {
  key: FantasyMethodKey;
  label: string; // column header
  fullName: string;
  // `whyItMatters` is the plain-language "so what": what this column is
  // actually good for when you are setting a lineup, drafting, or weighing a
  // trade. `description` says what the number is; this says when to look at it.
  available: boolean;
  unavailableReason?: string;
};

const DEFAULT_METHODS: readonly FantasyMethodMeta[] = [
  {
    key: "zscore",
    label: "Z-Score",
    fullName: "Z-Score Valuation",
    description:
      "Distance from the average pool player in each category, scaled by how spread out the category is, then summed with your weights.",
    whyItMatters:
      'Use this to answer "who is better?" in a category league. It puts every kind of contributor on one scale, so you can rank off a single number instead of squinting at a row of stat columns.',
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
      "Prefer this in weekly head-to-head. A player whose production in a category swings wildly wins you that category some weeks and loses it others; G-Score trusts the steady producer more, and steady is what wins matchups.",
    formula: "Σ per category: (stat − pool avg) ÷ √(spread² + volatility²) × weight",
    available: true,
  },
  {
    key: "points",
    label: "PL Linear",
    fullName: "Points-League Linear",
    description:
      "The stat line priced in your league's points scoring, stat by stat. Ignores category weights.",
    whyItMatters:
      "Only matters if your league adds up one score per player instead of tracking categories. If it does, this is the number that decides everything — ignore the other columns. If it doesn't, ignore this one.",
    formula: "Σ per stat: total × points per unit",
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
      "Z-Score surplus over the replacement player at the scarcest position this player can fill.",
    whyItMatters:
      "Same question, but position-aware. When one position runs thin, a player's edge over the next-best player there counts for more. Use it when choosing between two similar players at different positions.",
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

// Every method, with the sport's own wording laid over the defaults.
export const fantasyMethods = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}): FantasyMethodMeta[] =>
  DEFAULT_METHODS.map((method) => ({ ...method, ...sport.methodCopy[method.key] }));

export const enabledMethods = ({
  methods,
}: {
  methods: readonly FantasyMethodMeta[];
}): FantasyMethodMeta[] => methods.filter((method) => method.available);

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
