import { describe, expect, it } from "vitest";

import { buildStatSeries, type CumulativeSourceLog } from "@/lib/stats/cumulative";

describe("buildStatSeries (avg mode)", () => {
  it("returns empty array for empty input", () => {
    expect(buildStatSeries({ logs: [], mode: "avg" })).toEqual([]);
  });

  it("builds cumulative series with two-game golden case", () => {
    const logs: CumulativeSourceLog[] = [
      {
        gameDate: new Date("2025-10-22T00:00:00Z"),
        matchup: "LAL vs BOS",
        winLoss: "W",
        minutes: 36,
        fgm: 10,
        fga: 20,
        fg3m: 2,
        fg3a: 5,
        ftm: 8,
        fta: 10,
        reb: 8,
        ast: 5,
        stl: 1,
        blk: 2,
        tov: 3,
        pts: 30,
      },
      {
        gameDate: new Date("2025-10-24T00:00:00Z"),
        matchup: "LAL @ GSW",
        winLoss: "L",
        minutes: 32,
        fgm: 5,
        fga: 10,
        fg3m: 1,
        fg3a: 3,
        ftm: 9,
        fta: 12,
        reb: 6,
        ast: 4,
        stl: 2,
        blk: 1,
        tov: 2,
        pts: 20,
      },
    ];

    const result = buildStatSeries({ logs, mode: "avg" });

    expect(result).toHaveLength(2);

    // Game 1: 30 pts, 10/20 FG, 2/5 3P, 8/10 FT, 8 reb, 5 ast, 1 stl, 2 blk, 3 tov, 36 min
    expect(result[0]).toEqual({
      gameIndex: 1,
      gameDate: "2025-10-22T00:00:00.000Z",
      matchup: "LAL vs BOS",
      winLoss: "W",
      dnp: false,
      min: 36,
      pts: 30,
      reb: 8,
      ast: 5,
      stl: 1,
      blk: 2,
      tov: 3,
      fgPct: 50, // 10/20 = 50
      fg3Pct: 40, // 2/5 = 40
      ftPct: 80, // 8/10 = 80
    });

    // Game 2: cumulative 50 pts in 68 min, cumulative 15/30 FG, 3/8 3P, 17/22 FT, 14 reb, 9 ast, 3 stl, 3 blk, 5 tov
    expect(result[1]).toEqual({
      gameIndex: 2,
      gameDate: "2025-10-24T00:00:00.000Z",
      matchup: "LAL @ GSW",
      winLoss: "L",
      dnp: false,
      min: 34, // (36 + 32) / 2
      pts: 25, // (30 + 20) / 2
      reb: 7, // (8 + 6) / 2
      ast: 4.5, // (5 + 4) / 2
      stl: 1.5, // (1 + 2) / 2
      blk: 1.5, // (2 + 1) / 2
      tov: 2.5, // (3 + 2) / 2
      fgPct: 50, // (10 + 5) / (20 + 10) = 15/30 = 50
      fg3Pct: 37.5, // (2 + 1) / (5 + 3) = 3/8 = 37.5
      ftPct: 77.27272727272727, // (8 + 9) / (10 + 12) = 17/22 ≈ 77.27
    });
  });

  it("ensures percentages are ratio-of-sums not mean-of-pcts", () => {
    // Game 1: 1 FGM / 4 FGA = 25%
    // Game 2: 9 FGM / 12 FGA = 75%
    // Ratio-of-sums: (1+9)/(4+12) = 10/16 = 62.5%
    // Mean-of-pcts: (25+75)/2 = 50%
    const logs: CumulativeSourceLog[] = [
      {
        gameDate: new Date("2025-10-22T00:00:00Z"),
        matchup: "LAL vs BOS",
        winLoss: "W",
        minutes: 10,
        fgm: 1,
        fga: 4,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pts: 2,
      },
      {
        gameDate: new Date("2025-10-24T00:00:00Z"),
        matchup: "LAL @ GSW",
        winLoss: "L",
        minutes: 10,
        fgm: 9,
        fga: 12,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pts: 18,
      },
    ];

    const result = buildStatSeries({ logs, mode: "avg" });

    expect(result[1].fgPct).toBe(62.5); // ratio-of-sums, not 50
  });

  it("returns null for field percentage when attempts are 0", () => {
    // Both games have 0 FTA, so ftPct should be null for both points
    const logs: CumulativeSourceLog[] = [
      {
        gameDate: new Date("2025-10-22T00:00:00Z"),
        matchup: "LAL vs BOS",
        winLoss: "W",
        minutes: 10,
        fgm: 5,
        fga: 10,
        fg3m: 1,
        fg3a: 2,
        ftm: 0,
        fta: 0,
        reb: 5,
        ast: 3,
        stl: 0,
        blk: 0,
        tov: 1,
        pts: 11,
      },
      {
        gameDate: new Date("2025-10-24T00:00:00Z"),
        matchup: "LAL @ GSW",
        winLoss: "L",
        minutes: 10,
        fgm: 3,
        fga: 8,
        fg3m: 0,
        fg3a: 1,
        ftm: 0,
        fta: 0,
        reb: 4,
        ast: 2,
        stl: 1,
        blk: 0,
        tov: 0,
        pts: 6,
      },
    ];

    const result = buildStatSeries({ logs, mode: "avg" });

    expect(result[0].ftPct).toBeNull();
    expect(result[1].ftPct).toBeNull();
  });

  it("uses 1-based gameIndex", () => {
    const logs: CumulativeSourceLog[] = [
      {
        gameDate: new Date("2025-10-22T00:00:00Z"),
        matchup: "LAL vs BOS",
        winLoss: "W",
        minutes: 10,
        fgm: 1,
        fga: 2,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 1,
        ast: 1,
        stl: 0,
        blk: 0,
        tov: 0,
        pts: 2,
      },
      {
        gameDate: new Date("2025-10-24T00:00:00Z"),
        matchup: "LAL @ GSW",
        winLoss: "L",
        minutes: 10,
        fgm: 1,
        fga: 2,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 1,
        ast: 1,
        stl: 0,
        blk: 0,
        tov: 0,
        pts: 2,
      },
      {
        gameDate: new Date("2025-10-26T00:00:00Z"),
        matchup: "LAL vs PHX",
        winLoss: "W",
        minutes: 10,
        fgm: 1,
        fga: 2,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 1,
        ast: 1,
        stl: 0,
        blk: 0,
        tov: 0,
        pts: 2,
      },
    ];

    const result = buildStatSeries({ logs, mode: "avg" });

    expect(result[0].gameIndex).toBe(1);
    expect(result[1].gameIndex).toBe(2);
    expect(result[2].gameIndex).toBe(3);
  });

  it("serializes gameDate as ISO string", () => {
    const logs: CumulativeSourceLog[] = [
      {
        gameDate: new Date("2025-10-22T18:30:00Z"),
        matchup: "LAL vs BOS",
        winLoss: "W",
        minutes: 10,
        fgm: 1,
        fga: 2,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 1,
        ast: 1,
        stl: 0,
        blk: 0,
        tov: 0,
        pts: 2,
      },
    ];

    const result = buildStatSeries({ logs, mode: "avg" });

    expect(result[0].gameDate).toBe("2025-10-22T18:30:00.000Z");
    expect(typeof result[0].gameDate).toBe("string");
  });

  it("carries through matchup and winLoss fields", () => {
    const logs: CumulativeSourceLog[] = [
      {
        gameDate: new Date("2025-10-22T00:00:00Z"),
        matchup: "LAL vs BOS",
        winLoss: "W",
        minutes: 10,
        fgm: 1,
        fga: 2,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 1,
        ast: 1,
        stl: 0,
        blk: 0,
        tov: 0,
        pts: 2,
      },
      {
        gameDate: new Date("2025-10-24T00:00:00Z"),
        matchup: "LAL @ GSW",
        winLoss: null,
        minutes: 10,
        fgm: 1,
        fga: 2,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 1,
        ast: 1,
        stl: 0,
        blk: 0,
        tov: 0,
        pts: 2,
      },
    ];

    const result = buildStatSeries({ logs, mode: "avg" });

    expect(result[0].matchup).toBe("LAL vs BOS");
    expect(result[0].winLoss).toBe("W");
    expect(result[1].matchup).toBe("LAL @ GSW");
    expect(result[1].winLoss).toBeNull();
  });
});

const twoGameLogs: CumulativeSourceLog[] = [
  {
    gameDate: new Date("2025-10-22T00:00:00Z"),
    matchup: "LAL vs BOS",
    winLoss: "W",
    minutes: 36,
    fgm: 10,
    fga: 20,
    fg3m: 2,
    fg3a: 5,
    ftm: 8,
    fta: 10,
    reb: 8,
    ast: 5,
    stl: 1,
    blk: 2,
    tov: 3,
    pts: 30,
  },
  {
    gameDate: new Date("2025-10-24T00:00:00Z"),
    matchup: "LAL @ GSW",
    winLoss: "L",
    minutes: 32,
    fgm: 5,
    fga: 10,
    fg3m: 1,
    fg3a: 3,
    ftm: 9,
    fta: 12,
    reb: 6,
    ast: 4,
    stl: 2,
    blk: 1,
    tov: 2,
    pts: 20,
  },
];

describe("buildStatSeries (game mode)", () => {
  it("returns the raw counting stats from each game", () => {
    const result = buildStatSeries({ logs: twoGameLogs, mode: "game" });

    expect(result[0]).toMatchObject({ min: 36, pts: 30, reb: 8, ast: 5, stl: 1, blk: 2, tov: 3 });
    expect(result[1]).toMatchObject({ min: 32, pts: 20, reb: 6, ast: 4, stl: 2, blk: 1, tov: 2 });
  });
});

describe("buildStatSeries (totals mode)", () => {
  it("accumulates running sums for counting stats", () => {
    const result = buildStatSeries({ logs: twoGameLogs, mode: "totals" });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ min: 36, pts: 30, reb: 8, ast: 5, tov: 3 });
    expect(result[1]).toMatchObject({
      min: 68, // 36 + 32
      pts: 50, // 30 + 20
      reb: 14, // 8 + 6
      ast: 9, // 5 + 4
      stl: 3, // 1 + 2
      blk: 3, // 2 + 1
      tov: 5, // 3 + 2
    });
  });

  it("keeps shooting percentages as ratio-of-sums", () => {
    const result = buildStatSeries({ logs: twoGameLogs, mode: "totals" });

    expect(result[1].fgPct).toBe(50); // 15/30
    expect(result[1].fg3Pct).toBe(37.5); // 3/8
  });
});

describe("buildStatSeries (per36 mode)", () => {
  it("scales running totals to a 36-minute pace", () => {
    const result = buildStatSeries({ logs: twoGameLogs, mode: "per36" });

    // Game 1: 30 pts in 36 min → exactly 30 per 36
    expect(result[0].pts).toBe(30);
    // Game 2: 50 pts in 68 min → 50/68*36
    expect(result[1].pts).toBeCloseTo(26.470588235294116, 10);
    expect(result[1].reb).toBeCloseTo((14 / 68) * 36, 10);
    expect(result[1].ast).toBeCloseTo((9 / 68) * 36, 10);
  });

  it("carries the running minutes total in min", () => {
    const result = buildStatSeries({ logs: twoGameLogs, mode: "per36" });

    expect(result[0].min).toBe(36);
    expect(result[1].min).toBe(68);
  });

  it("keeps shooting percentages as ratio-of-sums", () => {
    const result = buildStatSeries({ logs: twoGameLogs, mode: "per36" });

    expect(result[1].fgPct).toBe(50);
    expect(result[1].ftPct).toBeCloseTo((17 / 22) * 100, 10);
  });

  it("yields null counting stats while the minutes total is 0", () => {
    const zeroMinuteLog: CumulativeSourceLog = {
      ...twoGameLogs[0],
      minutes: 0,
    };

    const result = buildStatSeries({ logs: [zeroMinuteLog, twoGameLogs[1]], mode: "per36" });

    expect(result[0].pts).toBeNull();
    expect(result[0].reb).toBeNull();
    expect(result[0].min).toBe(0);
    expect(result[0].dnp).toBe(true);
    // Once minutes accrue, values come back: 50 pts in 32 total min
    expect(result[1].pts).toBeCloseTo((50 / 32) * 36, 10);
  });
});
