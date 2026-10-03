import { type FantasySeed } from "@/lib/leagues/fantasyDefaults";
import { type PlayerGameRange } from "@/lib/players/searchParams";
import { type MetricPoint } from "@vision/core/series/metricPoint";
import { buildCategoryBreakdown, type FantasyCategoryBreakdown } from "@/lib/valuation/breakdown";
import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { buildFantasyGameValues, type FantasyGameValue } from "@/lib/valuation/gameValues";
import { valuePlayers } from "@/lib/valuation/index";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { FANTASY_METHODS, type FantasyMethodKey } from "@/lib/valuation/registry";
import { type FantasyTrendValue } from "@/lib/valuation/trend";
import {
  type FantasyPlayerValues,
  type FantasyStatLine,
  type MethodWeights,
  type ValuationConfig,
} from "@/lib/valuation/types";
import { type DatedLog } from "@/lib/watchlist/trend";

// One method column's score for the viewed player, with their standing among
// every player valued in the same window (competition ranking: ties share).
export type FantasyMethodReadout = {
  key: FantasyMethodKey;
  label: string;
  value: number;
  rank: number;
  of: number;
};

// Rolling value per game: null until the window fills, so the chart draws
// nothing rather than a stub built on too few games.
export type FantasyTrendPoint = FantasyTrendValue & Pick<MetricPoint, "matchup" | "winLoss">;

export type PlayerFantasyProfile = {
  readouts: FantasyMethodReadout[];
  breakdown: FantasyCategoryBreakdown[];
  trend: FantasyTrendPoint[];
  // Every game in `logs`, unwindowed and aligned by index, for the game log.
  games: FantasyGameValue[];
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

  const breakdown = buildCategoryBreakdown({ line, poolStats, config, methodWeights });

  // Game values compute the full-season rolling timeline once. The chart is
  // just a window onto those same readings, with metadata from the log spine.
  const games = buildFantasyGameValues({ line, logs, poolStats, config, methodWeights });
  const points = logs.map((log, index): FantasyTrendPoint => ({
    gameIndex: index + 1,
    gameNumber: index + 1,
    gameDate: log.gameDate.toISOString(),
    matchup: log.matchup,
    winLoss: log.winLoss,
    dnp: log.minutes === 0,
    z: games[index]?.rollingZ ?? null,
    g: games[index]?.rollingG ?? null,
  }));
  const windowed = windowGames === null ? points : points.slice(-windowGames);
  const trend = windowed.map((point, index) => ({ ...point, gameIndex: index + 1 }));

  return { readouts, breakdown, trend, games, poolSize: poolStats.poolSize };
};
