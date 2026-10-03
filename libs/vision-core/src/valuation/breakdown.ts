import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { categoryMeta, categoryPerGame, type CategoryKind } from "#core/valuation/categories";
import { scoreGScore } from "#core/valuation/methods/gscore";
import { scoreZScore } from "#core/valuation/methods/zscore";
import {
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
  type WeightedMethodKey,
} from "#core/valuation/types";

// Where a player's value comes from: each included category's sign-corrected
// raw z and g beside the per-game line that produced them.
export type FantasyCategoryBreakdown<K extends SportKeys> = {
  key: Category<K>;
  label: string;
  fullName: string;
  kind: CategoryKind;
  perGame: number;
  z: number;
  g: number;
};

// A method column's own weight set over the shared config; a column with no
// stored weights falls back to the config's (all 1s by default).
export const weightedConfig = <K extends SportKeys>({
  config,
  methodWeights,
  method,
}: {
  config: ValuationConfig<K>;
  methodWeights: MethodWeights<K>;
  method: WeightedMethodKey;
}): ValuationConfig<K> => ({ ...config, weights: methodWeights[method] ?? config.weights });

// One player's per-category Z and G against a pool the caller has already
// computed, in table order. Raw (unweighted) scores on purpose: a punted
// category still shows what is being given up. The player page's breakdown
// panel and the Fantasy tab's chart rows both read from here, so the two
// agree to the decimal.
export const buildCategoryBreakdown = <K extends SportKeys>({
  sport,
  line,
  poolStats,
  config,
  methodWeights,
}: {
  sport: SportDescriptor<K>;
  line: ValuationLine<K>;
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
  methodWeights: MethodWeights<K>;
}): FantasyCategoryBreakdown<K>[] => {
  const zConfig = weightedConfig({ config, methodWeights, method: "z" });
  const gConfig = weightedConfig({ config, methodWeights, method: "g" });
  const [zValue] = scoreZScore({ sport, lines: [line], poolStats, config: zConfig });
  const [gValue] = scoreGScore({ sport, lines: [line], poolStats, config: gConfig });
  return categoryMeta({ sport })
    .filter((meta) => config.categories.some((category) => category === meta.key))
    .map((meta): FantasyCategoryBreakdown<K> => ({
      key: meta.key,
      label: meta.label,
      fullName: meta.fullName,
      kind: meta.kind,
      perGame: categoryPerGame({ sport, line, category: meta.key }),
      z: zValue?.breakdown[meta.key]?.raw ?? 0,
      g: gValue?.breakdown[meta.key]?.raw ?? 0,
    }));
};
