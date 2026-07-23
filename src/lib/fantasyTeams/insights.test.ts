import { describe, expect, it } from "vitest";

import { buildPlayerInsights } from "@/lib/fantasyTeams/insights";
import { type FantasyStatLine, type StatKey } from "@/lib/valuation/types";

const ZERO_SQ: Record<StatKey, number> = {
  pts: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  fg3m: 0,
  tov: 0,
  fgm: 0,
  fga: 0,
  ftm: 0,
  fta: 0,
};

const line = (overrides: Partial<FantasyStatLine> & { playerId: number }): FantasyStatLine => ({
  firstName: "Test",
  lastName: `P${overrides.playerId}`,
  fullName: `Test P${overrides.playerId}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  // Clears the pool's qualification floor (>=25 GP over a full season, >=15 MPG).
  gamesPlayed: 25,
  minutes: 750,
  pts: 200,
  reb: 50,
  ast: 40,
  stl: 10,
  blk: 5,
  fg3m: 20,
  tov: 15,
  fgm: 80,
  fga: 160,
  ftm: 40,
  fta: 50,
  sq: ZERO_SQ,
  cross: { fg: 0, ft: 0 },
  ...overrides,
});

describe("buildPlayerInsights", () => {
  it("derives per-game counting stats and make-rate ratios", () => {
    const [insight] = buildPlayerInsights({ lines: [line({ playerId: 1 })] });
    const byKey = new Map(insight?.categories.map((category) => [category.key, category]));
    expect(byKey.get("pts")?.perGame).toBeCloseTo(8); // 200 / 25
    expect(byKey.get("reb")?.perGame).toBeCloseTo(2); // 50 / 25
    expect(byKey.get("fg")?.perGame).toBeCloseTo(0.5); // 80 / 160
    expect(byKey.get("ft")?.perGame).toBeCloseTo(0.8); // 40 / 50
    expect(insight?.minutesPerGame).toBeCloseTo(30); // 750 / 25
  });

  it("exposes all nine categories with their labels", () => {
    const [insight] = buildPlayerInsights({ lines: [line({ playerId: 1 })] });
    expect(insight?.categories.map((category) => category.label)).toEqual([
      "PTS",
      "REB",
      "AST",
      "STL",
      "BLK",
      "3PM",
      "TOV",
      "FG%",
      "FT%",
    ]);
  });

  it("ranks the pool by total z-score, best first", () => {
    const insights = buildPlayerInsights({
      lines: [
        line({ playerId: 1, pts: 100 }),
        line({ playerId: 2, pts: 300 }),
        line({ playerId: 3, pts: 200 }),
      ],
    });
    const byId = new Map(insights.map((insight) => [insight.playerId, insight]));
    expect(byId.get(2)?.overallRank).toBe(1);
    expect(byId.get(3)?.overallRank).toBe(2);
    expect(byId.get(1)?.overallRank).toBe(3);
    expect(byId.get(2)?.overallOf).toBe(3);
  });

  it("ranks within the player's eligible position group", () => {
    const insights = buildPlayerInsights({
      lines: [
        line({ playerId: 1, position: "G", pts: 300 }),
        line({ playerId: 2, position: "G-F", pts: 100 }),
        line({ playerId: 3, position: "C", pts: 200 }),
      ],
    });
    const byId = new Map(insights.map((insight) => [insight.playerId, insight]));
    // Two guards (ids 1 and 2); the higher-z guard ranks #1 of 2.
    expect(byId.get(1)?.positionGroup).toBe("G");
    expect(byId.get(1)?.positionRank).toBe(1);
    expect(byId.get(1)?.positionOf).toBe(2);
    // The lone center is #1 of 1.
    expect(byId.get(3)?.positionGroup).toBe("C");
    expect(byId.get(3)?.positionOf).toBe(1);
  });

  it("leaves positional fields null when the position does not parse", () => {
    const [insight] = buildPlayerInsights({ lines: [line({ playerId: 1, position: null })] });
    expect(insight?.positionGroup).toBeNull();
    expect(insight?.positionRank).toBeNull();
    expect(insight?.positionOf).toBeNull();
  });
});
