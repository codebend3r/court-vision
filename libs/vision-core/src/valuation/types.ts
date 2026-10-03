import { type Category, type SportKeys } from "#core/sport/types";

export type Basis = "perGame" | "total";

// One player's stat totals over the active window (full season or lastN),
// plus the second moments G-Score needs for within-player variance. A sport's
// app extends it with the identity fields its tables render.
export type ValuationLine<K extends SportKeys> = {
  playerId: number;
  position: string | null;
  gamesPlayed: number; // appearances (playing time > 0) in the window
  playingTime: number; // total playing time in the window
  stats: Record<K["valued"], number>;
  sq: Record<K["valued"], number>; // per-game sums of squares (Σ x_g²)
  cross: Record<K["ratio"], number>; // Σ numerator_g · denominator_g per ratio category
};

export type CategoryContribution = {
  raw: number; // unweighted primitive (z or g), sign-corrected so higher is better
  weighted: number; // raw * weight; sums to total
};

export type PlayerValue<K extends SportKeys> = {
  playerId: number;
  total: number;
  breakdown: Partial<Record<Category<K>, CategoryContribution>>;
};

// One row of the Fantasy Value table: every method's score for one player
// (PRD §9.3 — Z-Score, G-Score, PL Linear, VORP, Positional, SGP, Sim Value).
export type FantasyPlayerValues = {
  playerId: number;
  z: number;
  g: number;
  points: number;
  vorp: number;
  positional: number;
  sgp: number;
  sim: number;
};

export type CategoryPoolStats = {
  mu: number;
  sigma: number; // between-player spread (Z-Score denominator)
  sigmaWithin: number; // typical game-level volatility (G-Score's extra term)
};

export type PoolStats<K extends SportKeys> = {
  poolSize: number; // actual pool membership after trimming
  leagueRate: Record<K["ratio"], number>; // Σ numerator ÷ Σ denominator over the pool, unscaled
  byCategory: Record<Category<K>, CategoryPoolStats>;
};

// Points-league scoring table: how many fantasy points each stat pays. Keyed
// by the raw stat, not by category, because a points league scores the box
// score rather than winning categories.
export type ScoringSettings<K extends SportKeys> = Record<K["scoring"], number>;

// The six weighted method columns, keyed by their sort keys. PL Linear is
// absent on purpose: it prices the box score with the Scoring table and never
// reads category weights.
export type WeightedMethodKey = "z" | "g" | "vorp" | "pos" | "sgp" | "sim";

export type CategoryWeights<K extends SportKeys> = Partial<Record<Category<K>, number>>;

// One independent weight set per method column. The Weights panel edits the
// set belonging to whichever method column the table is sorted by, so a punt
// tuned for Z-Score never leaks into G-Score's ranking.
export type MethodWeights<K extends SportKeys> = Partial<
  Record<WeightedMethodKey, CategoryWeights<K>>
>;

export type ValuationConfig<K extends SportKeys> = {
  categories: Category<K>[]; // included categories; excluded ones are absent
  weights: CategoryWeights<K>; // absent key = 1
  basis: Basis;
  teams: number;
  rosterSlots: number;
  scoring: ScoringSettings<K>; // PL Linear only; the category methods ignore it
};

export type FantasyMethodKey =
  | "zscore"
  | "gscore"
  | "points"
  | "vorp"
  | "positional"
  | "sgp"
  | "simvalue";

// The registry text a sport may reword for its own examples.
export type MethodCopy = {
  description: string;
  whyItMatters: string;
  formula: string;
};
