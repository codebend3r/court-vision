import { describe, expect, it } from "bun:test";

import {
  aggregateWindowLogs,
  type BasketballKeys,
  buildFantasyTrend,
  buildRollingSeries,
  buildYardstick,
  CATEGORY_KEYS,
  computePoolStats,
  type DatedLog,
  DEFAULT_POINTS_SCORING,
  type FantasyStatLine,
  makeStatLine,
  type MethodWeights,
  type ValuationConfig,
  makeDatedLog,
} from "#core/testing/basketball";
import { DEFAULT_TREND_GAMES, type FantasyTrendValue } from "#core/valuation/trend";
import { METHOD_VALUE_KEYS } from "#core/valuation/registry";
import { ROLLING_WINDOW_GAMES, type TrendPoint } from "#core/valuation/rolling";
import { type MethodValueKey, type ValuationLine } from "#core/valuation/types";
import { type Yardstick } from "#core/valuation/yardstick";

type LogProps = {
  day: number;
  pts?: number;
  minutes?: number;
};

const log = ({ day, pts = 30, minutes = 34 }: LogProps): DatedLog =>
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
    fgm: 10,
    fga: 20,
    ftm: 6,
    fta: 7,
  });

// A pool spread out in every category so each sigma is honestly non-zero.
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

const star = makeStatLine({ playerId: 7, fullName: "Luka Doncic", pts: 1500 });
const lines = [star, ...Array.from({ length: 20 }, (_, index) => poolLine(index))];
const poolStats = computePoolStats({ lines, basis: "perGame", poolSize: 150, windowGames: null });
const config: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: DEFAULT_POINTS_SCORING,
};

const yardstick = buildYardstick({ lines, poolStats, config });

type BuildProps = { logs: DatedLog[]; windowGames?: number | null };

const build = ({ logs, windowGames = null }: BuildProps) =>
  buildFantasyTrend({ line: star, logs, yardstick, windowGames });

describe("buildFantasyTrend", () => {
  it("scores every game from the first, over the games so far until the window fills", () => {
    const trend = build({
      logs: Array.from({ length: 12 }, (_, index) => log({ day: index + 1 })),
    });

    expect(trend).toHaveLength(12);
    expect(trend.every((point) => point.z !== null && point.g !== null)).toBe(true);
    expect(trend[0]?.gameIndex).toBe(1);
    expect(trend[0]?.gameDate).toBe("2026-01-01T00:00:00.000Z");
  });

  it("windows to the last N games while each still looks back over the ten before it", () => {
    const trend = build({
      logs: Array.from({ length: 15 }, (_, index) => log({ day: index + 1 })),
      windowGames: 5,
    });

    expect(trend.map((point) => point.gameIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(trend.every((point) => point.z !== null && point.g !== null)).toBe(true);
    expect(trend[0]?.gameDate).toBe("2026-01-11T00:00:00.000Z");
  });

  it("numbers each point by its game in the season, however the window is cut", () => {
    const logs = Array.from({ length: 15 }, (_, index) => log({ day: index + 1 }));

    expect(build({ logs }).map((point) => point.gameNumber)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
    const windowed = build({ logs, windowGames: 5 });
    expect(windowed.map((point) => point.gameNumber)).toEqual([11, 12, 13, 14, 15]);
    // The position within the window stays 1-based for the player page's axis.
    expect(windowed.map((point) => point.gameIndex)).toEqual([1, 2, 3, 4, 5]);
  });

  it("has no value before the first appearance", () => {
    const trend = build({ logs: [log({ day: 1, minutes: 0 }), log({ day: 2 })] });

    expect(trend.map((point) => point.z === null)).toEqual([true, false]);
  });

  it("flags zero-minute games as missed", () => {
    const trend = build({
      logs: [log({ day: 1 }), log({ day: 2 }), log({ day: 3, minutes: 0 })],
    });

    expect(trend.map((point) => point.dnp)).toEqual([false, false, true]);
  });

  it("rises when the recent window outscores the earlier one", () => {
    const logs = Array.from({ length: 20 }, (_, index) =>
      log({ day: index + 1, pts: index < 10 ? 10 : 40 }),
    );
    const trend = build({ logs });

    const early = trend[ROLLING_WINDOW_GAMES - 1]?.z ?? 0;
    const late = trend[19]?.z ?? 0;
    expect(late).toBeGreaterThan(early);
  });

  it("is empty for a player with no games", () => {
    expect(build({ logs: [] })).toEqual([]);
  });

  it("scores every method on each game once the player has played", () => {
    const trend = build({ logs: [log({ day: 1, minutes: 0 }), log({ day: 2 })] });

    METHOD_VALUE_KEYS.forEach((key) => {
      expect(trend[0]?.[key]).toBeNull();
      expect(typeof trend[1]?.[key]).toBe("number");
    });
  });
});

// The score-the-whole-season-then-cut implementation, kept verbatim so the
// windowed one is held to exactly its output. Its series builders are the
// current ones, which their own test holds to the previous per-window output.
type ReferenceBuildFantasyTrendProps = {
  line: Pick<FantasyStatLine, "playerId" | "fullName" | "position">;
  logs: readonly DatedLog[];
  yardstick: Yardstick<BasketballKeys>;
  windowGames: number | null;
};

const referenceBuildFantasyTrend = ({
  line,
  logs,
  yardstick: scale,
  windowGames,
}: ReferenceBuildFantasyTrendProps): FantasyTrendValue[] => {
  const series = buildRollingSeries({
    playerId: line.playerId,
    fullName: line.fullName,
    position: line.position,
    logs,
    yardstick: scale,
  });
  // A series skips the games it has no window for, so match points by date.
  type PointOnProps = { points: readonly TrendPoint[]; log: DatedLog };

  const pointOn = ({ points, log }: PointOnProps): number | null =>
    points.find((point) => point.date === log.gameDate.getTime())?.value ?? null;
  type ValuesOnProps = { log: DatedLog };

  const valuesOn = ({ log }: ValuesOnProps): { [M in MethodValueKey]: number | null } => ({
    z: pointOn({ points: series.z.points, log }),
    g: pointOn({ points: series.g.points, log }),
    points: pointOn({ points: series.points.points, log }),
    vorp: pointOn({ points: series.vorp.points, log }),
    positional: pointOn({ points: series.positional.points, log }),
    sgp: pointOn({ points: series.sgp.points, log }),
    sim: pointOn({ points: series.sim.points, log }),
  });
  const scored = logs.map((log, index): FantasyTrendValue => ({
    gameIndex: index + 1,
    gameNumber: index + 1,
    gameDate: log.gameDate.toISOString(),
    dnp: log.playingTime === 0,
    ...valuesOn({ log }),
  }));
  const windowed = windowGames === null ? scored : scored.slice(-windowGames);
  return windowed.map((point, index) => ({ ...point, gameIndex: index + 1 }));
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

describe("buildFantasyTrend against the whole-season reference", () => {
  // A pool with real game-to-game variance, so Z and G differ and a swap of
  // the two would show.
  const positions = ["G", "F", "C", "G-F", "F-C"];
  // Plain window lines: makeStatLine would replace the aggregated stats with
  // its flat defaults.
  const volatileLines: ValuationLine<BasketballKeys>[] = Array.from(
    { length: 160 },
    (_, index) => ({
      playerId: index + 1000,
      position: positions[index % positions.length] ?? null,
      ...aggregateWindowLogs({ logs: seededSeason({ seed: index + 1, length: 60 }) }),
    }),
  );
  const methodWeights: MethodWeights = {
    z: { pts: 2, tov: 0 },
    g: { fg: 0.5, blk: 3 },
    sgp: { reb: 2 },
    sim: { ast: 0 },
    vorp: { stl: 1.5 },
    pos: { blk: 0.5 },
  };
  type YardstickForProps = { config: ValuationConfig };

  const yardstickFor = ({ config: scoring }: YardstickForProps) =>
    buildYardstick({
      lines: volatileLines,
      poolStats: computePoolStats({
        lines: volatileLines,
        basis: scoring.basis,
        poolSize: 150,
        windowGames: null,
      }),
      config: scoring,
      methodWeights,
    });
  // One season length scores on totals, so the basis reaches the window lines.
  const perGameYardstick = yardstickFor({ config });
  const totalsYardstick = yardstickFor({ config: { ...config, basis: "total" } });
  // `0` is slice(-0), the whole season, which a naive suffix length gets wrong.
  const windows: (number | null)[] = [null, 0, 1, 5, DEFAULT_TREND_GAMES, 100];
  const lengths = [0, 5, ROLLING_WINDOW_GAMES - 1, ROLLING_WINDOW_GAMES, 30, 82];

  lengths.forEach((length) => {
    windows.forEach((windowGames) => {
      it(`matches exactly over ${length} games, window ${windowGames ?? "all"}`, () => {
        const args = {
          line: { playerId: 7, fullName: "Nikola Jokic", position: "C" },
          logs: seededSeason({ seed: 0x7e4d + length, length }),
          yardstick: length === 30 ? totalsYardstick : perGameYardstick,
          windowGames,
        };
        expect(buildFantasyTrend(args)).toStrictEqual(referenceBuildFantasyTrend(args));
      });
    });
  });
});
