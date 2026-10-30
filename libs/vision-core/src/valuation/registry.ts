// Method registry (design spec): drives the table columns, header tooltips,
// and legend so shipping a method is a registry entry plus its math module.
// The copy here is sport-neutral; a sport rewords any of it with examples of
// its own through `methodCopy` on its descriptor.

import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { recordFromKeys } from "#core/util/record";
import {
  type FantasyMethodKey,
  type MethodCopy,
  type MethodSortKey,
  type MethodValueKey,
  type WeightedMethodKey,
} from "#core/valuation/types";

export type FantasyMethodMeta = MethodCopy & {
  key: FantasyMethodKey;
  label: string; // column header
  fullName: string;
  // `whyItMatters` is the plain-language "so what": what this column is
  // actually good for when you are setting a lineup, drafting, or weighing a
  // trade. `description` says what the number is; this says when to look at it.
  sortKey: MethodSortKey; // the column's sort key, as URLs and leagues store it
  valueKey: MethodValueKey; // the FantasyPlayerValues field holding its score
  needsCategories: boolean; // false for the methods a points-only sport keeps
  // Whether a score reads as a gain or loss against someone, printed with a
  // "+" on gains. False for a plain total.
  signed: boolean;
};

// Keyed by method so the compiler insists on an entry for every key; the
// entries' order is the registry's display order.
const DEFAULT_METHODS: { readonly [M in FantasyMethodKey]: FantasyMethodMeta & { key: M } } = {
  zscore: {
    key: "zscore",
    label: "Z-Score",
    fullName: "Z-Score Valuation",
    description:
      "Distance from the average pool player in each category, scaled by how spread out the category is, then summed with your weights.",
    whyItMatters:
      'Use this to answer "who is better?" in a category league. It puts every kind of contributor on one scale, so you can rank off a single number instead of squinting at a row of stat columns.',
    formula: "Σ per category: (stat − pool avg) ÷ pool std dev × weight",
    sortKey: "z",
    valueKey: "z",
    needsCategories: true,
    signed: true,
  },
  gscore: {
    key: "gscore",
    label: "G-Score",
    fullName: "G-Score Valuation",
    description:
      "Z-Score's edge divided by both the between-player spread and each category's game-to-game volatility, so unreliable weekly edges count for less in H2H.",
    whyItMatters:
      "Prefer this in weekly head-to-head. A player whose production in a category swings wildly wins you that category some weeks and loses it others; G-Score trusts the steady producer more, and steady is what wins matchups.",
    formula: "Σ per category: (stat − pool avg) ÷ √(spread² + volatility²) × weight",
    sortKey: "g",
    valueKey: "g",
    needsCategories: true,
    signed: true,
  },
  points: {
    key: "points",
    label: "PL Linear",
    fullName: "Points-League Linear",
    description:
      "The stat line priced in your league's points scoring, stat by stat. Ignores category weights.",
    whyItMatters:
      "Only matters if your league adds up one score per player instead of tracking categories. If it does, this is the number that decides everything — ignore the other columns. If it doesn't, ignore this one.",
    formula: "Σ per stat: total × points per unit",
    sortKey: "points",
    valueKey: "points",
    needsCategories: false,
    // A points total rather than a surplus over anyone.
    signed: false,
  },
  vorp: {
    key: "vorp",
    label: "VORP",
    fullName: "Value Over Replacement",
    description:
      "Z-Score surplus over the last rostered player in your league (rank = teams × roster slots) — the real alternative on waivers.",
    whyItMatters:
      'Answers "how much would I actually lose by dropping him?" A player is only worth what he gives you over the best guy sitting on waivers, so this is the sanity check before you accept a trade or reach in a draft.',
    formula: "zScore(player) − zScore(replacement at teams × slots)",
    sortKey: "vorp",
    valueKey: "vorp",
    needsCategories: false,
    signed: true,
  },
  positional: {
    key: "positional",
    label: "Pos VORP",
    fullName: "Positional Value Over Replacement",
    description:
      "Z-Score surplus over the replacement player at the scarcest position this player can fill.",
    whyItMatters:
      "Same question, but position-aware. When one position runs thin, a player's edge over the next-best player there counts for more. Use it when choosing between two similar players at different positions.",
    formula: "zScore(player) − min over eligible slots of zScore(slot replacement)",
    sortKey: "pos",
    valueKey: "positional",
    needsCategories: false,
    signed: true,
  },
  sgp: {
    key: "sgp",
    label: "SGP",
    fullName: "Standings Gain Points",
    description:
      "Each category divided by how much of that stat separates two adjacent places in the standings, so the total reads in standings places. The denominators come from a synthetic league drafted out of the current pool, since no league history is available.",
    whyItMatters:
      'The most direct answer to "what do I need to catch third place?" in roto — it prices a stat by how many spots in the standings it buys you, rather than by how rare it is.',
    formula: "Σ per category: stat ÷ ((max − min team total) ÷ (teams − 1)) × weight",
    sortKey: "sgp",
    valueKey: "sgp",
    needsCategories: true,
    signed: true,
  },
  simvalue: {
    key: "simvalue",
    label: "Sim Value",
    fullName: "Monte Carlo Matchup Simulation",
    description:
      "Replays 400 simulated weeks and prices a player by the extra category wins they add to a league-average team, over what a freely available player would give you. Opponents are drawn from the spread between teams in your league settings.",
    whyItMatters:
      'Values a player by wins added rather than by raw production, so a stat you are already winning comfortably counts for less. Closest thing here to "will this player actually change my matchups?" — it is measured against an average team, not yet your own roster.',
    formula: "avg over simulated weeks: weighted category wins with player − without",
    sortKey: "sim",
    valueKey: "sim",
    needsCategories: true,
    signed: true,
  },
};

const METHOD_LIST: readonly FantasyMethodMeta[] = Object.values(DEFAULT_METHODS);

// The sport's methods in registry order, with its own wording laid over the
// defaults.
type FantasyMethodsProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
};

export const fantasyMethods = <K extends SportKeys>({
  sport,
}: FantasyMethodsProps<K>): FantasyMethodMeta[] =>
  METHOD_LIST.filter((method) => sport.methods.includes(method.key)).map((method) => ({
    ...method,
    ...sport.methodCopy[method.key],
  }));

// Whether a method scores categories at all, so a sport without any cannot
// list it.
type MethodNeedsCategoriesProps = { key: FantasyMethodKey };

export const methodNeedsCategories = ({ key }: MethodNeedsCategoriesProps): boolean =>
  DEFAULT_METHODS[key].needsCategories;

// Every method's score field, in registry order: the seven readings a rolling
// chart, a league average or a method picker covers.
export const METHOD_VALUE_KEYS: readonly MethodValueKey[] = METHOD_LIST.map(
  (method) => method.valueKey,
);

// Score field → the column header the registry gives that method, so a chart
// labels a method exactly as the table does.
export const LABEL_BY_VALUE_KEY: Record<MethodValueKey, string> = recordFromKeys({
  keys: METHOD_VALUE_KEYS,
  value: (valueKey) => {
    const method = METHOD_LIST.find((entry) => entry.valueKey === valueKey);
    if (method === undefined) throw new Error(`No registry method scores "${valueKey}"`);
    return method.label;
  },
});

// Registry key → the sort key its column answers to (`positional` → `pos`):
// what a stored preferred formula seeds the table's sort with.
export const SORT_KEY_BY_METHOD: Record<FantasyMethodKey, MethodSortKey> = recordFromKeys({
  keys: METHOD_LIST.map((method) => method.key),
  value: (key) => DEFAULT_METHODS[key].sortKey,
});

// Sort key → the FantasyPlayerValues field its column ranks by (`pos` →
// `positional`): what a list sorted by a method column compares.
export const VALUE_KEY_BY_SORT: Record<MethodSortKey, MethodValueKey> = recordFromKeys({
  keys: METHOD_LIST.map((method) => method.sortKey),
  value: (sortKey) => {
    const method = METHOD_LIST.find((entry) => entry.sortKey === sortKey);
    if (method === undefined) throw new Error(`No registry method sorts by "${sortKey}"`);
    return method.valueKey;
  },
});

// Every weight set belongs to one method column (spec: per-column weights).
export const WEIGHTED_METHOD_KEYS: readonly WeightedMethodKey[] = [
  "z",
  "g",
  "vorp",
  "pos",
  "sgp",
  "sim",
];

export const isWeightedMethodKey = (value: string | undefined): value is WeightedMethodKey =>
  WEIGHTED_METHOD_KEYS.some((key) => key === value);

// Weighted-column sort keys → registry keys, so the Weights panel can name the
// column it is editing with the same label the table header uses.
export const METHOD_KEY_BY_WEIGHTED: Record<WeightedMethodKey, FantasyMethodKey> = recordFromKeys({
  keys: WEIGHTED_METHOD_KEYS,
  value: (sortKey) => {
    const method = METHOD_LIST.find((entry) => entry.sortKey === sortKey);
    if (method === undefined) throw new Error(`No registry method sorts by "${sortKey}"`);
    return method.key;
  },
});
