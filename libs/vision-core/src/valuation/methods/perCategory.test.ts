import { describe, expect, it } from "bun:test";

import { basketballFixture, makeStatLine } from "#core/testing/basketball";
import { scorePerCategory } from "#core/valuation/methods/perCategory";

const line = makeStatLine({ playerId: 7, gamesPlayed: 10, pts: 200, reb: 50 });

const score = ({ weights }: { weights: { pts?: number; reb?: number } }) =>
  scorePerCategory({
    sport: basketballFixture,
    lines: [line],
    poolStats: { leagueRate: { fg: 0, ft: 0 } },
    config: { categories: ["pts", "reb"], weights, basis: "perGame" },
    // The per-game value itself, so the arithmetic is easy to follow.
    raw: ({ value }) => value,
  });

describe("scorePerCategory", () => {
  it("scores each included category and nothing else", () => {
    const [value] = score({ weights: {} });
    expect(value?.playerId).toBe(7);
    expect(Object.keys(value?.breakdown ?? {})).toEqual(["pts", "reb"]);
    expect(value?.breakdown.pts).toEqual({ raw: 20, weighted: 20 });
  });

  it("scales the contribution by the weight but leaves the raw score alone", () => {
    const [value] = score({ weights: { pts: 0, reb: 2 } });
    expect(value?.breakdown.pts).toEqual({ raw: 20, weighted: 0 });
    expect(value?.breakdown.reb).toEqual({ raw: 5, weighted: 10 });
  });

  it("totals the weighted contributions", () => {
    const [value] = score({ weights: { reb: 2 } });
    expect(value?.total).toBe(30);
  });
});
