import {
  createLoader,
  createParser,
  type inferParserType,
  parseAsArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { PAGE_SIZES, PLAYER_GAME_RANGES } from "@/lib/players/searchParams";
import { CATEGORY_KEYS, isCategory } from "@/lib/valuation/categories";
import type { Category } from "@/lib/valuation/types";

// One sort key per method column plus the name sorts. SGP has no key — it is
// a blocked placeholder column until denominators exist.
export type FantasySortKey = "z" | "g" | "points" | "vorp" | "pos" | "firstName" | "lastName";
export const FANTASY_SORT_KEYS: readonly FantasySortKey[] = [
  "z",
  "g",
  "points",
  "vorp",
  "pos",
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

// "ft:0,tov:0.5" ↔ { ft: 0, tov: 0.5 }. Weight-1 entries are dropped in both
// directions so default state never reaches the URL. Any malformed entry
// rejects the whole param (null → nuqs falls back to the default).
export const parseWeights = (value: string): Partial<Record<Category, number>> | null =>
  value.split(",").reduce<Partial<Record<Category, number>> | null>((acc, pair) => {
    if (acc === null) return null;
    const parts = pair.split(":");
    const key = parts[0];
    const rawWeight = parts[1];
    if (parts.length !== 2 || key === undefined || rawWeight === undefined) return null;
    if (!isCategory(key)) return null;
    const parsed = Number.parseFloat(rawWeight);
    if (!Number.isFinite(parsed)) return null;
    const snapped = snapWeight(parsed);
    return snapped === 1 ? acc : { ...acc, [key]: snapped };
  }, {});

export const serializeWeights = (weights: Partial<Record<Category, number>>): string =>
  CATEGORY_KEYS.flatMap((key) => {
    const weight = weights[key];
    return weight === undefined || weight === 1 ? [] : [`${key}:${weight}`];
  }).join(",");

const parseAsWeights = createParser({
  parse: parseWeights,
  serialize: serializeWeights,
  eq: (a, b) => serializeWeights(a) === serializeWeights(b),
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
  teams: parseAsClampedInt({ min: 2, max: 30 }).withDefault(12),
  slots: parseAsClampedInt({ min: 1, max: 25 }).withDefault(13),
  range: parseAsStringLiteral(PLAYER_GAME_RANGES).withDefault("all").withOptions({
    shallow: false,
  }),
  mode: parseAsStringLiteral(STAT_MODES).withDefault("average"),
};

export type FantasySearchParams = inferParserType<typeof fantasyParsers>;

export const loadFantasySearchParams = createLoader(fantasyParsers);
