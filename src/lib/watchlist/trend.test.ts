import { describe, expect, it } from "bun:test";

import { TEAM_BUILDER_VALUATION_CONFIG } from "@/lib/fantasyTeams/insights";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { computePoolStats } from "@/lib/valuation/pool";
import { type FantasyStatLine } from "@/lib/valuation/types";
import {
  buildRollingGSeries,
  buildRollingZSeries,
  ROLLING_WINDOW_GAMES,
  type DatedLog,
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
