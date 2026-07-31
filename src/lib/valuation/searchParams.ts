import {
  createLoader,
  createParser,
  parseAsArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { PAGE_SIZES, PLAYER_GAME_RANGES } from "@/lib/players/searchParams";
import { CATEGORY_KEYS, isCategory } from "@/lib/valuation/categories";
import { DEFAULT_POINTS_SCORING, SCORED_KEYS } from "@/lib/valuation/methods/points";
import {
  type MethodWeights,
  type ScoringSettings,
  type ScoringStatKey,
  type WeightedMethodKey,
} from "@/lib/valuation/types";

// One sort key per method column plus the name sorts.
export type FantasySortKey =
  | "z"
  | "g"
  | "points"
  | "vorp"
  | "pos"
  | "sgp"
  | "sim"
  | "firstName"
  | "lastName";
export const FANTASY_SORT_KEYS: readonly FantasySortKey[] = [
  "z",
  "g",
  "points",
  "vorp",
  "pos",
  "sgp",
  "sim",
  "firstName",
  "lastName",
];

const SORT_DIRECTIONS = ["asc", "desc"] as const;
const STAT_MODES = ["average", "total"] as const;

// Weights are multiplicative, clamped to [0, 2] in 0.25 steps (PRD §7).
// NaN reads as "untouched", i.e. the default weight of 1.
export const snapWeight = (value: number): number => {
  if (Number.isNaN(value)) return 1;
  return Math.round(Math.min(2, Math.max(0, value)) * 4) / 4;
};

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

// "z.ft:0,g.tov:0.5" ↔ { z: { ft: 0 }, g: { tov: 0.5 } }: each entry is scoped
// to the method column it tunes. Weight-1 entries are dropped in both
// directions so default state never reaches the URL. Any malformed entry
// rejects the whole param (null → nuqs falls back to the default).
export const parseWeights = (value: string): MethodWeights | null =>
  value.split(",").reduce<MethodWeights | null>((acc, pair) => {
    if (acc === null) return null;
    const parts = pair.split(":");
    const scope = parts[0];
    const rawWeight = parts[1];
    if (parts.length !== 2 || scope === undefined || rawWeight === undefined) return null;
    const scopeParts = scope.split(".");
    const method = scopeParts[0];
    const key = scopeParts[1];
    if (scopeParts.length !== 2 || method === undefined || key === undefined) return null;
    if (!isWeightedMethodKey(method) || !isCategory(key)) return null;
    const parsed = Number.parseFloat(rawWeight);
    if (!Number.isFinite(parsed)) return null;
    const snapped = snapWeight(parsed);
    return snapped === 1 ? acc : { ...acc, [method]: { ...(acc[method] ?? {}), [key]: snapped } };
  }, {});

export const serializeWeights = (weights: MethodWeights): string =>
  WEIGHTED_METHOD_KEYS.flatMap((method) =>
    CATEGORY_KEYS.flatMap((key) => {
      const weight = weights[method]?.[key];
      return weight === undefined || weight === 1 ? [] : [`${method}.${key}:${weight}`];
    }),
  ).join(",");

const parseAsWeights = createParser({
  parse: parseWeights,
  serialize: serializeWeights,
  eq: (a, b) => serializeWeights(a) === serializeWeights(b),
});

const isScoringStatKey = (value: string): value is ScoringStatKey =>
  SCORED_KEYS.some((key) => key === value);

// Points-league scoring is per-stat and can legitimately be negative (turnovers)
// or fractional, so it is clamped to a sane band rather than snapped like the
// category weights.
export const clampScore = (value: number): number =>
  Math.round(Math.min(10, Math.max(-10, value)) * 100) / 100;

// "reb:1.5,tov:-2" ↔ { reb: 1.5, tov: -2 }, defaults omitted in both directions
// so an untouched scoring table never reaches the URL.
export const parseScoring = (value: string): ScoringSettings | null =>
  value.split(",").reduce<ScoringSettings | null>((acc, pair) => {
    if (acc === null) return null;
    const parts = pair.split(":");
    const key = parts[0];
    const rawScore = parts[1];
    if (parts.length !== 2 || key === undefined || rawScore === undefined) return null;
    if (!isScoringStatKey(key)) return null;
    const parsed = Number.parseFloat(rawScore);
    if (!Number.isFinite(parsed)) return null;
    return { ...acc, [key]: clampScore(parsed) };
  }, DEFAULT_POINTS_SCORING);

export const serializeScoring = (scoring: ScoringSettings): string =>
  SCORED_KEYS.flatMap((key) =>
    scoring[key] === DEFAULT_POINTS_SCORING[key] ? [] : [`${key}:${scoring[key]}`],
  ).join(",");

const parseAsScoring = createParser({
  parse: parseScoring,
  serialize: serializeScoring,
  eq: (a, b) => serializeScoring(a) === serializeScoring(b),
});

const parseAsClampedInt = ({ min, max }: { min: number; max: number }) =>
  createParser({
    parse: (value: string) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isSafeInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : null;
    },
    serialize: (value: number) => String(value),
  });

// Shallow split (design spec): `range` needs new server data, everything else
// is satisfied client-side from the loaded pool. `mode` (the PRD's `basis`)
// stays shallow because per-game conversion happens client-side.
export const fantasyParsers = {
  q: parseAsString.withDefault(""),
  page: parseAsClampedInt({ min: 1, max: 100000 }).withDefault(1),
  size: parseAsNumberLiteral(PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(FANTASY_SORT_KEYS).withDefault("z"),
  dir: parseAsStringLiteral(SORT_DIRECTIONS).withDefault("desc"),
  x: parseAsArrayOf(parseAsStringLiteral(CATEGORY_KEYS)).withDefault([]),
  w: parseAsWeights.withDefault({}),
  s: parseAsScoring.withDefault(DEFAULT_POINTS_SCORING),
  teams: parseAsClampedInt({ min: 2, max: 30 }).withDefault(12),
  slots: parseAsClampedInt({ min: 1, max: 25 }).withDefault(13),
  range: parseAsStringLiteral(PLAYER_GAME_RANGES).withDefault("all").withOptions({
    shallow: false,
  }),
  mode: parseAsStringLiteral(STAT_MODES).withDefault("average"),
};

export type FantasySearchParams = inferParserType<typeof fantasyParsers>;

export const loadFantasySearchParams = createLoader(fantasyParsers);
