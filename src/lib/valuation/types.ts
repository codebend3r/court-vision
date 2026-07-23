export type CountingCategory = "pts" | "reb" | "ast" | "stl" | "blk" | "tpm" | "tov";
export type RatioCategory = "fg" | "ft";
export type Category = CountingCategory | RatioCategory;
export type Basis = "perGame" | "total";

export type StatKey =
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "fg3m"
  | "tov"
  | "fgm"
  | "fga"
  | "ftm"
  | "fta";

// One player's stat totals over the active window (full season or lastN),
// plus the identity fields the table renders and the second moments G-Score
// needs for within-player variance. Produced by lib/valuation/loader.
export type FantasyStatLine = {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  gamesPlayed: number; // appearances (minutes > 0) in the window
  minutes: number; // total minutes in the window
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg3m: number;
  tov: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  sq: Record<StatKey, number>; // per-game sums of squares (Σ x_g²)
  cross: { fg: number; ft: number }; // Σ fgm_g·fga_g and Σ ftm_g·fta_g
};

export type CategoryContribution = {
  raw: number; // unweighted primitive (z or g), sign-corrected so higher is better
  weighted: number; // raw * weight; sums to total
};

export type PlayerValue = {
  playerId: number;
  total: number;
  breakdown: Partial<Record<Category, CategoryContribution>>;
};

// One row of the Fantasy Value table: every method's score for one player
// (PRD §9.3 — Z-Score, G-Score, Points, VORP, Positional; SGP is blocked).
export type FantasyPlayerValues = {
  playerId: number;
  z: number;
  g: number;
  points: number;
  vorp: number;
  positional: number;
};

export type PoolStats = {
  poolSize: number; // actual pool membership after trimming
  leagueFgPct: number; // attempt-weighted, over the pool
  leagueFtPct: number;
  byCategory: Record<
    Category,
    {
      mu: number;
      sigma: number; // between-player spread (Z-Score denominator)
      sigmaWithin: number; // typical game-level volatility (G-Score's extra term)
    }
  >;
};

export type ValuationConfig = {
  categories: Category[]; // included categories; excluded ones are absent
  weights: Partial<Record<Category, number>>; // absent key = 1
  basis: Basis;
  teams: number;
  rosterSlots: number;
};
