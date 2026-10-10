import { BASKETBALL_VALUED_STATS } from "@vision/sport-basketball/descriptor";
import { CATEGORY_KEYS, isCategory, SCORED_KEYS } from "@vision/sport-basketball/engine";
import { type BasketballLine } from "@vision/sport-basketball/types";
import { isKeyOf } from "@vision/core/util/record";
import {
  type CategoryWeights,
  type FantasyPlayerValues,
  type MethodWeights,
  type PoolStats,
  type RatioCategory,
  type ValuationConfig,
  type WeightedMethodKey,
} from "@/lib/valuation/types";

// The messages the Fantasy tab and its valuation worker trade. Lines travel
// once per pool (they are the bulk of the payload); every config change after
// that sends only the small inputs and names the pool it applies to.

// Everything valuePlayers reads besides the lines themselves.
export type ValuationInputs = {
  config: ValuationConfig;
  methodWeights: MethodWeights;
  windowGames: number | null;
};

// One valuation the view asks for: a pool plus the inputs to score it with.
export type ValuationJob<L extends BasketballLine> = {
  lines: readonly L[];
  inputs: ValuationInputs;
};

export type ValuationRequest =
  | { type: "lines"; linesId: number; lines: readonly BasketballLine[] }
  | { type: "value"; requestId: number; linesId: number; inputs: ValuationInputs };

export type ValuationResponse =
  | { type: "result"; requestId: number; values: FantasyPlayerValues[]; poolStats: PoolStats }
  | { type: "error"; requestId: number };

// Keyed records, so a key added to the union fails to compile here rather than
// slipping past the guards below.
const RATIO_CATEGORIES: Record<RatioCategory, true> = { fg: true, ft: true };
const WEIGHTED_METHODS: Record<WeightedMethodKey, true> = {
  z: true,
  g: true,
  vorp: true,
  pos: true,
  sgp: true,
  sim: true,
};
const RATIO_KEYS = CATEGORY_KEYS.filter(isKeyOf({ record: RATIO_CATEGORIES }));
const isWeightedMethod = isKeyOf({ record: WEIGHTED_METHODS });

const VALUE_KEYS: readonly (keyof FantasyPlayerValues)[] = [
  "playerId",
  "z",
  "g",
  "points",
  "vorp",
  "positional",
  "sgp",
  "sim",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNumbersFor =
  <K extends string>({ keys }: { keys: readonly K[] }) =>
  (value: unknown): value is Record<K, number> =>
    isRecord(value) && keys.every((key) => typeof value[key] === "number");

const isStatNumbers = isNumbersFor({ keys: BASKETBALL_VALUED_STATS });
const isRatioNumbers = isNumbersFor({ keys: RATIO_KEYS });
const isScoringNumbers = isNumbersFor({ keys: SCORED_KEYS });

export const isCategoryWeights = (value: unknown): value is CategoryWeights =>
  isRecord(value) &&
  Object.entries(value).every(([key, weight]) => isCategory(key) && typeof weight === "number");

export const isMethodWeights = (value: unknown): value is MethodWeights =>
  isRecord(value) &&
  Object.entries(value).every(
    ([key, weights]) => isWeightedMethod(key) && isCategoryWeights(weights),
  );

export const isValuationLine = (value: unknown): value is BasketballLine =>
  isRecord(value) &&
  typeof value.playerId === "number" &&
  (value.position === null || typeof value.position === "string") &&
  typeof value.gamesPlayed === "number" &&
  typeof value.playingTime === "number" &&
  isStatNumbers(value.stats) &&
  isStatNumbers(value.sq) &&
  isRatioNumbers(value.cross);

export const isValuationConfig = (value: unknown): value is ValuationConfig =>
  isRecord(value) &&
  Array.isArray(value.categories) &&
  value.categories.every((key) => typeof key === "string" && isCategory(key)) &&
  isCategoryWeights(value.weights) &&
  (value.basis === "perGame" || value.basis === "total") &&
  typeof value.teams === "number" &&
  typeof value.rosterSlots === "number" &&
  isScoringNumbers(value.scoring);

export const isValuationInputs = (value: unknown): value is ValuationInputs =>
  isRecord(value) &&
  isValuationConfig(value.config) &&
  isMethodWeights(value.methodWeights) &&
  (value.windowGames === null || typeof value.windowGames === "number");

// The worker reads whatever lands on its port, so it checks the shape before
// handing anything to the engine.
export const isValuationRequest = (value: unknown): value is ValuationRequest => {
  if (!isRecord(value)) return false;
  if (value.type === "lines") {
    return (
      typeof value.linesId === "number" &&
      Array.isArray(value.lines) &&
      value.lines.every(isValuationLine)
    );
  }
  return (
    value.type === "value" &&
    typeof value.requestId === "number" &&
    typeof value.linesId === "number" &&
    isValuationInputs(value.inputs)
  );
};

const isFantasyPlayerValues = isNumbersFor({ keys: VALUE_KEYS });

const isCategoryPoolStats = isNumbersFor({ keys: ["mu", "sigma", "sigmaWithin"] });

export const isPoolStats = (value: unknown): value is PoolStats =>
  isRecord(value) &&
  typeof value.poolSize === "number" &&
  isRatioNumbers(value.leagueRate) &&
  isRecord(value.byCategory) &&
  CATEGORY_KEYS.every(
    (key) => isRecord(value.byCategory) && isCategoryPoolStats(value.byCategory[key]),
  );

// And the view checks the worker's reply before rendering from it.
export const isValuationResponse = (value: unknown): value is ValuationResponse => {
  if (!isRecord(value) || typeof value.requestId !== "number") return false;
  if (value.type === "error") return true;
  return (
    value.type === "result" &&
    Array.isArray(value.values) &&
    value.values.every(isFantasyPlayerValues) &&
    isPoolStats(value.poolStats)
  );
};

// The URL parsers may hand back fresh objects for unchanged params, so inputs
// compare by value. The pool compares by identity: a new server payload is a
// new pool even if it happens to hold the same numbers.
const inputsKey = ({ config, methodWeights, windowGames }: ValuationInputs): string =>
  JSON.stringify([config, methodWeights, windowGames]);

export const sameValuationJob = <L extends BasketballLine>({
  a,
  b,
}: {
  a: ValuationJob<L>;
  b: ValuationJob<L>;
}): boolean => a.lines === b.lines && inputsKey(a.inputs) === inputsKey(b.inputs);
