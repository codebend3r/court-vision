import { describe, expect, it } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING, scorePoints } from "@/lib/valuation/methods/points";

describe("scorePoints", () => {
  const line = makeStatLine({
    playerId: 1,
    gamesPlayed: 10,
    pts: 200,
    reb: 100,
    ast: 50,
    stl: 10,
    blk: 5,
    tov: 20,
  });
  // 200·1 + 100·1.2 + 50·1.5 + 10·3 + 5·3 − 20·1 = 420
  const expectedTotal = 420;

  it("prices the stat line with the default scoring table", () => {
    const [value] = scorePoints({ lines: [line], basis: "total" });
    expect(value?.total).toBeCloseTo(expectedTotal, 10);
  });

  it("divides by games under the perGame basis", () => {
    const [value] = scorePoints({ lines: [line], basis: "perGame" });
    expect(value?.total).toBeCloseTo(expectedTotal / 10, 10);
  });

  it("returns 0 per game for players with no appearances", () => {
    const dnp = makeStatLine({ playerId: 2, gamesPlayed: 0 });
    const [value] = scorePoints({ lines: [dnp], basis: "perGame" });
    expect(value?.total).toBe(0);
  });

  it("penalizes turnovers", () => {
    expect(DEFAULT_POINTS_SCORING.tov).toBeLessThan(0);
  });

  it("honours a league's own scoring table", () => {
    // A league that pays 3 per rebound and nothing else.
    const [value] = scorePoints({
      lines: [line],
      basis: "total",
      scoring: { pts: 0, reb: 3, ast: 0, stl: 0, blk: 0, fg3m: 0, tov: 0 },
    });
    expect(value?.total).toBeCloseTo(300, 10);
  });

  it("lets a league pay for threes, which the default table does not", () => {
    const threes = makeStatLine({ playerId: 3, gamesPlayed: 10, fg3m: 30 });
    const [base] = scorePoints({ lines: [threes], basis: "total" });
    const [paid] = scorePoints({
      lines: [threes],
      basis: "total",
      scoring: { ...DEFAULT_POINTS_SCORING, fg3m: 2 },
    });
    expect((paid?.total ?? 0) - (base?.total ?? 0)).toBeCloseTo(60, 10);
  });
});
