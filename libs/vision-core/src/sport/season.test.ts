import { describe, expect, it } from "bun:test";

import { crossYearSeasonLabel, singleYearSeasonLabel } from "#core/sport/season";

describe("crossYearSeasonLabel", () => {
  it("names a season by its start year and padded end year", () => {
    expect(crossYearSeasonLabel({ startYear: 2025 })).toBe("2025-26");
    expect(crossYearSeasonLabel({ startYear: 1999 })).toBe("1999-00");
    expect(crossYearSeasonLabel({ startYear: 2009 })).toBe("2009-10");
  });
});

describe("singleYearSeasonLabel", () => {
  it("names a season by its start year alone", () => {
    expect(singleYearSeasonLabel({ startYear: 2025 })).toBe("2025");
  });
});
