import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import {
  type MethodWeights,
  type ValuationConfig,
  type WeightedMethodKey,
} from "#core/valuation/types";

// The neutral read of a player: every category, no weights, per-game, the
// sport's default league and points table. What a page shows before the user
// (or their league) configures anything.
type DefaultValuationConfigProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
};

export const defaultValuationConfig = <K extends SportKeys>({
  sport,
}: DefaultValuationConfigProps<K>): ValuationConfig<K> => ({
  categories: [...sport.categoryOrder],
  weights: {},
  basis: "perGame",
  teams: sport.defaultLeague.teams,
  rosterSlots: sport.defaultLeague.rosterSlots,
  scoring: { ...sport.points.defaults },
});

// A method column's own weight set over the shared config; a column with no
// stored weights falls back to the config's (all 1s by default).
type WeightedConfigProps<K extends SportKeys> = {
  config: ValuationConfig<K>;
  methodWeights: MethodWeights<K>;
  method: WeightedMethodKey;
};

export const weightedConfig = <K extends SportKeys>({
  config,
  methodWeights,
  method,
}: WeightedConfigProps<K>): ValuationConfig<K> => ({
  ...config,
  weights: methodWeights[method] ?? config.weights,
});
