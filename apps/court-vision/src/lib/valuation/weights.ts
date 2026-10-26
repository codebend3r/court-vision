import { WEIGHTED_METHOD_KEYS } from "@vision/core/valuation/registry";
import { type WeightedMethodKey } from "@vision/core/valuation/types";
import { type CategoryWeights, type MethodWeights } from "@vision/sport-basketball/types";

// The Weights panel edits one flat weight map; it lands under the edited
// column's key so every other column's stored weights stay untouched. Columns
// come out in registry order, and an empty set is dropped, so default state
// never reaches the URL.
type SetColumnWeightsProps = {
  methodWeights: MethodWeights;
  key: WeightedMethodKey;
  weights: CategoryWeights;
};

export const setColumnWeights = ({
  methodWeights,
  key,
  weights,
}: SetColumnWeightsProps): MethodWeights =>
  WEIGHTED_METHOD_KEYS.reduce<MethodWeights>((acc, method) => {
    const entry = method === key ? weights : methodWeights[method];
    return entry === undefined || Object.keys(entry).length === 0
      ? acc
      : { ...acc, [method]: entry };
  }, {});
