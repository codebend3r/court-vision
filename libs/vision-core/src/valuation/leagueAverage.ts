import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { recordFromKeys } from "#core/util/record";
import { ratioDefs } from "#core/valuation/categories";
import { type DatedLog, isAppearance } from "#core/valuation/aggregate";
import {
  type MethodValues,
  ROLLING_WINDOW_GAMES,
  rollingValues,
  rollingWindowLines,
} from "#core/valuation/rolling";
import { type ValuationLine } from "#core/valuation/types";
import { type Yardstick } from "#core/valuation/yardstick";

// The league's average rolling line on one game date.
export type DatedAverageLine<K extends SportKeys> = { date: number; line: ValuationLine<K> };

type AverageOfProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
};

// The component-wise mean of a set of window lines: an "average player"
// whose rates are the league's rates (ratio of means), on whatever basis the
// caller scores it.
const averageOf = <K extends SportKeys>({ sport, lines }: AverageOfProps<K>): ValuationLine<K> => {
  const count = lines.length;
  type MeanProps = { read: (line: ValuationLine<K>) => number };

  const mean = ({ read }: MeanProps): number =>
    count ? lines.reduce((sum, line) => sum + read(line), 0) / count : 0;
  return {
    playerId: 0,
    position: null,
    gamesPlayed: mean({ read: (line) => line.gamesPlayed }),
    playingTime: mean({ read: (line) => line.playingTime }),
    stats: recordFromKeys({
      keys: sport.valuedStats,
      value: (key) => mean({ read: (line) => line.stats[key] }),
    }),
    sq: recordFromKeys({
      keys: sport.valuedStats,
      value: (key) => mean({ read: (line) => line.sq[key] }),
    }),
    cross: recordFromKeys({
      keys: ratioDefs({ sport }).map((def) => def.key),
      value: (key) => mean({ read: (line) => line.cross[key] }),
    }),
  };
};

// The league-average rolling line for every game date in the season: on each
// date, every player who played that day contributes the rolling window
// ending with that game, and those windows are averaged into one line. A
// chart scores it with the same yardstick as a player's own line, so the
// dotted average moves day to day with the league's form, on the same scale
// and under the same settings and weights.
type BuildLeagueAverageLinesProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  players: readonly { playerId: number; logs: readonly DatedLog<K>[] }[];
  windowSize?: number;
};

export const buildLeagueAverageLines = <K extends SportKeys>({
  sport,
  players,
  windowSize = ROLLING_WINDOW_GAMES,
}: BuildLeagueAverageLinesProps<K>): DatedAverageLine<K>[] => {
  const windowsByDate = players.reduce((byDate, { playerId, logs }) => {
    const lineEndingAt = rollingWindowLines({ sport, playerId, logs, windowSize });
    return logs.reduce((acc, log, index) => {
      if (!isAppearance(log)) return acc;
      const line = lineEndingAt({ index });
      if (line === null) return acc;
      const date = log.gameDate.getTime();
      return acc.set(date, [...(acc.get(date) ?? []), line]);
    }, byDate);
  }, new Map<number, ValuationLine<K>[]>());
  return [...windowsByDate]
    .toSorted(([a], [b]) => a - b)
    .map(([date, lines]) => ({ date, line: averageOf({ sport, lines }) }));
};

// Every method's league average on one game date.
export type DatedMethodValues = { date: number; values: MethodValues };

// The average lines scored on every method against the caller's yardstick:
// the season pool and the reader's settings and weights, exactly as the
// player's own rolling line is scored, so the two share one scale.
type ScoreAverageLinesProps<K extends SportKeys> = {
  yardstick: Yardstick<K>;
  lines: readonly DatedAverageLine<K>[];
};

export const scoreAverageLines = <K extends SportKeys>({
  yardstick,
  lines,
}: ScoreAverageLinesProps<K>): DatedMethodValues[] =>
  lines.map(({ date, line }) => ({
    date,
    values: rollingValues({ yardstick, line, position: null }),
  }));
