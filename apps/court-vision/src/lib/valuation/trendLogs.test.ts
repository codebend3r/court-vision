import { describe, expect, it } from "bun:test";

import {
  isFantasyTrendLogsResult,
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

describe("isFantasyTrendLogsResult", () => {
  it("accepts an ok result with each player's serialized logs", () => {
    expect(
      isFantasyTrendLogsResult({
        status: "ok",
        players: [
          { playerId: 7, logs: [trendLog()] },
          { playerId: 8, logs: [] },
        ],
      }),
    ).toBe(true);
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
    expect(dated?.gameDate).toBeInstanceOf(Date);
    expect(dated?.gameDate.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(dated?.pts).toBe(30);
  });
});

describe("MAX_TREND_PLAYERS", () => {
  it("covers the largest page size", () => {
    expect(MAX_TREND_PLAYERS).toBe(100);
  });
});
