import { CATEGORY_KEYS, isCategory } from "@/lib/valuation/categories";
import { DEFAULT_POINTS_SCORING, SCORED_KEYS } from "@/lib/valuation/methods/points";
import {
  type H2hCategoriesConfig,
  type H2hPointsConfig,
  type LeagueScoringConfig,
  type LeagueScoringType,
  type RotoConfig,
} from "@/lib/leagues/types";

const SCORING_TYPES: readonly LeagueScoringType[] = ["h2h_categories", "h2h_points", "roto"];

export const isLeagueScoringType = (value: string): value is LeagueScoringType =>
  SCORING_TYPES.some((type) => type === value);

const isCategoryList = (value: unknown): value is H2hCategoriesConfig["categories"] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((entry) => typeof entry === "string" && isCategory(entry));

const isWeightRecord = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).every(
    ([key, weight]) => isCategory(key) && typeof weight === "number" && Number.isFinite(weight),
  );
};

export const isH2hCategoriesConfig = (value: unknown): value is H2hCategoriesConfig => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  if (!isCategoryList(record.categories)) return false;
  return record.weights === undefined || isWeightRecord(record.weights);
};

export const isH2hPointsConfig = (value: unknown): value is H2hPointsConfig => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  const scoring = record.scoring;
  if (typeof scoring !== "object" || scoring === null) return false;
  const scoringRecord: Record<string, unknown> = { ...scoring };
  return SCORED_KEYS.every(
    (key) => typeof scoringRecord[key] === "number" && Number.isFinite(scoringRecord[key]),
  );
};

export const isRotoConfig = (value: unknown): value is RotoConfig => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return isCategoryList(record.categories) && record.weights === undefined;
};

export const defaultScoringConfig = ({
  scoringType,
}: {
  scoringType: LeagueScoringType;
}): LeagueScoringConfig => {
  if (scoringType === "h2h_points") return { scoring: { ...DEFAULT_POINTS_SCORING } };
  return { categories: [...CATEGORY_KEYS] };
};

// Stored Json → typed config; anything stale or malformed falls back to the
// scoring type's default instead of crashing a page.
export const parseScoringConfig = ({
  scoringType,
  value,
}: {
  scoringType: LeagueScoringType;
  value: unknown;
}): LeagueScoringConfig => {
  if (scoringType === "h2h_categories" && isH2hCategoriesConfig(value)) return value;
  if (scoringType === "h2h_points" && isH2hPointsConfig(value)) return value;
  if (scoringType === "roto" && isRotoConfig(value)) return value;
  return defaultScoringConfig({ scoringType });
};
