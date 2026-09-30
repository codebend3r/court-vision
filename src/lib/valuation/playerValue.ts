import { type FantasySeed } from "@/lib/leagues/fantasyDefaults";
import { type PlayerGameRange } from "@/lib/players/searchParams";
import { type MetricPoint } from "@/lib/stats/metricPoint";
import {
  CATEGORY_KEYS,
  CATEGORY_META,
  categoryPerGame,
  type CategoryKind,
} from "@/lib/valuation/categories";
import { valuePlayers } from "@/lib/valuation/index";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { FANTASY_METHODS, type FantasyMethodKey } from "@/lib/valuation/registry";
import {
  type Category,
  type FantasyPlayerValues,
  type FantasyStatLine,
  type MethodWeights,
  type ValuationConfig,
  type WeightedMethodKey,
} from "@/lib/valuation/types";
import {
  buildRollingGSeries,
  buildRollingZSeries,
  type DatedLog,
  ROLLING_WINDOW_GAMES,
} from "@/lib/watchlist/trend";

// One method column's score for the viewed player, with their standing among
// every player valued in the same window (competition ranking: ties share).
export type FantasyMethodReadout = {
  key: FantasyMethodKey;
  label: string;
  value: number;
  rank: number;
  of: number;
};

// Where the value comes from: each included category's sign-corrected raw z
// and g beside the per-game line that produced them.
export type FantasyCategoryBreakdown = {
  key: Category;
  label: string;
  fullName: string;
  kind: CategoryKind;
  perGame: number;
  z: number;
  g: number;
};

// Rolling value per game: null until the window fills, so the chart draws
// nothing rather than a stub built on too few games.
export type FantasyTrendPoint = MetricPoint & { z: number | null; g: number | null };

export type PlayerFantasyProfile = {
  readouts: FantasyMethodReadout[];
  breakdown: FantasyCategoryBreakdown[];
  trend: FantasyTrendPoint[];
  poolSize: number;
};

export type FantasyProfileLog = DatedLog & {
  gameId: string;
  matchup: string;
  winLoss: string | null;
};

const VALUE_BY_METHOD: Record<FantasyMethodKey, (values: FantasyPlayerValues) => number> = {
  zscore: (values) => values.z,
  gscore: (values) => values.g,
  points: (values) => values.points,
  vorp: (values) => values.vorp,
  positional: (values) => values.positional,
  sgp: (values) => values.sgp,
  simvalue: (values) => values.sim,
};

// The Fantasy tab's URL defaults, applied straight from the league seed: same
// numbers as the tab shows on first load, without the tab's controls.
export const configFromSeed = ({
  seed,
}: {
  seed: FantasySeed;
}): { config: ValuationConfig; methodWeights: MethodWeights } => {
  const excluded = seed.x ?? [];
  return {
    config: {
      categories: CATEGORY_KEYS.filter((key) => !excluded.some((entry) => entry === key)),
      weights: {},
      basis: "perGame",
      teams: seed.teams ?? 12,
      rosterSlots: seed.slots ?? 13,
      scoring: seed.s ?? DEFAULT_POINTS_SCORING,
    },
    methodWeights: seed.w ?? {},
  };
};

const rankAmong = ({
  values,
  value,
  pick,
}: {
  values: readonly FantasyPlayerValues[];
  value: number;
  pick: (values: FantasyPlayerValues) => number;
}): number => values.filter((entry) => pick(entry) > value).length + 1;

const weightedConfig = ({
  config,
  methodWeights,
  method,
}: {
  config: ValuationConfig;
  methodWeights: MethodWeights;
  method: WeightedMethodKey;
}): ValuationConfig => ({ ...config, weights: methodWeights[method] ?? config.weights });

// Everything the fantasy view shows for one player, scored the way the Fantasy
// Value tab scores the whole pool (lib/valuation/index) so the two agree to
// the decimal. `logs` is the player's full season in date order; the trend
// windows to the last `windowGames` after scoring so every plotted game still
// looks back over the ten before it.
export const buildPlayerFantasyProfile = ({
  lines,
  playerId,
  config,
  methodWeights,
  range,
  logs,
  windowGames,
}: {
  lines: readonly FantasyStatLine[];
  playerId: number;
  config: ValuationConfig;
  methodWeights: MethodWeights;
  range: PlayerGameRange;
  logs: readonly FantasyProfileLog[];
  windowGames: number | null;
}): PlayerFantasyProfile | null => {
  const line = lines.find((entry) => entry.playerId === playerId);
  if (line === undefined) return null;

  const { values, poolStats } = valuePlayers({ lines, config, methodWeights, range });
  const own = values.find((entry) => entry.playerId === playerId);
  if (own === undefined) return null;

  const readouts = FANTASY_METHODS.map((method): FantasyMethodReadout => {
    const pick = VALUE_BY_METHOD[method.key];
    const value = pick(own);
    return {
      key: method.key,
      label: method.label,
      value,
      rank: rankAmong({ values, value, pick }),
      of: values.length,
    };
  });

  const zConfig = weightedConfig({ config, methodWeights, method: "z" });
  const gConfig = weightedConfig({ config, methodWeights, method: "g" });
  const [zValue] = scoreZScore({ lines: [line], poolStats, config: zConfig });
  const [gValue] = scoreGScore({ lines: [line], poolStats, config: gConfig });
  const breakdown = CATEGORY_META.filter((meta) =>
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

  // The rolling scorers emit one point per game from the window size onward;
  // zip them back onto the full log so every game keeps its index.
  const seriesArgs = { playerId, fullName: line.fullName, logs, poolStats };
  const zPoints = buildRollingZSeries({ ...seriesArgs, config: zConfig }).points;
  const gPoints = buildRollingGSeries({ ...seriesArgs, config: gConfig }).points;
  const lead = ROLLING_WINDOW_GAMES - 1;
  const scored = logs.map((log, index): FantasyTrendPoint => ({
    gameIndex: index + 1,
    gameDate: log.gameDate.toISOString(),
    matchup: log.matchup,
    winLoss: log.winLoss,
    dnp: log.minutes === 0,
    z: index < lead ? null : (zPoints[index - lead]?.value ?? null),
    g: index < lead ? null : (gPoints[index - lead]?.value ?? null),
  }));
  const windowed = windowGames === null ? scored : scored.slice(-windowGames);
  const trend = windowed.map((point, index) => ({ ...point, gameIndex: index + 1 }));

  return { readouts, breakdown, trend, poolSize: poolStats.poolSize };
};
