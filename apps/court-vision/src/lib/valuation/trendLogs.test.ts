import { describe, expect, it } from "bun:test";

import { buildLeagueAverageLines } from "@vision/sport-basketball/engine";

import {
  isFantasyTrendLogsResult,
  isLeagueAverageLine,
  MAX_TREND_PLAYERS,
  toDatedLogs,
  type FantasyTrendLog,
} from "@/lib/valuation/trendLogs";

const trendLog = (overrides: Partial<FantasyTrendLog> = {}): FantasyTrendLog => ({
  gameDate: "2026-01-05T00:00:00.000Z",
  minutes: 34,
  pts: 30,
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
  ...overrides,
});

// A real league-average line, as the server builds it.
const [averageLine] = buildLeagueAverageLines({
  players: [{ playerId: 7, logs: toDatedLogs({ logs: [trendLog()] }) }],
});

describe("isLeagueAverageLine", () => {
  it("accepts a dated average line", () => {
    expect(isLeagueAverageLine(averageLine)).toBe(true);
  });

  it("rejects a line missing a stat, a ratio cross term or its date", () => {
    if (averageLine === undefined) throw new Error("fixture built no line");
    const { pts: _pts, ...stats } = averageLine.line.stats;
    expect(isLeagueAverageLine({ ...averageLine, line: { ...averageLine.line, stats } })).toBe(
      false,
    );
    expect(
      isLeagueAverageLine({ ...averageLine, line: { ...averageLine.line, cross: { fg: 1 } } }),
    ).toBe(false);
    expect(isLeagueAverageLine({ line: averageLine.line })).toBe(false);
    expect(isLeagueAverageLine(null)).toBe(false);
  });
});

describe("isFantasyTrendLogsResult", () => {
  it("accepts an ok result with each player's serialized logs and the league averages", () => {
    expect(
      isFantasyTrendLogsResult({
        status: "ok",
        players: [
          { playerId: 7, logs: [trendLog()] },
          { playerId: 8, logs: [] },
        ],
        averageLines: [averageLine],
      }),
    ).toBe(true);
  });

  it("rejects an ok result without its league averages", () => {
    expect(isFantasyTrendLogsResult({ status: "ok", players: [] })).toBe(false);
    expect(
      isFantasyTrendLogsResult({ status: "ok", players: [], averageLines: [{ date: 1 }] }),
    ).toBe(false);
  });

  it("accepts the error result", () => {
    expect(isFantasyTrendLogsResult({ status: "error" })).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isFantasyTrendLogsResult(null)).toBe(false);
    expect(isFantasyTrendLogsResult({ status: "ok" })).toBe(false);
    expect(isFantasyTrendLogsResult({ status: "ok", players: [{ playerId: "7", logs: [] }] })).toBe(
      false,
    );
    expect(
      isFantasyTrendLogsResult({
        status: "ok",
        players: [{ playerId: 7, logs: [{ ...trendLog(), pts: "30" }] }],
      }),
    ).toBe(false);
    expect(
      isFantasyTrendLogsResult({ status: "ok", players: [{ playerId: 7, logs: [{ pts: 30 }] }] }),
    ).toBe(false);
  });
});

describe("toDatedLogs", () => {
  it("revives the serialized game dates", () => {
    const [dated] = toDatedLogs({ logs: [trendLog()] });
    expect(dated?.gameDate ?? null).toBeInstanceOf(Date);
    expect(dated?.gameDate.toISOString() ?? null).toBe("2026-01-05T00:00:00.000Z");
    expect(dated?.stats.pts ?? null).toBe(30);
  });
});

describe("MAX_TREND_PLAYERS", () => {
  it("covers the largest page size", () => {
    expect(MAX_TREND_PLAYERS).toBe(100);
  });
});
