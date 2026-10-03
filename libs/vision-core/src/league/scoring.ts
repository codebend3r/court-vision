import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { categoryGuard } from "#core/valuation/categories";
import { type ScoringSettings } from "#core/valuation/types";

export type LeagueScoringType = "h2h_categories" | "h2h_points" | "roto";

// Per-type scoring payloads a league stores (a JSON column, discriminated
// externally by the league's scoring type and validated by the guards below).
export type H2hCategoriesConfig<K extends SportKeys> = {
  categories: Category<K>[];
  weights?: Partial<Record<Category<K>, number>>;
};
export type H2hPointsConfig<K extends SportKeys> = { scoring: ScoringSettings<K> };
export type RotoConfig<K extends SportKeys> = { categories: Category<K>[] };
export type LeagueScoringConfig<K extends SportKeys> =
  | H2hCategoriesConfig<K>
  | H2hPointsConfig<K>
  | RotoConfig<K>;

export const LEAGUE_SCORING_TYPES: readonly LeagueScoringType[] = [
  "h2h_categories",
  "h2h_points",
  "roto",
];

export const isLeagueScoringType = (value: string): value is LeagueScoringType =>
  LEAGUE_SCORING_TYPES.some((type) => type === value);

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

// Stored configs come back as untyped JSON, so each shape is checked against
// the sport's own categories and scoring keys before it is trusted.
export const scoringConfigGuards = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}) => {
  const isCategory = categoryGuard({ sport });

  const isCategoryList = (value: unknown): value is Category<K>[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && isCategory(entry));

  const isWeightRecord = (value: unknown): boolean =>
    isObject(value) &&
    Object.entries(value).every(
      ([key, weight]) => isCategory(key) && typeof weight === "number" && Number.isFinite(weight),
    );

  const isH2hCategoriesConfig = (value: unknown): value is H2hCategoriesConfig<K> => {
    if (!isObject(value)) return false;
    const record: Record<string, unknown> = { ...value };
    if (!isCategoryList(record.categories)) return false;
    return record.weights === undefined || isWeightRecord(record.weights);
  };

  const isH2hPointsConfig = (value: unknown): value is H2hPointsConfig<K> => {
    if (!isObject(value)) return false;
    const record: Record<string, unknown> = { ...value };
    const scoring = record.scoring;
    if (!isObject(scoring)) return false;
    const scoringRecord: Record<string, unknown> = { ...scoring };
    return sport.points.keys.every(
      (key) => typeof scoringRecord[key] === "number" && Number.isFinite(scoringRecord[key]),
    );
  };

  const isRotoConfig = (value: unknown): value is RotoConfig<K> => {
    if (!isObject(value)) return false;
    const record: Record<string, unknown> = { ...value };
    return isCategoryList(record.categories) && record.weights === undefined;
  };

  return { isH2hCategoriesConfig, isH2hPointsConfig, isRotoConfig };
};

export const defaultScoringConfig = <K extends SportKeys>({
  sport,
  scoringType,
}: {
  sport: SportDescriptor<K>;
  scoringType: LeagueScoringType;
}): LeagueScoringConfig<K> => {
  if (scoringType === "h2h_points") return { scoring: { ...sport.points.defaults } };
  return { categories: [...sport.categoryOrder] };
};

// Stored JSON → typed config; anything stale or malformed falls back to the
// scoring type's default instead of crashing a page.
export const parseScoringConfig = <K extends SportKeys>({
  sport,
  scoringType,
  value,
}: {
  sport: SportDescriptor<K>;
  scoringType: LeagueScoringType;
  value: unknown;
}): LeagueScoringConfig<K> => {
  const { isH2hCategoriesConfig, isH2hPointsConfig, isRotoConfig } = scoringConfigGuards({
    sport,
  });
  if (scoringType === "h2h_categories" && isH2hCategoriesConfig(value)) return value;
  if (scoringType === "h2h_points" && isH2hPointsConfig(value)) return value;
  if (scoringType === "roto" && isRotoConfig(value)) return value;
  return defaultScoringConfig({ sport, scoringType });
};
