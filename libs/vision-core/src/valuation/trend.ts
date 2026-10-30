import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { isAppearance, type DatedLog } from "#core/valuation/aggregate";
import { recordFromKeys } from "#core/util/record";
import { METHOD_VALUE_KEYS } from "#core/valuation/registry";
import { rollingValues, rollingWindowLines } from "#core/valuation/rolling";
import { type MethodValueKey } from "#core/valuation/types";
import { type Yardstick } from "#core/valuation/yardstick";

// The Fantasy tab's rolling charts show recent form. With no Games window
// chosen they cover each player's last 20 games, so anyone with 29 or more
// games has a full ten-game lookback at every plotted point.
export const DEFAULT_TREND_GAMES = 20;

// Rolling value per game on every method: null before the player's first
// appearance, so a chart draws nothing rather than a stub. `gameIndex` is the
// position within the plotted window (the player page's axis); `gameNumber`
// is the game's place in the player's season, whatever window is cut.
export type FantasyTrendValue = {
  gameIndex: number;
  gameNumber: number;
  gameDate: string;
  dnp: boolean;
} & { [M in MethodValueKey]: number | null };

const NO_VALUES: { [M in MethodValueKey]: number | null } = recordFromKeys({
  keys: METHOD_VALUE_KEYS,
  value: (): number | null => null,
});

// One player's rolling ten-game value on every method across `logs` (their
// season in date order), measured against a yardstick the caller builds once
// from the season pool. The trend keeps the last `windowGames`, and every
// kept game still looks back over the ten before it, cut or not. The player
// page's trend panel and the Fantasy tab's rolling rows both read from here.
type BuildFantasyTrendProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  line: { playerId: number; position: string | null };
  logs: readonly DatedLog<K>[];
  yardstick: Yardstick<K>;
  windowGames: number | null;
};

export const buildFantasyTrend = <K extends SportKeys>({
  sport,
  line,
  logs,
  yardstick,
  windowGames,
}: BuildFantasyTrendProps<K>): FantasyTrendValue[] => {
  const lineEndingAt = rollingWindowLines({ sport, playerId: line.playerId, logs });
  // Only the games the trend keeps are scored, and each window is aggregated
  // once for every method: the Fantasy tab builds fifty of these per page.
  const kept = windowGames === null ? logs : logs.slice(-windowGames);
  const offset = logs.length - kept.length;
  return kept.map((log, position): FantasyTrendValue => {
    const index = offset + position;
    const rolling = lineEndingAt({ index });
    const values: { [M in MethodValueKey]: number | null } =
      rolling === null
        ? NO_VALUES
        : rollingValues({ yardstick, line: rolling, position: line.position });
    return {
      gameIndex: position + 1,
      gameNumber: index + 1,
      gameDate: log.gameDate.toISOString(),
      dnp: !isAppearance(log),
      ...values,
    };
  });
};
