import { describe, expect, it } from "bun:test";

import {
  aggregateWindowLogs,
  buildFantasyTrend,
  buildRollingGSeries,
  buildRollingZSeries,
  CATEGORY_KEYS,
  computePoolStats,
  type DatedLog,
  DEFAULT_POINTS_SCORING,
  type FantasyStatLine,
  makeStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  makeDatedLog,
} from "#core/testing/basketball";
import { weightedConfig } from "#core/valuation/breakdown";
import { DEFAULT_TREND_GAMES, type FantasyTrendValue } from "#core/valuation/trend";
import { ROLLING_WINDOW_GAMES } from "#core/valuation/rolling";

const log = ({
  day,
  pts = 30,
  minutes = 34,
}: {
  day: number;
  pts?: number;
  minutes?: number;
}): DatedLog =>
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

const build = ({ logs, windowGames = null }: { logs: DatedLog[]; windowGames?: number | null }) =>
  buildFantasyTrend({ line: star, logs, poolStats, config, methodWeights: {}, windowGames });

describe("buildFantasyTrend", () => {
  it("leaves the games before the window fills null and scores every game after", () => {
    const trend = build({
      logs: Array.from({ length: 12 }, (_, index) => log({ day: index + 1 })),
    });

    expect(trend).toHaveLength(12);
    const lead = trend.slice(0, ROLLING_WINDOW_GAMES - 1);
    expect(lead.every((point) => point.z === null && point.g === null)).toBe(true);
    expect(typeof trend[ROLLING_WINDOW_GAMES - 1]?.z).toBe("number");
    expect(typeof trend[11]?.g).toBe("number");
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
});

// The score-the-whole-season-then-cut implementation, kept verbatim so the
// windowed one is held to exactly its output. Its series builders are the
// current ones, which their own test holds to the previous per-window output.
const referenceBuildFantasyTrend = ({
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
  const lead = ROLLING_WINDOW_GAMES - 1;
  const scored = logs.map((log, index): FantasyTrendValue => ({
    gameIndex: index + 1,
    gameNumber: index + 1,
    gameDate: log.gameDate.toISOString(),
    dnp: log.playingTime === 0,
    z: index < lead ? null : (zPoints[index - lead]?.value ?? null),
    g: index < lead ? null : (gPoints[index - lead]?.value ?? null),
  }));
  const windowed = windowGames === null ? scored : scored.slice(-windowGames);
  return windowed.map((point, index) => ({ ...point, gameIndex: index + 1 }));
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

const seededSeason = ({ seed, length }: { seed: number; length: number }): DatedLog[] => {
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
  const volatilePoolStats = computePoolStats({
    lines: Array.from({ length: 160 }, (_, index) =>
      makeStatLine({
        playerId: index + 1000,
        ...aggregateWindowLogs({ logs: seededSeason({ seed: index + 1, length: 60 }) }),
      }),
    ),
    basis: "perGame",
    poolSize: 150,
    windowGames: null,
  });
  const methodWeights: MethodWeights = { z: { pts: 2, tov: 0 }, g: { fg: 0.5, blk: 3 } };
  // One season length scores on totals, so the basis reaches the window lines.
  const totalsConfig: ValuationConfig = { ...config, basis: "total" };
  // `0` is slice(-0), the whole season, which a naive suffix length gets wrong.
  const windows: (number | null)[] = [null, 0, 1, 5, DEFAULT_TREND_GAMES, 100];
  const lengths = [0, 5, ROLLING_WINDOW_GAMES - 1, ROLLING_WINDOW_GAMES, 30, 82];

  lengths.forEach((length) => {
    windows.forEach((windowGames) => {
      it(`matches exactly over ${length} games, window ${windowGames ?? "all"}`, () => {
        const args = {
          line: { playerId: 7, fullName: "Nikola Jokic" },
          logs: seededSeason({ seed: 0x7e4d + length, length }),
          poolStats: volatilePoolStats,
          config: length === 30 ? totalsConfig : config,
          methodWeights,
          windowGames,
        };
        expect(buildFantasyTrend(args)).toStrictEqual(referenceBuildFantasyTrend(args));
      });
    });
  });
});
