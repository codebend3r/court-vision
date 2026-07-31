import { describe, expect, it } from "bun:test";

import { TEAM_BUILDER_VALUATION_CONFIG } from "@/lib/fantasyTeams/insights";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { computePoolStats } from "@/lib/valuation/pool";
import { buildRollingZSeries, ROLLING_WINDOW_GAMES, type DatedLog } from "@/lib/watchlist/zTrend";

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

// A spread-out pool so sigma is non-zero in every category; a degenerate pool
// would make every z exactly 0 and the trend assertions vacuous.
const poolStats = computePoolStats({
  lines: Array.from({ length: 20 }, (_, index) =>
    makeStatLine({ playerId: index + 100, pts: 300 + index * 30, reb: 150 + index * 10 }),
  ),
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
    expect(points.at(-1)?.z ?? 0).toBeGreaterThan(points[0]?.z ?? 0);
  });

  it("holds flat for a player who repeats the same line", () => {
    const logs = Array.from({ length: 15 }, (_, index) => log({ day: index + 1, pts: 20 }));
    const values = series({ logs }).points.map((point) => point.z);
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
    expect(series({ logs: withSpike }).points.at(-1)?.z).toBeCloseTo(
      series({ logs: withoutSpike }).points.at(-1)?.z ?? 0,
      10,
    );
  });
});
