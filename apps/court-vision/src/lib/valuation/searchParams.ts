import { DEFAULT_TREND_SPAN, TREND_SPANS } from "@/lib/charts/trendMethods";
import {
  createParser,
  parseAsArrayOf,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { clampScore, LEAGUE_BOUNDS, snapWeight } from "@/lib/leagues/settings";
import { listParsers, parseAsClampedInt } from "@/lib/players/searchParams";
import {
  CATEGORY_KEYS,
  DEFAULT_POINTS_SCORING,
  isCategory,
  SCORED_KEYS,
} from "@vision/sport-basketball/engine";
import { isWeightedMethodKey, WEIGHTED_METHOD_KEYS } from "@vision/core/valuation/registry";
import {
  type MethodWeights,
  type ScoringSettings,
  type ScoringStatKey,
} from "@vision/sport-basketball/types";

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

// How the scored rows render: the method-column table, or one row per player
// carrying a compact Z/G chart (each category's score, or the rolling ten-game
// value). All three read the same sorted, paged rows.
export const FANTASY_LAYOUTS = ["table", "categories", "rolling"] as const;
export type FantasyLayout = (typeof FANTASY_LAYOUTS)[number];

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
    const snapped = snapWeight({ value: parsed });
    return snapped === 1 ? acc : { ...acc, [method]: { ...(acc[method] ?? {}), [key]: snapped } };
  }, {});

export const serializeWeights = (weights: MethodWeights): string =>
  WEIGHTED_METHOD_KEYS.flatMap((method) =>
    CATEGORY_KEYS.flatMap((key) => {
      const weight = weights[method]?.[key] ?? 1;
      return weight === 1 ? [] : [`${method}.${key}:${weight}`];
    }),
  ).join(",");

const parseAsWeights = createParser({
  parse: parseWeights,
  serialize: serializeWeights,
  eq: (a, b) => serializeWeights(a) === serializeWeights(b),
});

const isScoringStatKey = (value: string): value is ScoringStatKey =>
  SCORED_KEYS.some((key) => key === value);

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
    return { ...acc, [key]: clampScore({ value: parsed }) };
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

// Shallow split (design spec): `range` needs new server data, everything else
// is satisfied client-side from the loaded pool. `mode` (the PRD's `basis`)
// stays shallow because per-game conversion happens client-side. The list
// keys (q, page, size, dir, range, mode) parse exactly as the other /players
// tabs read them.
export const fantasyParsers = {
  q: listParsers.q,
  page: listParsers.page,
  size: listParsers.size,
  sort: parseAsStringLiteral(FANTASY_SORT_KEYS).withDefault("z"),
  dir: listParsers.dir,
  x: parseAsArrayOf(parseAsStringLiteral(CATEGORY_KEYS)).withDefault([]),
  w: parseAsWeights.withDefault({}),
  s: parseAsScoring.withDefault(DEFAULT_POINTS_SCORING),
  teams: parseAsClampedInt(LEAGUE_BOUNDS.teams).withDefault(LEAGUE_BOUNDS.teams.fallback),
  slots: parseAsClampedInt(LEAGUE_BOUNDS.slots).withDefault(LEAGUE_BOUNDS.slots.fallback),
  range: listParsers.range.withOptions({ shallow: false }),
  mode: listParsers.mode,
  owner: listParsers.owner,
  layout: parseAsStringLiteral(FANTASY_LAYOUTS).withDefault("table"),
  // How far back the Rolling layout's charts look (the whole season by
  // default). Which charts show, and the average line, are the shared chart
  // settings (useTrendChartPrefs).
  span: parseAsStringLiteral(TREND_SPANS).withDefault(DEFAULT_TREND_SPAN),
};

export type FantasySearchParams = inferParserType<typeof fantasyParsers>;
