import { describe, expect, it } from "bun:test";

import { TEAM_BUILDER_VALUATION_CONFIG } from "@/lib/fantasyTeams/insights";
import { aggregateWindowLogs } from "@/lib/valuation/aggregate";
import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { scoreGScore } from "@/lib/valuation/methods/gscore";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { computePoolStats } from "@/lib/valuation/pool";
import {
  type FantasyStatLine,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";
import {
  buildRollingGSeries,
  buildRollingZSeries,
  ROLLING_WINDOW_GAMES,
  rollingWindowLines,
  type DatedLog,
  type RollingSeriesArgs,
  type TrendPoint,
  type TrendSeries,
} from "@/lib/watchlist/trend";

const log = ({ day, pts }: { day: number; pts: number }): DatedLog => ({
  gameDate: new Date(Date.UTC(2026, 0, day)),
  minutes: 32,
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

const poolStats = computePoolStats({
  lines: Array.from({ length: 20 }, (_, index) => poolLine(index)),
  basis: TEAM_BUILDER_VALUATION_CONFIG.basis,
  poolSize: 150,
  range: "all",
});

const series = ({ logs }: { logs: readonly DatedLog[] }) =>
  buildRollingZSeries({
    playerId: 7,
    fullName: "Jalen Brunson",
    logs,
    poolStats,
    config: TEAM_BUILDER_VALUATION_CONFIG,
  });

describe("buildRollingZSeries", () => {
  it("emits one point per game from the window size onward", () => {
    const logs = Array.from({ length: 12 }, (_, index) => log({ day: index + 1, pts: 20 }));
    const result = series({ logs });
    expect(result.points).toHaveLength(12 - ROLLING_WINDOW_GAMES + 1);
    expect(result.points[0]?.date).toBe(Date.UTC(2026, 0, ROLLING_WINDOW_GAMES));
    expect(result.points.at(-1)?.date).toBe(Date.UTC(2026, 0, 12));
  });

  it("carries the player's identity through", () => {
    const result = series({
      logs: Array.from({ length: 10 }, (_, i) => log({ day: i + 1, pts: 20 })),
    });
    expect(result.playerId).toBe(7);
    expect(result.fullName).toBe("Jalen Brunson");
  });

  it("emits no points for a player under the window size", () => {
    const logs = Array.from({ length: ROLLING_WINDOW_GAMES - 1 }, (_, index) =>
      log({ day: index + 1, pts: 20 }),
    );
    expect(series({ logs }).points).toEqual([]);
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

describe("buildRollingGSeries", () => {
  const logs = Array.from({ length: 12 }, (_, index) => log({ day: index + 1, pts: 20 }));
  const args = {
    playerId: 7,
    fullName: "Jalen Brunson",
    logs,
    config: TEAM_BUILDER_VALUATION_CONFIG,
  };

  it("matches the z-series against a pool with no game-to-game volatility", () => {
    // Constant-line pool players have zero within variance, so the G-Score
    // denominator collapses to the Z-Score one.
    const gPoints = buildRollingGSeries({ ...args, poolStats }).points;
    const zPoints = buildRollingZSeries({ ...args, poolStats }).points;
    expect(gPoints).toHaveLength(zPoints.length);
    gPoints.forEach((point, index) => {
      expect(point.value).toBeCloseTo(zPoints[index]?.value ?? Number.NaN, 10);
    });
  });

  it("diverges from the z-series once the pool swings game to game", () => {
    const volatileStats = computePoolStats({
      lines: Array.from({ length: 20 }, (_, index) => {
        const line = poolLine(index);
        return { ...line, sq: inflateSq(line.sq) };
      }),
      basis: TEAM_BUILDER_VALUATION_CONFIG.basis,
      poolSize: 150,
      range: "all",
    });
    const gValue = buildRollingGSeries({ ...args, poolStats: volatileStats }).points.at(-1)?.value;
    const zValue = buildRollingZSeries({ ...args, poolStats: volatileStats }).points.at(-1)?.value;
    expect(gValue).not.toBeCloseTo(zValue ?? Number.NaN, 5);
  });

  it("emits no points for a player under the window size", () => {
    expect(
      buildRollingGSeries({ ...args, poolStats, logs: logs.slice(0, ROLLING_WINDOW_GAMES - 1) })
        .points,
    ).toEqual([]);
  });
});

// The slice-and-score-every-window implementation the shared window lines
// replaced, kept verbatim so the new series are held to exactly its output.
// It aggregates through the current aggregateWindowLogs, which its own test
// holds to the previous aggregator's exact output.
type TrendScorer = (args: {
  lines: readonly FantasyStatLine[];
  poolStats: PoolStats;
  config: ValuationConfig;
}) => PlayerValue[];

const identity = ({ playerId, fullName }: { playerId: number; fullName: string }) => ({
  playerId,
  firstName: fullName.split(" ")[0] ?? fullName,
  lastName: fullName.split(" ").slice(1).join(" "),
  fullName,
  teamAbbr: null,
  position: null,
  nbaPersonId: null,
});

const referenceRollingSeries = ({
  playerId,
  fullName,
  logs,
  poolStats,
  config,
  scorer,
  windowSize = ROLLING_WINDOW_GAMES,
}: RollingSeriesArgs & { scorer: TrendScorer }): TrendSeries => {
  if (logs.length < windowSize) {
    return { playerId, fullName, points: [] };
  }
  const points = logs.reduce<TrendPoint[]>((acc, log, index) => {
    if (index + 1 < windowSize) return acc;
    const window = logs.slice(index + 1 - windowSize, index + 1);
    const line: FantasyStatLine = {
      ...identity({ playerId, fullName }),
      ...aggregateWindowLogs({ logs: window }),
    };
    const [value] = scorer({ lines: [line], poolStats, config });
    return [...acc, { date: log.gameDate.getTime(), value: value?.total ?? 0 }];
  }, []);
  return { playerId, fullName, points };
};

// Deterministic PRNG (mulberry32) for the seeded seasons below.
const seeded = ({ seed }: { seed: number }) => {
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
const seededSeason = ({ seed, length }: { seed: number; length: number }): DatedLog[] => {
  const random = seeded({ seed });
  const between = (low: number, high: number): number =>
    Math.floor(low + random() * (high - low + 1));
  return Array.from({ length }, (_, index): DatedLog => {
    const played = random() > 0.08;
    const fga = played ? between(2, 28) : 0;
    const fta = played ? between(0, 12) : 0;
    return {
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
    };
  });
};

// Pool lines aggregated from seeded seasons carry real game-to-game variance,
// so G-Score's within term is live rather than collapsing onto Z-Score.
const seededPoolStats = computePoolStats({
  lines: Array.from({ length: 160 }, (_, index) => ({
    ...identity({ playerId: index + 1000, fullName: `Pool Player ${index}` }),
    ...aggregateWindowLogs({ logs: seededSeason({ seed: index + 1, length: 60 }) }),
  })),
  basis: "perGame",
  poolSize: 150,
  range: "all",
});

const allCategories: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: { pts: 1.5, tov: 0, ft: 0.5 },
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: DEFAULT_POINTS_SCORING,
};

describe("rolling series against the per-window reference", () => {
  const seriesCases: { name: string; build: typeof buildRollingZSeries; scorer: TrendScorer }[] = [
    { name: "Z", build: buildRollingZSeries, scorer: scoreZScore },
    { name: "G", build: buildRollingGSeries, scorer: scoreGScore },
  ];
  const shapes: { length: number; windowSize?: number }[] = [
    { length: 0 },
    { length: ROLLING_WINDOW_GAMES - 1 },
    { length: ROLLING_WINDOW_GAMES },
    { length: 82 },
    { length: 30, windowSize: 5 },
    { length: 30, windowSize: 1 },
  ];

  seriesCases.forEach(({ name, build, scorer }) => {
    shapes.forEach(({ length, windowSize }) => {
      it(`${name}: matches exactly over ${length} games (window ${windowSize ?? "default"})`, () => {
        const args = {
          playerId: 7,
          fullName: "Shai Gilgeous-Alexander",
          logs: seededSeason({ seed: 0xbeef + length, length }),
          poolStats: seededPoolStats,
          config: allCategories,
          windowSize,
        };
        expect(build(args)).toStrictEqual(referenceRollingSeries({ ...args, scorer }));
      });
    });
  });
});

describe("rollingWindowLines", () => {
  const logs = seededSeason({ seed: 42, length: 15 });
  const lineEndingAt = rollingWindowLines({ playerId: 7, fullName: "Jalen Brunson", logs });

  it("has no line until the window fills", () => {
    expect(lineEndingAt({ index: ROLLING_WINDOW_GAMES - 2 })).toBeNull();
  });

  it("collapses the game and the nine before it under the player's identity", () => {
    expect(lineEndingAt({ index: 12 })).toEqual({
      ...identity({ playerId: 7, fullName: "Jalen Brunson" }),
      ...aggregateWindowLogs({ logs: logs.slice(3, 13) }),
    });
  });
});
