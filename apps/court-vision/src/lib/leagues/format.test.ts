import { describe, expect, it } from "bun:test";

import { formatLeagueMeta } from "@/lib/leagues/format";
import { type LeagueSummary } from "@/lib/leagues/types";
import { DEFAULT_POINTS_SCORING } from "@vision/sport-basketball/engine";
import { type Category } from "@vision/sport-basketball/types";

const NINE: Category[] = ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"];

type MetaLeague = Pick<LeagueSummary, "teamCount" | "scoringType" | "scoringConfig">;

const league = (overrides: Partial<MetaLeague>): MetaLeague => ({
  scoringType: "h2h_categories",
  teamCount: 12,
  scoringConfig: { categories: NINE },
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
