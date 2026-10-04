import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { aggregateWindowLogs, isAppearance, type DatedLog } from "#core/valuation/aggregate";
import { weightedConfig } from "#core/valuation/breakdown";
import { scoreGScore } from "#core/valuation/methods/gscore";
import { scoreZScore } from "#core/valuation/methods/zscore";
import { buildFantasyTrend } from "#core/valuation/trend";
import {
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  type ValuationLine,
} from "#core/valuation/types";

// One game's fantasy value, as the player page's game log reads it: the game
// on its own (Z and G, and each included category's raw Z), and the rolling
// ten-game value ending at it. A missed game has no value of its own; its
// rolling value still stands, since the window looks back past it.
export type FantasyGameValue<K extends SportKeys> = {
  z: number | null;
  g: number | null;
  rollingZ: number | null;
  rollingG: number | null;
  categories: Partial<Record<Category<K>, number>>;
};

// Every game in `logs` (the player's season, in date order), aligned by
// index, measured against a pool the caller holds fixed. Each game scores as
// a one-game line on the same per-game basis the season card uses, so a
// game's Z reads on the same scale as the player's season Z.
export const buildFantasyGameValues = <K extends SportKeys>({
  sport,
  line,
  logs,
  poolStats,
  config,
  methodWeights,
}: {
  sport: SportDescriptor<K>;
  line: ValuationLine<K>;
  logs: readonly DatedLog<K>[];
  poolStats: PoolStats<K>;
  config: ValuationConfig<K>;
  methodWeights: MethodWeights<K>;
}): FantasyGameValue<K>[] => {
  const zConfig = weightedConfig({ config, methodWeights, method: "z" });
  const gConfig = weightedConfig({ config, methodWeights, method: "g" });
  const trend = buildFantasyTrend({
    sport,
    line,
    logs,
    poolStats,
    config,
    methodWeights,
    windowGames: null,
  });
  return logs.map((log, index): FantasyGameValue<K> => {
    const rollingZ = trend[index]?.z ?? null;
    const rollingG = trend[index]?.g ?? null;
    if (!isAppearance(log)) {
      return { z: null, g: null, rollingZ, rollingG, categories: {} };
    }
    // The season line lends its identity; every stat field comes from the game.
    const game: ValuationLine<K> = { ...line, ...aggregateWindowLogs({ sport, logs: [log] }) };
    const [zValue] = scoreZScore({ sport, lines: [game], poolStats, config: zConfig });
    const [gValue] = scoreGScore({ sport, lines: [game], poolStats, config: gConfig });
    const categories = config.categories.reduce<Partial<Record<Category<K>, number>>>(
      (acc, category) => ({ ...acc, [category]: zValue?.breakdown[category]?.raw ?? 0 }),
      {},
    );
    return {
      z: zValue?.total ?? null,
      g: gValue?.total ?? null,
      rollingZ,
      rollingG,
      categories,
    };
  });
};
