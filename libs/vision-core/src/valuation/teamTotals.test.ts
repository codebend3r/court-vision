import { describe, expect, it } from "bun:test";

import { basketballFixture, type BasketballKeys } from "#core/testing/basketballDescriptor";
import { makeLine } from "#core/testing/lines";
import { teamCategoryTotals } from "#core/valuation/teamTotals";

type LineProps = {
  playerId: number;
  gamesPlayed: number;
  stats: Partial<Record<BasketballKeys["valued"], number>>;
};

const line = ({ playerId, gamesPlayed, stats }: LineProps) =>
  makeLine({
    sport: basketballFixture,
    playerId,
    position: null,
    gamesPlayed,
    playingTime: gamesPlayed * 30,
    stats,
  });

type ValueOfProps = {
  totals: ReturnType<typeof teamCategoryTotals<BasketballKeys>>;
  key: string;
};

const valueOf = ({ totals, key }: ValueOfProps) => totals.find((total) => total.key === key)?.value;

describe("teamCategoryTotals", () => {
  it("sums per-game counting stats across the roster", () => {
    const totals = teamCategoryTotals({
      sport: basketballFixture,
      lines: [
        line({ playerId: 1, gamesPlayed: 2, stats: { pts: 10 } }),
        line({ playerId: 2, gamesPlayed: 3, stats: { pts: 30 } }),
      ],
    });
    expect(valueOf({ totals, key: "pts" })).toBe(15);
  });

  it("recomputes ratio categories from summed makes and attempts", () => {
    const totals = teamCategoryTotals({
      sport: basketballFixture,
      lines: [
        line({ playerId: 1, gamesPlayed: 1, stats: { fgm: 5, fga: 10 } }),
        line({ playerId: 2, gamesPlayed: 2, stats: { fgm: 2, fga: 10 } }),
      ],
    });
    expect(valueOf({ totals, key: "fg" })).toBeCloseTo(0.4, 10);
  });

  it("reports zero, not NaN, with no attempts", () => {
    const noAttempts = teamCategoryTotals({
      sport: basketballFixture,
      lines: [line({ playerId: 1, gamesPlayed: 4, stats: { pts: 20, fga: 0, fta: 0 } })],
    });
    expect(valueOf({ totals: noAttempts, key: "fg" })).toBe(0);
    expect(valueOf({ totals: noAttempts, key: "ft" })).toBe(0);

    const empty = teamCategoryTotals({ sport: basketballFixture, lines: [] });
    expect(empty.map((total) => total.value)).toEqual(empty.map(() => 0));
  });

  it("skips lines with no games", () => {
    const totals = teamCategoryTotals({
      sport: basketballFixture,
      lines: [
        line({ playerId: 1, gamesPlayed: 2, stats: { pts: 10, fgm: 4, fga: 8 } }),
        line({ playerId: 2, gamesPlayed: 0, stats: { pts: 99, fgm: 1, fga: 50 } }),
      ],
    });
    expect(valueOf({ totals, key: "pts" })).toBe(5);
    expect(valueOf({ totals, key: "fg" })).toBe(0.5);
  });

  it("carries each category's direction", () => {
    const totals = teamCategoryTotals({ sport: basketballFixture, lines: [] });
    expect(totals.map((total) => total.key)).toEqual([...basketballFixture.categoryOrder]);
    expect(totals.find((total) => total.key === "tov")?.direction).toBe("lower");
    expect(totals.find((total) => total.key === "pts")?.direction).toBe("higher");
  });
});
