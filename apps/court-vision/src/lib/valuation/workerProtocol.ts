import { isKeyOf, isRecord } from "@vision/core/util/record";
import { isWeightedMethodKey } from "@vision/core/valuation/registry";
import { basketball, BASKETBALL_VALUED_STATS } from "@vision/sport-basketball/descriptor";
import {
  CATEGORY_KEYS,
  isCategory,
  SCORED_KEYS,
  valuePlayers,
} from "@vision/sport-basketball/engine";
import { type BasketballLine } from "@vision/sport-basketball/types";
import {
  type CategoryWeights,
  type FantasyPlayerValues,
  type FantasyStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";

// The Fantasy tab's valuation worker is stateless: each request carries the
// whole job and gets back every method's score for it. Cloning the pool per
// request costs a couple of milliseconds against a valuation many times that,
// so the worker holds nothing between messages.

// Exactly valuePlayers' arguments, so a job goes to the engine as is.
export type ValuationJob = {
  lines: readonly BasketballLine[];
  config: ValuationConfig;
  methodWeights: MethodWeights;
  windowGames: number | null;
};

// The view's jobs carry its full stat lines, so the rows it renders from a
// settled result are the very lines that result was computed from.
export type FantasyValuationJob = Omit<ValuationJob, "lines"> & {
  lines: readonly FantasyStatLine[];
};

export type ValuationRequest = { requestId: number; job: ValuationJob };

export type ValuationResponse =
  | { type: "result"; requestId: number; values: FantasyPlayerValues[]; poolStats: PoolStats }
  | { type: "error"; requestId: number };

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
const RATIO_KEYS = CATEGORY_KEYS.filter(isKeyOf({ record: basketball.ratio }));

const isNumbersFor =
  <K extends string>({ keys }: { keys: readonly K[] }) =>
  (value: unknown): value is Record<K, number> =>
    isRecord(value) && keys.every((key) => typeof value[key] === "number");

const isStatNumbers = isNumbersFor({ keys: BASKETBALL_VALUED_STATS });
const isRatioNumbers = isNumbersFor({ keys: RATIO_KEYS });
const isScoringNumbers = isNumbersFor({ keys: SCORED_KEYS });
const isFantasyPlayerValues = isNumbersFor({ keys: VALUE_KEYS });
const isCategoryPoolStats = isNumbersFor({ keys: ["mu", "sigma", "sigmaWithin"] });

export const isCategoryWeights = (value: unknown): value is CategoryWeights =>
  isRecord(value) &&
  Object.entries(value).every(([key, weight]) => isCategory(key) && typeof weight === "number");

export const isMethodWeights = (value: unknown): value is MethodWeights =>
  isRecord(value) &&
  Object.entries(value).every(
    ([key, weights]) => isWeightedMethodKey(key) && isCategoryWeights(weights),
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

// The worker reads whatever lands on its port, so it checks the job before
// handing it to the engine.
export const isValuationJob = (value: unknown): value is ValuationJob =>
  isRecord(value) &&
  Array.isArray(value.lines) &&
  value.lines.every(isValuationLine) &&
  isValuationConfig(value.config) &&
  isMethodWeights(value.methodWeights) &&
  (value.windowGames === null || typeof value.windowGames === "number");

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

// The worker's whole job. Anything carrying a request id gets an answer, even
// a malformed job, so the view never waits on a reply that is not coming.
// Null means noise with no request to answer.
export const respondToValuation = (data: unknown): ValuationResponse | null => {
  if (!isRecord(data) || typeof data.requestId !== "number") return null;
  const { requestId, job } = data;
  if (!isValuationJob(job)) return { type: "error", requestId };
  try {
    return { type: "result", requestId, ...valuePlayers(job) };
  } catch {
    return { type: "error", requestId };
  }
};
