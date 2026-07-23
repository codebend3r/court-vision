import { describe, expect, it } from "vitest";

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
});
