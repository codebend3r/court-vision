import { recordFromItems } from "#core/util/record";

// game: each game's own value; avg: running mean; totals: running sum; pace:
// running sum per `perUnit` of playing time (per 36 minutes, per 60 on ice),
// null until any playing time accrues. Ratios are ratio-of-sums in every mode.
export type RunningMode = "game" | "avg" | "totals" | "pace";

// The per-game spine every running series shares.
export type RunningLog = {
  gameDate: Date;
  matchup: string;
  winLoss: string | null;
};

export type CountingSpec<L, C extends string> = { key: C; value: (log: L) => number };

// A ratio charted as scale · Σ made ÷ Σ attempted (scale 100 for a percentage).
export type RatioSpec<L, R extends string> = {
  key: R;
  made: (log: L) => number;
  attempted: (log: L) => number;
  scale: number;
};

export type RunningPoint<C extends string, R extends string> = {
  gameIndex: number;
  gameDate: string;
  matchup: string;
  winLoss: string | null;
  dnp: boolean;
  playingTime: number;
  counting: Record<C, number | null>;
  ratios: Record<R, number | null>;
};

const countingValue = ({
  current,
  total,
  gameIndex,
  timeTotal,
  mode,
  perUnit,
}: {
  current: number;
  total: number;
  gameIndex: number;
  timeTotal: number;
  mode: RunningMode;
  perUnit: number;
}): number | null => {
  if (mode === "game") return current;
  if (mode === "avg") return total / gameIndex;
  if (mode === "totals") return total;
  return timeTotal === 0 ? null : (total / timeTotal) * perUnit;
};

// Playing time itself: the game's own, the running mean, or (totals and pace,
// where a pace-normalized playing time would be the constant `perUnit`) the
// running total.
const playingTimeValue = ({
  current,
  total,
  gameIndex,
  mode,
}: {
  current: number;
  total: number;
  gameIndex: number;
  mode: RunningMode;
}): number => {
  if (mode === "game") return current;
  if (mode === "avg") return total / gameIndex;
  return total;
};

type RatioTotals = { made: number; attempted: number };

// One point per game in `logs` (date order), accumulating every spec as it
// goes. A game with no playing time is a DNP: it still advances the index and
// counts toward running means.
export const buildRunningSeries = <L extends RunningLog, C extends string, R extends string>({
  logs,
  mode,
  playingTime,
  perUnit,
  counting,
  ratios,
}: {
  logs: readonly L[];
  mode: RunningMode;
  playingTime: (log: L) => number;
  perUnit: number;
  counting: readonly CountingSpec<L, C>[];
  ratios: readonly RatioSpec<L, R>[];
}): RunningPoint<C, R>[] => {
  type Accumulator = {
    points: RunningPoint<C, R>[];
    time: number;
    counting: Record<C, number>;
    ratios: Record<R, RatioTotals>;
  };
  const initial: Accumulator = {
    points: [],
    time: 0,
    counting: recordFromItems({ items: counting, value: () => 0 }),
    ratios: recordFromItems({
      items: ratios,
      value: (): RatioTotals => ({ made: 0, attempted: 0 }),
    }),
  };
  return logs.reduce<Accumulator>((acc, log, index) => {
    const gameIndex = index + 1;
    const time = acc.time + playingTime(log);
    const countingTotals = { ...acc.counting };
    counting.forEach((spec) => {
      countingTotals[spec.key] = acc.counting[spec.key] + spec.value(log);
    });
    const ratioTotals = { ...acc.ratios };
    ratios.forEach((spec) => {
      ratioTotals[spec.key] = {
        made: acc.ratios[spec.key].made + spec.made(log),
        attempted: acc.ratios[spec.key].attempted + spec.attempted(log),
      };
    });
    const point: RunningPoint<C, R> = {
      gameIndex,
      gameDate: log.gameDate.toISOString(),
      matchup: log.matchup,
      winLoss: log.winLoss,
      dnp: playingTime(log) === 0,
      playingTime: playingTimeValue({ current: playingTime(log), total: time, gameIndex, mode }),
      counting: recordFromItems({
        items: counting,
        value: (spec) =>
          countingValue({
            current: spec.value(log),
            total: countingTotals[spec.key],
            gameIndex,
            timeTotal: time,
            mode,
            perUnit,
          }),
      }),
      ratios: recordFromItems({
        items: ratios,
        value: (spec) => {
          const { made, attempted } = ratioTotals[spec.key];
          return attempted === 0 ? null : (spec.scale * made) / attempted;
        },
      }),
    };
    // `points` is this reduce's own array, created in `initial` and only
    // returned once the season is done: appending in place keeps a season
    // linear, where spreading it into a fresh array per game was quadratic.
    acc.points.push(point);
    return { points: acc.points, time, counting: countingTotals, ratios: ratioTotals };
  }, initial).points;
};
