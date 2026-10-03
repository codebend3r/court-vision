import { weightedConfig } from "@/lib/valuation/breakdown";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import {
  type FantasyStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";
import { rollingWindowLines, type DatedLog } from "@/lib/watchlist/trend";

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
// order), measured against a pool the caller holds fixed. The trend keeps the
// last `windowGames`, and every kept game still looks back over the ten
// before it, cut or not. The player page's trend panel and the Fantasy
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
  const zConfig = weightedConfig({ config, methodWeights, method: "z" });
  const gConfig = weightedConfig({ config, methodWeights, method: "g" });
  const lineEndingAt = rollingWindowLines({
    playerId: line.playerId,
    fullName: line.fullName,
    logs,
  });
  // Only the games the trend keeps are scored, and each window is aggregated
  // once for both methods: the Fantasy tab builds fifty of these per page, and
  // scoring every game of the season twice over was most of its render.
  const kept = windowGames === null ? logs : logs.slice(-windowGames);
  const offset = logs.length - kept.length;
  return kept.map((log, position): FantasyTrendValue => {
    const index = offset + position;
    const rolling = lineEndingAt({ index });
    return {
      gameIndex: position + 1,
      gameNumber: index + 1,
      gameDate: log.gameDate.toISOString(),
      dnp: log.minutes === 0,
      z:
        rolling === null
          ? null
          : (scoreZScore({ lines: [rolling], poolStats, config: zConfig })[0]?.total ?? 0),
      g:
        rolling === null
          ? null
          : (scoreGScore({ lines: [rolling], poolStats, config: gConfig })[0]?.total ?? 0),
    };
  });
};
