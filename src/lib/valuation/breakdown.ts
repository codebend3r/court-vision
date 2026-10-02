import { CATEGORY_META, categoryPerGame, type CategoryKind } from "@/lib/valuation/categories";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import {
  type Category,
  type FantasyStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  type WeightedMethodKey,
} from "@/lib/valuation/types";

// Where a player's value comes from: each included category's sign-corrected
// raw z and g beside the per-game line that produced them.
export type FantasyCategoryBreakdown = {
  key: Category;
  label: string;
  fullName: string;
  kind: CategoryKind;
  perGame: number;
  z: number;
  g: number;
};

// A method column's own weight set over the shared config; a column with no
// stored weights falls back to the config's (all 1s by default).
export const weightedConfig = ({
  config,
  methodWeights,
  method,
}: {
  config: ValuationConfig;
  methodWeights: MethodWeights;
  method: WeightedMethodKey;
}): ValuationConfig => ({ ...config, weights: methodWeights[method] ?? config.weights });

// One player's per-category Z and G against a pool the caller has already
// computed, in table order. Raw (unweighted) scores on purpose: a punted
// category still shows what is being given up. The player page's breakdown
// panel and the Fantasy tab's chart rows both read from here, so the two
// agree to the decimal.
export const buildCategoryBreakdown = ({
  line,
  poolStats,
  config,
  methodWeights,
}: {
  line: FantasyStatLine;
  poolStats: PoolStats;
  config: ValuationConfig;
  methodWeights: MethodWeights;
}): FantasyCategoryBreakdown[] => {
  const zConfig = weightedConfig({ config, methodWeights, method: "z" });
  const gConfig = weightedConfig({ config, methodWeights, method: "g" });
  const [zValue] = scoreZScore({ lines: [line], poolStats, config: zConfig });
  const [gValue] = scoreGScore({ lines: [line], poolStats, config: gConfig });
  return CATEGORY_META.filter((meta) =>
    config.categories.some((category) => category === meta.key),
  ).map((meta): FantasyCategoryBreakdown => ({
    key: meta.key,
    label: meta.label,
    fullName: meta.fullName,
    kind: meta.kind,
    perGame: categoryPerGame({ line, category: meta.key }),
    z: zValue?.breakdown[meta.key]?.raw ?? 0,
    g: gValue?.breakdown[meta.key]?.raw ?? 0,
  }));
};
