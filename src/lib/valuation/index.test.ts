import { describe, expect, it } from "vitest";

import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { valuePlayers } from "@/lib/valuation/index";
import type { ValuationConfig } from "@/lib/valuation/types";

const line = makeStatLine;

const config = (overrides: Partial<ValuationConfig> = {}): ValuationConfig => ({
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "total",
  teams: 12,
  rosterSlots: 13,
  ...overrides,
});

describe("valuePlayers", () => {
  it("applies the 150-player pool floor so tiny leagues keep a broad pool", () => {
    const lines = [
      line({ playerId: 1, pts: 900 }),
      line({ playerId: 2, pts: 700 }),
      line({ playerId: 3, pts: 500 }),
      line({ playerId: 4, pts: 300 }),
      line({ playerId: 5, pts: 100 }),
    ];
    // teams * rosterSlots = 4, but the floor keeps all five qualifying players.
    const { poolStats } = valuePlayers({
      lines,
      config: config({ teams: 2, rosterSlots: 2 }),
      range: "all",
    });
    expect(poolStats.poolSize).toBe(5);
    expect(poolStats.byCategory.pts.mu).toBeCloseTo(500, 10);
  });

  it("scores every supplied line with every method, including non-pool players", () => {
    const lines = [
      line({ playerId: 1, pts: 900 }),
      line({ playerId: 2, pts: 700 }),
      line({ playerId: 3, pts: 500, gamesPlayed: 2, minutes: 60 }), // below thresholds
    ];
    const { values, poolStats } = valuePlayers({ lines, config: config(), range: "all" });
    expect(poolStats.poolSize).toBe(2);
    expect(values).toHaveLength(3);
    const third = values[2];
    expect(third?.playerId).toBe(3);
    expect(typeof third?.z).toBe("number");
    expect(typeof third?.g).toBe("number");
    expect(typeof third?.points).toBe("number");
    expect(typeof third?.vorp).toBe("number");
    expect(typeof third?.positional).toBe("number");
  });

  it("shifts VORP by the replacement level at teams × slots", () => {
    const lines = [1, 2, 3, 4, 5, 6].map((playerId) =>
      line({ playerId, pts: 1000 - playerId * 100 }),
    );
    // 2 teams × 2 slots → replacement is the 4th-ranked player's z.
    const { values } = valuePlayers({
      lines,
      config: config({ teams: 2, rosterSlots: 2 }),
      range: "all",
    });
    const fourth = values.find((value) => value.playerId === 4);
    expect(fourth?.vorp).toBeCloseTo(0, 10);
    const first = values.find((value) => value.playerId === 1);
    expect(first?.vorp).toBeGreaterThan(0);
  });

  it("collapses G-Score to Z-Score when within-player variance is zero", () => {
    const lines = [1, 2, 3, 4].map((playerId) => line({ playerId, pts: playerId * 100 }));
    const { values } = valuePlayers({ lines, config: config(), range: "all" });
    values.forEach((value) => {
      expect(value.g).toBeCloseTo(value.z, 10);
    });
  });
});
