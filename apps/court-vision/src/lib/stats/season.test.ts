import { describe, expect, it } from "bun:test";

import {
  BACKFILL_SEASON_YEARS,
  SEASON_LABEL,
  SEASON_OPTIONS,
  SEASON_START_YEAR,
  seasonLabel,
} from "@/lib/stats/season";

describe("seasonLabel", () => {
  it("builds the label from the season start year", () => {
    expect(seasonLabel({ startYear: 2020 })).toBe("2020-21");
    expect(seasonLabel({ startYear: 2025 })).toBe("2025-26");
  });

  it("pads a century rollover", () => {
    expect(seasonLabel({ startYear: 1999 })).toBe("1999-00");
  });

  it("derives SEASON_LABEL from SEASON_START_YEAR", () => {
    expect(SEASON_LABEL).toBe(seasonLabel({ startYear: SEASON_START_YEAR }));
  });
});

describe("BACKFILL_SEASON_YEARS", () => {
  it("spans 2016 through the current season year, oldest first", () => {
    expect(BACKFILL_SEASON_YEARS).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
  });
});

describe("SEASON_OPTIONS", () => {
  it("lists every backfilled season label, newest first", () => {
    expect(SEASON_OPTIONS[0]).toBe("2026-27");
    expect(SEASON_OPTIONS[SEASON_OPTIONS.length - 1]).toBe("2016-17");
    expect(SEASON_OPTIONS).toHaveLength(11);
  });
});
