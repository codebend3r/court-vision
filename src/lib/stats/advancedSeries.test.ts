import { describe, expect, it } from "bun:test";

import {
  ADVANCED_MODES,
  buildAdvancedSeries,
  pickAdvancedMetrics,
  toAdvancedMode,
  type AdvancedSeriesLog,
  type AdvancedSourceLog,
} from "@/lib/stats/advancedSeries";

const boxLog = ({
  gameId,
  day,
  minutes = 34,
}: {
  gameId: string;
  day: number;
  minutes?: number;
}): AdvancedSourceLog => ({
  gameId,
  gameDate: new Date(Date.UTC(2025, 9, day)),
  matchup: `LAL vs. OPP${day}`,
  winLoss: day % 2 === 0 ? "L" : "W",
  minutes,
});

const advancedLog = ({
  gameId,
  pie,
  netRating = 5,
}: {
  gameId: string;
  pie: number | null;
  netRating?: number | null;
}): AdvancedSeriesLog => ({
  gameId,
  pie,
  pace: 100,
  assistPercentage: 0.3,
  assistRatio: 20,
  assistToTurnover: 2,
  defensiveRating: 110,
  defensiveReboundPercentage: 0.2,
  effectiveFieldGoalPercentage: 0.55,
  netRating,
  offensiveRating: 115,
  offensiveReboundPercentage: 0.02,
  reboundPercentage: 0.11,
  trueShootingPercentage: 0.6,
  turnoverRatio: 12,
  usagePercentage: 0.3,
});

describe("buildAdvancedSeries", () => {
  it("returns an empty series for no games", () => {
    expect(buildAdvancedSeries({ logs: [], advancedLogs: [], mode: "game" })).toEqual([]);
  });

  it("numbers games from the box-score log and carries each game's advanced row", () => {
    const series = buildAdvancedSeries({
      logs: [boxLog({ gameId: "g1", day: 22 }), boxLog({ gameId: "g2", day: 24 })],
      advancedLogs: [
        advancedLog({ gameId: "g2", pie: 0.2 }),
        advancedLog({ gameId: "g1", pie: 0.1 }),
      ],
      mode: "game",
    });

    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({
      gameIndex: 1,
      gameDate: "2025-10-22T00:00:00.000Z",
      matchup: "LAL vs. OPP22",
      winLoss: "L",
      dnp: false,
      pie: 0.1,
      netRating: 5,
    });
    expect(series[1]).toMatchObject({ gameIndex: 2, pie: 0.2 });
  });

  it("leaves every metric null for a game with no advanced row and flags DNPs", () => {
    const series = buildAdvancedSeries({
      logs: [boxLog({ gameId: "g1", day: 22 }), boxLog({ gameId: "dnp", day: 24, minutes: 0 })],
      advancedLogs: [advancedLog({ gameId: "g1", pie: 0.1 })],
      mode: "game",
    });

    expect(series[1]).toMatchObject({ gameIndex: 2, dnp: true, pie: null, pace: null });
  });

  it("plots the running mean of the games that recorded each metric in avg mode", () => {
    const series = buildAdvancedSeries({
      logs: [
        boxLog({ gameId: "g1", day: 22 }),
        boxLog({ gameId: "g2", day: 24 }),
        boxLog({ gameId: "g3", day: 26 }),
      ],
      advancedLogs: [
        advancedLog({ gameId: "g1", pie: 12, netRating: 10 }),
        advancedLog({ gameId: "g2", pie: 36, netRating: null }),
        advancedLog({ gameId: "g3", pie: 24, netRating: -4 }),
      ],
      mode: "avg",
    });

    expect(series.map((point) => point.pie)).toEqual([12, 24, 24]);
    // The null game neither counts toward nor breaks the running mean.
    expect(series.map((point) => point.netRating)).toEqual([10, 10, 3]);
  });

  it("keeps the running mean null until a metric first appears", () => {
    const series = buildAdvancedSeries({
      logs: [boxLog({ gameId: "g1", day: 22 }), boxLog({ gameId: "g2", day: 24 })],
      advancedLogs: [advancedLog({ gameId: "g2", pie: 0.4 })],
      mode: "avg",
    });

    expect(series.map((point) => point.pie)).toEqual([null, 0.4]);
  });
});

describe("toAdvancedMode", () => {
  it("offers exactly the game and running-average modes", () => {
    expect(ADVANCED_MODES).toEqual(["game", "avg"]);
  });

  it("keeps game, and reads every cumulative mode as the running average", () => {
    expect(toAdvancedMode({ mode: "game" })).toBe("game");
    expect(toAdvancedMode({ mode: "avg" })).toBe("avg");
    expect(toAdvancedMode({ mode: "totals" })).toBe("avg");
    expect(toAdvancedMode({ mode: "per36" })).toBe("avg");
  });
});

describe("pickAdvancedMetrics", () => {
  it("keeps exactly the fifteen metrics of a stored row, nulls included", () => {
    const picked = pickAdvancedMetrics({
      log: {
        gameId: "g1",
        pie: 0.2,
        pace: 100,
        assistPercentage: null,
        assistRatio: 18,
        assistToTurnover: 2,
        defensiveRating: 110,
        defensiveReboundPercentage: 0.2,
        effectiveFieldGoalPercentage: 0.5,
        netRating: -3,
        offensiveRating: 107,
        offensiveReboundPercentage: 0.05,
        reboundPercentage: 0.12,
        trueShootingPercentage: 0.58,
        turnoverRatio: 10,
        usagePercentage: 0.25,
      },
    });

    expect(Object.keys(picked)).toHaveLength(15);
    expect(picked).not.toHaveProperty("gameId");
    expect(picked.netRating).toBe(-3);
    expect(picked.assistPercentage).toBeNull();
  });
});
