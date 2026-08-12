import { describe, expect, it } from "bun:test";

import { formatLeagueMeta } from "@/lib/leagues/format";
import { type LeagueSummary } from "@/lib/leagues/types";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { type Category } from "@/lib/valuation/types";

const NINE: Category[] = ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"];

const league = (overrides: Partial<LeagueSummary>): LeagueSummary => ({
  id: "l1",
  name: "Test league",
  slug: "test-league",
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: NINE },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("formatLeagueMeta", () => {
  it("describes an h2h categories league by its category count", () => {
    expect(formatLeagueMeta({ league: league({}) })).toBe("12-team · 9-cat");
  });

  it("counts the league's own categories, not a fixed nine", () => {
    expect(
      formatLeagueMeta({
        league: league({ teamCount: 10, scoringConfig: { categories: NINE.slice(0, 8) } }),
      }),
    ).toBe("10-team · 8-cat");
  });

  it("marks roto leagues", () => {
    expect(
      formatLeagueMeta({
        league: league({ scoringType: "roto", scoringConfig: { categories: NINE } }),
      }),
    ).toBe("12-team · 9-cat roto");
  });

  it("describes points leagues as points", () => {
    expect(
      formatLeagueMeta({
        league: league({
          scoringType: "h2h_points",
          scoringConfig: { scoring: { ...DEFAULT_POINTS_SCORING } },
        }),
      }),
    ).toBe("12-team · points");
  });
});
