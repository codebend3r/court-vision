import { weightedConfig } from "@/lib/valuation/breakdown";
import {
  type FantasyStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";
import {
  buildRollingGSeries,
  buildRollingZSeries,
  type DatedLog,
  ROLLING_WINDOW_GAMES,
} from "@/lib/watchlist/trend";

// The Fantasy tab's rolling charts show recent form. With no Games window
// chosen they cover each player's last 20 games, so anyone with 29 or more
// games has a full ten-game lookback at every plotted point.
export const DEFAULT_TREND_GAMES = 20;

// Rolling value per game: null until the window fills, so a chart draws
// nothing rather than a stub built on too few games. `gameIndex` is the
// position within the plotted window (the player page's axis); `gameNumber`
// is the game's place in the player's season, whatever window is cut.
export type FantasyTrendValue = {
  gameIndex: number;
  gameNumber: number;
  gameDate: string;
  dnp: boolean;
  z: number | null;
  g: number | null;
};

// One player's rolling ten-game Z and G across `logs` (their season in date
// order), measured against a pool the caller holds fixed. The trend windows
// to the last `windowGames` after scoring, so every plotted game still looks
// back over the ten before it. The player page's trend panel and the Fantasy
// tab's rolling rows both read from here.
export const buildFantasyTrend = ({
  line,
  logs,
  poolStats,
  config,
  methodWeights,
  windowGames,
}: {
  line: Pick<FantasyStatLine, "playerId" | "fullName">;
  logs: readonly DatedLog[];
  poolStats: PoolStats;
  config: ValuationConfig;
  methodWeights: MethodWeights;
  windowGames: number | null;
}): FantasyTrendValue[] => {
  const seriesArgs = { playerId: line.playerId, fullName: line.fullName, logs, poolStats };
  const zPoints = buildRollingZSeries({
    ...seriesArgs,
    config: weightedConfig({ config, methodWeights, method: "z" }),
  }).points;
  const gPoints = buildRollingGSeries({
    ...seriesArgs,
    config: weightedConfig({ config, methodWeights, method: "g" }),
  }).points;
  // The rolling scorers emit one point per game from the window size onward;
  // zip them back onto the full log so every game keeps its index.
  const lead = ROLLING_WINDOW_GAMES - 1;
  const scored = logs.map((log, index): FantasyTrendValue => ({
    gameIndex: index + 1,
    gameNumber: index + 1,
    gameDate: log.gameDate.toISOString(),
    dnp: log.minutes === 0,
    z: index < lead ? null : (zPoints[index - lead]?.value ?? null),
    g: index < lead ? null : (gPoints[index - lead]?.value ?? null),
  }));
  const windowed = windowGames === null ? scored : scored.slice(-windowGames);
  return windowed.map((point, index) => ({ ...point, gameIndex: index + 1 }));
};
