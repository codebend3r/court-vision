import { describe, expect, it } from "bun:test";

import { buildRunningSeries, type RunningMode } from "#core/series/running";

type Log = {
  gameDate: Date;
  matchup: string;
  winLoss: string | null;
  toi: number;
  goals: number;
  saves: number;
  shots: number;
};

const log = ({
  day,
  toi,
  goals,
  saves,
  shots,
}: Omit<Log, "gameDate" | "matchup" | "winLoss"> & { day: number }): Log => ({
  gameDate: new Date(Date.UTC(2026, 0, day)),
  matchup: `G${day}`,
  winLoss: "W",
  toi,
  goals,
  saves,
  shots,
});

// Hockey-flavored on purpose: the series knows nothing about basketball.
const LOGS: Log[] = [
  log({ day: 1, toi: 20, goals: 1, saves: 9, shots: 10 }),
  log({ day: 2, toi: 0, goals: 0, saves: 0, shots: 0 }),
  log({ day: 3, toi: 10, goals: 2, saves: 18, shots: 20 }),
];

const series = (mode: RunningMode) =>
  buildRunningSeries({
    logs: LOGS,
    mode,
    playingTime: (entry) => entry.toi,
    perUnit: 60,
    counting: [{ key: "goals", value: (entry) => entry.goals }],
    ratios: [
      { key: "svPct", made: (entry) => entry.saves, attempted: (entry) => entry.shots, scale: 100 },
    ],
  });

describe("buildRunningSeries", () => {
  it("reports each game's own value in game mode", () => {
    expect(series("game").map((point) => point.counting.goals)).toEqual([1, 0, 2]);
  });

  it("keeps a running mean that a DNP still counts toward", () => {
    expect(series("avg").map((point) => point.counting.goals)).toEqual([1, 0.5, 1]);
  });

  it("keeps running totals", () => {
    expect(series("totals").map((point) => point.counting.goals)).toEqual([1, 1, 3]);
  });

  it("normalizes to the pace unit of playing time", () => {
    // 1 goal in 20 minutes → 3 per 60; 3 goals in 30 minutes → 6 per 60.
    expect(series("pace").map((point) => point.counting.goals)).toEqual([3, 3, 6]);
  });

  it("has no pace value before any playing time accrues", () => {
    const [point] = buildRunningSeries({
      logs: [log({ day: 1, toi: 0, goals: 0, saves: 0, shots: 0 })],
      mode: "pace",
      playingTime: (entry) => entry.toi,
      perUnit: 60,
      counting: [{ key: "goals", value: (entry) => entry.goals }],
      ratios: [],
    });
    expect(point?.counting.goals).toBeNull();
  });

  it("charts ratios as a ratio of sums in every mode, null until attempted", () => {
    expect(series("game").map((point) => point.ratios.svPct)).toEqual([90, 90, 90]);
    expect(
      buildRunningSeries({
        logs: [log({ day: 1, toi: 0, goals: 0, saves: 0, shots: 0 })],
        mode: "avg",
        playingTime: (entry) => entry.toi,
        perUnit: 60,
        counting: [],
        ratios: [
          {
            key: "svPct",
            made: (entry) => entry.saves,
            attempted: (entry) => entry.shots,
            scale: 100,
          },
        ],
      })[0]?.ratios.svPct,
    ).toBeNull();
  });

  it("flags DNPs and carries playing time per mode", () => {
    expect(series("game").map((point) => point.dnp)).toEqual([false, true, false]);
    expect(series("avg").map((point) => point.playingTime)).toEqual([20, 10, 10]);
    expect(series("totals").map((point) => point.playingTime)).toEqual([20, 20, 30]);
  });

  it("indexes games from 1 and keeps the log spine", () => {
    const [first] = series("game");
    expect(first?.gameIndex).toBe(1);
    expect(first?.gameDate).toBe("2026-01-01T00:00:00.000Z");
    expect(first?.matchup).toBe("G1");
  });
});
