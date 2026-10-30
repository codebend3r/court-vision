import { describe, expect, it } from "bun:test";

import {
  aggregateWindowLogs,
  buildRollingSeries,
  buildYardstick,
  CATEGORY_KEYS,
  computePoolStats,
  type DatedLog,
  DEFAULT_POINTS_SCORING,
  DEFAULT_VALUATION_CONFIG,
  type FantasyStatLine,
  makeStatLine,
  rollingWindowLines,
  type ValuationConfig,
  makeDatedLog,
  type BasketballKeys,
} from "#core/testing/basketball";
import { METHOD_VALUE_KEYS } from "#core/valuation/registry";
import {
  ROLLING_WINDOW_GAMES,
  type RollingSeriesArgs,
  type TrendPoint,
  type TrendSeries,
} from "#core/valuation/rolling";
import { type MethodValueKey, type ValuationLine } from "#core/valuation/types";
import { type Yardstick } from "#core/valuation/yardstick";

type LogProps = { day: number; pts: number; minutes?: number };

const log = ({ day, pts, minutes = 32 }: LogProps): DatedLog =>
  makeDatedLog({
    gameDate: new Date(Date.UTC(2026, 0, day)),
    minutes,
    pts,
    reb: 5,
    ast: 5,
    stl: 1,
    blk: 1,
    fg3m: 2,
    tov: 2,
    fgm: 8,
    fga: 16,
    ftm: 4,
    fta: 5,
  });

// A pool spread out in every category so each sigma is honestly non-zero; a
// category with no spread divides by a float-noise sigma and produces absurd
// values. Every pool player repeats the same line each game, so within-player
// variance is 0 and G-Score coincides with Z-Score against this pool.
const poolLine = (index: number) =>
  makeStatLine({
    playerId: index + 100,
    pts: 300 + index * 30,
    reb: 150 + index * 10,
    ast: 100 + index * 8,
    stl: 30 + index * 3,
    blk: 15 + index * 2,
    fg3m: 40 + index * 5,
    tov: 60 + index * 4,
    fgm: 150 + index * 12,
    fga: 350 + index * 20,
    ftm: 80 + index * 6,
    fta: 100 + index * 7,
  });

// A yardstick over a pool's lines, on the config every test here shares
// unless it says otherwise.
type YardstickForProps = {
  lines: readonly ValuationLine<BasketballKeys>[];
  config?: ValuationConfig;
};

const yardstickFor = ({
  lines,
  config = DEFAULT_VALUATION_CONFIG,
}: YardstickForProps): Yardstick<BasketballKeys> =>
  buildYardstick({
    lines,
    poolStats: computePoolStats({ lines, basis: config.basis, poolSize: 150, windowGames: null }),
    config,
  });

const poolLines = Array.from({ length: 20 }, (_, index) => poolLine(index));
const yardstick = yardstickFor({ lines: poolLines });

type AllSeriesProps = { logs: readonly DatedLog[]; minGames?: number };

const allSeries = ({ logs, minGames }: AllSeriesProps) =>
  buildRollingSeries({
    playerId: 7,
    fullName: "Jalen Brunson",
    position: "G",
    logs,
    minGames,
    yardstick,
  });

const series = ({ logs, minGames }: AllSeriesProps) => allSeries({ logs, minGames }).z;

describe("buildRollingSeries on Z-Score", () => {
  it("emits one point per game from the first", () => {
    const logs = Array.from({ length: 12 }, (_, index) => log({ day: index + 1, pts: 20 }));
    const result = series({ logs });
    expect(result.points).toHaveLength(12);
    expect(result.points[0]?.date).toBe(Date.UTC(2026, 0, 1));
    expect(result.points.at(-1)?.date).toBe(Date.UTC(2026, 0, 12));
  });

  it("emits one point per game from the window size onward when a full window is required", () => {
    const logs = Array.from({ length: 12 }, (_, index) => log({ day: index + 1, pts: 20 }));
    const result = series({ logs, minGames: ROLLING_WINDOW_GAMES });
    expect(result.points).toHaveLength(12 - ROLLING_WINDOW_GAMES + 1);
    expect(result.points[0]?.date).toBe(Date.UTC(2026, 0, ROLLING_WINDOW_GAMES));
  });

  it("carries the player's identity through", () => {
    const result = series({
      logs: Array.from({ length: 10 }, (_, i) => log({ day: i + 1, pts: 20 })),
    });
    expect(result.playerId).toBe(7);
    expect(result.fullName).toBe("Jalen Brunson");
  });

  it("emits no points under the window size when a full window is required", () => {
    const logs = Array.from({ length: ROLLING_WINDOW_GAMES - 1 }, (_, index) =>
      log({ day: index + 1, pts: 20 }),
    );
    expect(series({ logs, minGames: ROLLING_WINDOW_GAMES }).points).toEqual([]);
  });

  it("emits no points before the first appearance", () => {
    const logs = [log({ day: 1, pts: 0, minutes: 0 }), log({ day: 2, pts: 20 })];
    expect(series({ logs }).points.map((point) => point.date)).toEqual([Date.UTC(2026, 0, 2)]);
  });

  it("rises when recent games are stronger than early ones", () => {
    const logs = [
      ...Array.from({ length: 10 }, (_, index) => log({ day: index + 1, pts: 5 })),
      ...Array.from({ length: 10 }, (_, index) => log({ day: index + 11, pts: 40 })),
    ];
    const points = series({ logs }).points;
    expect(points.at(-1)?.value ?? 0).toBeGreaterThan(points[0]?.value ?? 0);
  });

  it("holds flat for a player who repeats the same line", () => {
    const logs = Array.from({ length: 15 }, (_, index) => log({ day: index + 1, pts: 20 }));
    const values = series({ logs }).points.map((point) => point.value);
    values.forEach((value) => expect(value).toBeCloseTo(values[0] ?? 0, 10));
  });

  it("only ever looks back windowSize games", () => {
    // A single monster game leaves the window after windowSize more games, so
    // the last point must match a player who never had it.
    const withSpike = [
      log({ day: 1, pts: 80 }),
      ...Array.from({ length: 12 }, (_, index) => log({ day: index + 2, pts: 20 })),
    ];
    const withoutSpike = [
      log({ day: 1, pts: 20 }),
      ...Array.from({ length: 12 }, (_, index) => log({ day: index + 2, pts: 20 })),
    ];
    expect(series({ logs: withSpike }).points.at(-1)?.value).toBeCloseTo(
      series({ logs: withoutSpike }).points.at(-1)?.value ?? 0,
      10,
    );
  });
});

// Multiplying every per-game sum of squares leaves the season totals (and so
// the between-player spread) alone while giving each pool player real
// game-to-game variance.
const inflateSq = (sq: FantasyStatLine["sq"]): FantasyStatLine["sq"] => ({
  pts: sq.pts * 4,
  reb: sq.reb * 4,
  ast: sq.ast * 4,
  stl: sq.stl * 4,
  blk: sq.blk * 4,
  fg3m: sq.fg3m * 4,
  tov: sq.tov * 4,
  fgm: sq.fgm * 4,
  fga: sq.fga * 4,
  ftm: sq.ftm * 4,
  fta: sq.fta * 4,
});

describe("buildRollingSeries on G-Score", () => {
  const logs = Array.from({ length: 12 }, (_, index) => log({ day: index + 1, pts: 20 }));
  const args = { playerId: 7, fullName: "Jalen Brunson", position: "G", logs };

  it("matches the z-series against a pool with no game-to-game volatility", () => {
    // Constant-line pool players have zero within variance, so the G-Score
    // denominator collapses to the Z-Score one.
    const { z, g } = buildRollingSeries({ ...args, yardstick });
    expect(g.points).toHaveLength(z.points.length);
    g.points.forEach((point, index) => {
      expect(point.value).toBeCloseTo(z.points[index]?.value ?? Number.NaN, 10);
    });
  });

  it("diverges from the z-series once the pool swings game to game", () => {
    const volatile = yardstickFor({
      lines: poolLines.map((line) => ({ ...line, sq: inflateSq(line.sq) })),
    });
    const { z, g } = buildRollingSeries({ ...args, yardstick: volatile });
    expect(g.points.at(-1)?.value).not.toBeCloseTo(z.points.at(-1)?.value ?? Number.NaN, 5);
  });

  it("scores a player under the window size over the games so far", () => {
    const short = logs.slice(0, ROLLING_WINDOW_GAMES - 1);
    expect(buildRollingSeries({ ...args, yardstick, logs: short }).g.points).toHaveLength(
      ROLLING_WINDOW_GAMES - 1,
    );
  });
});

describe("buildRollingSeries on every method", () => {
  const logs = Array.from({ length: 12 }, (_, index) =>
    log({ day: index + 1, pts: 10 + index * 3 }),
  );
  const result = allSeries({ logs });

  it("returns a series for each of the seven methods", () => {
    expect(Object.keys(result).toSorted()).toEqual([...METHOD_VALUE_KEYS].toSorted());
  });

  it("plots every method on the same dates for the same player", () => {
    const dates = result.z.points.map((point) => point.date);
    METHOD_VALUE_KEYS.forEach((key) => {
      expect(result[key].playerId).toBe(7);
      expect(result[key].fullName).toBe("Jalen Brunson");
      expect(result[key].points.map((point) => point.date)).toEqual(dates);
    });
  });
});

// The slice-and-score-every-window implementation the shared window lines
// replaced: each window aggregated on its own, given the player's position,
// and valued through the yardstick, one method at a time. It aggregates
// through the current aggregateWindowLogs, which its own test holds to the
// previous aggregator's exact output.

// The rolling window line carries only what the scorers read: who, and no
// position (the series lends the player's own).
type IdentityProps = { playerId: number };

const identity = ({ playerId }: IdentityProps) => ({ playerId, position: null });

type ReferenceRollingSeriesProps = Omit<RollingSeriesArgs<BasketballKeys>, "sport"> & {
  method: MethodValueKey;
};

const referenceRollingSeries = ({
  playerId,
  fullName,
  position,
  logs,
  yardstick: scale,
  method,
  windowSize = ROLLING_WINDOW_GAMES,
}: ReferenceRollingSeriesProps): TrendSeries => {
  const points = logs.reduce<TrendPoint[]>((acc, log, index) => {
    // Every game so far until the window fills, once the player has played.
    const window = logs.slice(Math.max(0, index + 1 - windowSize), index + 1);
    if (window.length < windowSize && !window.some((game) => game.playingTime > 0)) return acc;
    const line = { playerId, position, ...aggregateWindowLogs({ logs: window }) };
    const [value] = scale.value({ lines: [line] });
    return [...acc, { date: log.gameDate.getTime(), value: value?.[method] ?? 0 }];
  }, []);
  return { playerId, fullName, points };
};

// Deterministic PRNG (mulberry32) for the seeded seasons below.
type SeededProps = { seed: number };

const seeded = ({ seed }: SeededProps) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// A season of box scores with a DNP every so often and the odd game without
// a free throw, from one seed.
type SeededSeasonProps = { seed: number; length: number };

const seededSeason = ({ seed, length }: SeededSeasonProps): DatedLog[] => {
  const random = seeded({ seed });
  const between = (low: number, high: number): number =>
    Math.floor(low + random() * (high - low + 1));
  return Array.from({ length }, (_, index): DatedLog => {
    const played = random() > 0.08;
    const fga = played ? between(2, 28) : 0;
    const fta = played ? between(0, 12) : 0;
    return makeDatedLog({
      gameDate: new Date(Date.UTC(2025, 9, 21 + index)),
      minutes: played ? between(8, 42) : 0,
      pts: played ? between(0, 50) : 0,
      reb: played ? between(0, 18) : 0,
      ast: played ? between(0, 14) : 0,
      stl: played ? between(0, 4) : 0,
      blk: played ? between(0, 5) : 0,
      fg3m: played ? between(0, 8) : 0,
      tov: played ? between(0, 7) : 0,
      fga,
      fgm: Math.floor(fga * random()),
      fta,
      ftm: Math.floor(fta * random()),
    });
  });
};

// Pool lines aggregated from seeded seasons carry real game-to-game variance,
// so G-Score's within term is live rather than collapsing onto Z-Score.
// Positions cycle so Positional VORP has a replacement level in every group.
const SEEDED_POSITIONS = ["G", "F", "C", "G-F", "F-C"];

const seededPoolLines = Array.from({ length: 160 }, (_, index) => ({
  playerId: index + 1000,
  position: SEEDED_POSITIONS[index % SEEDED_POSITIONS.length] ?? null,
  ...aggregateWindowLogs({ logs: seededSeason({ seed: index + 1, length: 60 }) }),
}));

const allCategories: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: { pts: 1.5, tov: 0, ft: 0.5 },
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: DEFAULT_POINTS_SCORING,
};

describe("rolling series against the per-window reference", () => {
  const seededYardstick = yardstickFor({ lines: seededPoolLines, config: allCategories });
  const shapes: { length: number; windowSize?: number }[] = [
    { length: 0 },
    { length: ROLLING_WINDOW_GAMES - 1 },
    { length: ROLLING_WINDOW_GAMES },
    { length: 82 },
    { length: 30, windowSize: 5 },
    { length: 30, windowSize: 1 },
  ];

  shapes.forEach(({ length, windowSize }) => {
    it(`matches exactly on every method over ${length} games (window ${windowSize ?? "default"})`, () => {
      const args = {
        playerId: 7,
        fullName: "Shai Gilgeous-Alexander",
        position: "F-C",
        logs: seededSeason({ seed: 0xbeef + length, length }),
        yardstick: seededYardstick,
        windowSize,
      };
      const result = buildRollingSeries(args);
      METHOD_VALUE_KEYS.forEach((method) => {
        expect(result[method]).toStrictEqual(referenceRollingSeries({ ...args, method }));
      });
    });
  });
});

describe("rollingWindowLines", () => {
  const logs = seededSeason({ seed: 42, length: 15 });
  const lineEndingAt = rollingWindowLines({ playerId: 7, logs });

  it("has no line until the window fills when a full window is required", () => {
    const full = rollingWindowLines({ playerId: 7, logs, minGames: ROLLING_WINDOW_GAMES });
    expect(full({ index: ROLLING_WINDOW_GAMES - 2 })).toBeNull();
  });

  it("aggregates every game so far before the window fills", () => {
    expect(lineEndingAt({ index: 3 })).toEqual({
      ...identity({ playerId: 7 }),
      ...aggregateWindowLogs({ logs: logs.slice(0, 4) }),
    });
  });

  it("collapses the game and the nine before it under the player's id", () => {
    expect(lineEndingAt({ index: 12 })).toEqual({
      ...identity({ playerId: 7 }),
      ...aggregateWindowLogs({ logs: logs.slice(3, 13) }),
    });
  });
});
