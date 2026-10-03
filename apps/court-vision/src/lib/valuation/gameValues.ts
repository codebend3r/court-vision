import { aggregateWindowLogs } from "@/lib/valuation/aggregate";
import { weightedConfig } from "@/lib/valuation/breakdown";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { buildFantasyTrend } from "@/lib/valuation/trend";
import {
  type Category,
  type FantasyStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";
import { type DatedLog } from "@/lib/watchlist/trend";

// One game's fantasy value, as the player page's game log reads it: the game
// on its own (Z and G, and each included category's raw Z), and the rolling
// ten-game value ending at it. A missed game has no value of its own; its
// rolling value still stands, since the window looks back past it.
export type FantasyGameValue = {
  z: number | null;
  g: number | null;
  rollingZ: number | null;
  rollingG: number | null;
  categories: Partial<Record<Category, number>>;
};

// Every game in `logs` (the player's season, in date order), aligned by
// index, measured against a pool the caller holds fixed. Each game scores as
// a one-game line on the same per-game basis the season card uses, so a
// game's Z reads on the same scale as the player's season Z.
export const buildFantasyGameValues = ({
  line,
  logs,
  poolStats,
  config,
  methodWeights,
}: {
  line: FantasyStatLine;
  logs: readonly DatedLog[];
  poolStats: PoolStats;
  config: ValuationConfig;
  methodWeights: MethodWeights;
}): FantasyGameValue[] => {
  const zConfig = weightedConfig({ config, methodWeights, method: "z" });
  const gConfig = weightedConfig({ config, methodWeights, method: "g" });
  const trend = buildFantasyTrend({
    line,
    logs,
    poolStats,
    config,
    methodWeights,
    windowGames: null,
  });
  return logs.map((log, index): FantasyGameValue => {
    const rollingZ = trend[index]?.z ?? null;
    const rollingG = trend[index]?.g ?? null;
    if (log.minutes === 0) {
      return { z: null, g: null, rollingZ, rollingG, categories: {} };
    }
    // The season line lends its identity; every stat field comes from the game.
    const game: FantasyStatLine = { ...line, ...aggregateWindowLogs({ logs: [log] }) };
    const [zValue] = scoreZScore({ lines: [game], poolStats, config: zConfig });
    const [gValue] = scoreGScore({ lines: [game], poolStats, config: gConfig });
    const categories = config.categories.reduce<Partial<Record<Category, number>>>(
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
