import { type LeagueScoringType } from "@vision/core/league/scoring";
import {
  CATEGORY_KEYS,
  DEFAULT_POINTS_SCORING,
  DEFAULT_VALUATION_CONFIG,
} from "@vision/sport-basketball/engine";
import { type Category, type ScoringStatKey } from "@vision/sport-basketball/types";

// The league-settings rules every surface applies the same way: the Fantasy
// tab's controls and URL, the league form, and the server actions that store
// a league. Change a bound or a fallback here, never at a call site.

export type CountBounds = { min: number; max: number; fallback: number };

// A cleared or unparsable box falls back to the sport's standard league
// (12 teams, 13 slots), never to the field's minimum.
export const LEAGUE_BOUNDS: Readonly<Record<"teams" | "slots", CountBounds>> = {
  teams: { min: 2, max: 30, fallback: DEFAULT_VALUATION_CONFIG.teams },
  slots: { min: 1, max: 25, fallback: DEFAULT_VALUATION_CONFIG.rosterSlots },
};

// The scoring table's per-stat band: points can be negative (turnovers) or
// fractional, so they are clamped rather than snapped like weights.
export const SCORE_BOUNDS: Readonly<{ min: number; max: number }> = { min: -10, max: 10 };

// Category weights are multiplicative, clamped to [0, 2] in 0.25 steps (PRD §7).
export const WEIGHT_BOUNDS: Readonly<{ min: number; max: number; step: number }> = {
  min: 0,
  max: 2,
  step: 0.25,
};

type ClampIntProps = { value: number } & CountBounds;

export const clampInt = ({ value, min, max, fallback }: ClampIntProps): number =>
  Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;

// NaN reads as "untouched", i.e. the default weight of 1.
type SnapWeightProps = { value: number };

export const snapWeight = ({ value }: SnapWeightProps): number => {
  if (Number.isNaN(value)) return 1;
  const clamped = Math.min(WEIGHT_BOUNDS.max, Math.max(WEIGHT_BOUNDS.min, value));
  return Math.round(clamped / WEIGHT_BOUNDS.step) * WEIGHT_BOUNDS.step;
};

type ClampScoreProps = { value: number };

export const clampScore = ({ value }: ClampScoreProps): number =>
  Math.round(Math.min(SCORE_BOUNDS.max, Math.max(SCORE_BOUNDS.min, value)) * 100) / 100;

// The normalizers take whatever a box or a form field held (a string, a File,
// or nothing at all) and return the value the setting stores.
type ParseFloatOrNaNProps = { raw: unknown };

const parseFloatOrNaN = ({ raw }: ParseFloatOrNaNProps): number =>
  typeof raw === "string" ? Number.parseFloat(raw) : Number.NaN;

type NormalizeCountProps = { raw: unknown; bounds: CountBounds };

export const normalizeCount = ({ raw, bounds }: NormalizeCountProps): number =>
  clampInt({ value: typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN, ...bounds });

type NormalizeWeightProps = { raw: unknown };

export const normalizeWeight = ({ raw }: NormalizeWeightProps): number =>
  snapWeight({ value: parseFloatOrNaN({ raw }) });

// An emptied scoring box restores that stat's default rather than scoring 0.
type NormalizeScoreProps = { raw: unknown; stat: ScoringStatKey };

export const normalizeScore = ({ raw, stat }: NormalizeScoreProps): number => {
  const parsed = parseFloatOrNaN({ raw });
  return Number.isFinite(parsed) ? clampScore({ value: parsed }) : DEFAULT_POINTS_SCORING[stat];
};

type WithoutWeightProps = {
  weights: Partial<Record<Category, number>>;
  category: Category;
};

export const withoutWeight = ({
  weights,
  category,
}: WithoutWeightProps): Partial<Record<Category, number>> =>
  CATEGORY_KEYS.reduce<Partial<Record<Category, number>>>((acc, key) => {
    const weight = weights[key];
    return key === category || weight === undefined ? acc : { ...acc, [key]: weight };
  }, {});

// The scoring table is keyed by raw stat, so it needs its own labels — the
// category meta covers 3PM as "tpm" and has no entry for a points-league line.
export const SCORING_LABELS: Record<ScoringStatKey, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  fg3m: "3PM",
  tov: "TOV",
};

export const SCORING_TYPE_LABELS: Record<LeagueScoringType, string> = {
  h2h_categories: "H2H Categories",
  h2h_points: "H2H Points",
  roto: "Rotisserie",
};

// The order the league form offers them in.
export const SCORING_TYPES: readonly LeagueScoringType[] = ["h2h_categories", "h2h_points", "roto"];
