import { describe, expect, it } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { computePoolStats } from "@/lib/valuation/pool";
import { buildLeague, rankByValue, teamTotalsSpread } from "@/lib/valuation/rosters";
import { type FantasyStatLine, type ValuationConfig } from "@/lib/valuation/types";

const config = (overrides: Partial<ValuationConfig> = {}): ValuationConfig => ({
  categories: ["pts"],
  weights: {},
  basis: "perGame",
  teams: 2,
  rosterSlots: 2,
  scoring: DEFAULT_POINTS_SCORING,
  ...overrides,
});

// Per-game points of 40 / 30 / 20 / 10 / 5 / 1.
const lines: FantasyStatLine[] = [40, 30, 20, 10, 5, 1].map((perGame, index) =>
  makeStatLine({ playerId: index + 1, gamesPlayed: 10, pts: perGame * 10 }),
);

const poolStats = computePoolStats({ lines, basis: "perGame", poolSize: 6, range: "all" });

describe("rankByValue", () => {
  it("orders players by their configured value, best first", () => {
    expect(
      rankByValue({ lines, poolStats, config: config() }).map((line) => line.playerId),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("buildLeague", () => {
  it("deals the rosterable players in snake order", () => {
    const { rosters } = buildLeague({ lines, poolStats, config: config() });
    // Team A takes the 1st and 4th picks (40 + 10), team B the 2nd and 3rd.
    expect(rosters).toHaveLength(2);
    expect(rosters[0]?.pts).toBeCloseTo(50, 6);
    expect(rosters[1]?.pts).toBeCloseTo(50, 6);
  });

  it("leaves undrafted players out of every roster", () => {
    const { rosters } = buildLeague({ lines, poolStats, config: config({ rosterSlots: 1 }) });
    const drafted = (rosters[0]?.pts ?? 0) + (rosters[1]?.pts ?? 0);
    expect(drafted).toBeCloseTo(70, 6); // 40 + 30 only
  });

  it("averages the waiver band just outside the rosterable pool", () => {
    // teams × slots = 4, so players 5 and 6 (5 and 1 per game) are free agents.
    const { replacement } = buildLeague({ lines, poolStats, config: config() });
    expect(replacement.pts).toBeCloseTo(3, 6);
  });

  it("falls back to the tail when every player is rosterable", () => {
    const { replacement } = buildLeague({ lines, poolStats, config: config({ rosterSlots: 3 }) });
    expect(replacement.pts).toBeCloseTo(3, 6);
  });

  it("summarizes how far apart teams finish in each category", () => {
    const { spread } = buildLeague({ lines, poolStats, config: config({ rosterSlots: 1 }) });
    expect(spread.pts?.min).toBeCloseTo(30, 6);
    expect(spread.pts?.max).toBeCloseTo(40, 6);
    expect(spread.pts?.mean).toBeCloseTo(35, 6);
  });
});

describe("teamTotalsSpread", () => {
  it("summarizes the standings spread in a category", () => {
    expect(teamTotalsSpread({ rosters: [{ pts: 10 }, { pts: 20 }], category: "pts" })).toEqual({
      min: 10,
      max: 20,
      mean: 15,
      sd: 5,
    });
  });

  it("treats a missing category as zero", () => {
    expect(teamTotalsSpread({ rosters: [{}, { pts: 10 }], category: "pts" }).min).toBe(0);
  });
});
