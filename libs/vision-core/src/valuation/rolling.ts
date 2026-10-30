import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { recordFromKeys } from "#core/util/record";
import { aggregateWindowLogs, type DatedLog, isAppearance } from "#core/valuation/aggregate";
import { METHOD_VALUE_KEYS } from "#core/valuation/registry";
import {
  type FantasyPlayerValues,
  type MethodValueKey,
  type ValuationLine,
} from "#core/valuation/types";
import { type Yardstick } from "#core/valuation/yardstick";

// Ten games is the shortest window that smooths a single blow-up game without
// lagging a real change in role. Before a player has ten, the window is every
// game so far: noisier, but a reading rather than a blank chart.
export const ROLLING_WINDOW_GAMES = 10;

// Every method's score, without the player id: one rolling reading.
export type MethodValues = Omit<FantasyPlayerValues, "playerId">;

export type TrendPoint = { date: number; value: number };
export type TrendSeries = { playerId: number; fullName: string; points: TrendPoint[] };

export type RollingSeriesArgs<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  playerId: number;
  fullName: string;
  // The player's listed position, for Positional VORP's replacement level.
  position: string | null;
  logs: readonly DatedLog<K>[];
  yardstick: Yardstick<K>;
  windowSize?: number;
  // Games needed before the first line. Defaults to one, so the window grows
  // from the first game up to windowSize; pass windowSize to require a full
  // window instead.
  minGames?: number;
};

// The rolling stat line ending at a game: that game and up to windowSize − 1
// before it. Null until minGames have been played, and for a still-growing
// window with no appearance in it (a season that opens on the injury list
// has nothing to score yet). Bound to one player's logs so a caller scoring a
// window more than once (Z and G) aggregates it only once.
type RollingWindowLinesProps = { index: number };

export const rollingWindowLines =
  <K extends SportKeys>({
    sport,
    playerId,
    logs,
    windowSize = ROLLING_WINDOW_GAMES,
    minGames = 1,
  }: Pick<RollingSeriesArgs<K>, "sport" | "playerId" | "logs" | "windowSize" | "minGames">) =>
  ({ index }: RollingWindowLinesProps): ValuationLine<K> | null => {
    if (index + 1 < Math.min(minGames, windowSize)) return null;
    const games = logs.slice(Math.max(0, index + 1 - windowSize), index + 1);
    if (games.length < windowSize && !games.some((log) => isAppearance(log))) return null;
    return { playerId, position: null, ...aggregateWindowLogs({ sport, logs: games }) };
  };

// Every method's score for one rolling line, against a yardstick the caller
// builds once from the season pool and holds fixed. Every rolling reading
// (the dashboard series, the Fantasy tab's and the player page's trends) is
// scored here. The window line borrows the player's position so Positional
// VORP measures it against the right replacement level.
type RollingValuesProps<K extends SportKeys> = {
  yardstick: Yardstick<K>;
  line: ValuationLine<K>;
  position: string | null;
};

export const rollingValues = <K extends SportKeys>({
  yardstick,
  line,
  position,
}: RollingValuesProps<K>): MethodValues => {
  const [scored] = yardstick.value({ lines: [{ ...line, position }] });
  return recordFromKeys({ keys: METHOD_VALUE_KEYS, value: (key) => scored?.[key] ?? 0 });
};

// One point per game from minGames onward (the first game by default), per
// method: each scores that game and up to the previous nine against a
// yardstick held fixed for the whole season. A rising line is the player
// improving, not the yardstick moving.
export const buildRollingSeries = <K extends SportKeys>({
  sport,
  playerId,
  fullName,
  position,
  logs,
  yardstick,
  windowSize = ROLLING_WINDOW_GAMES,
  minGames = 1,
}: RollingSeriesArgs<K>): Record<MethodValueKey, TrendSeries> => {
  const lineEndingAt = rollingWindowLines({ sport, playerId, logs, windowSize, minGames });
  const scored = logs.flatMap((log, index): { date: number; values: MethodValues }[] => {
    const line = lineEndingAt({ index });
    if (line === null) return [];
    return [{ date: log.gameDate.getTime(), values: rollingValues({ yardstick, line, position }) }];
  });
  return recordFromKeys({
    keys: METHOD_VALUE_KEYS,
    value: (key): TrendSeries => ({
      playerId,
      fullName,
      points: scored.map(({ date, values }) => ({ date, value: values[key] })),
    }),
  });
};
