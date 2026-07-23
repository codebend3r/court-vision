import { afterEach, describe, expect, it } from "vitest";

import {
  BACKFILL_SEASON_YEARS,
  getApiKey,
  SEASON_LABEL,
  SEASON_YEAR,
  seasonLabelFromYear,
} from "@/lib/balldontlie/constants";

const original = process.env.BALLDONTLIE_API_KEY;

afterEach(() => {
  if (original === undefined) {
    delete process.env.BALLDONTLIE_API_KEY;
  } else {
    process.env.BALLDONTLIE_API_KEY = original;
  }
});

describe("seasonLabelFromYear", () => {
  it("builds the label from the season start year", () => {
    expect(seasonLabelFromYear(2020)).toBe("2020-21");
    expect(seasonLabelFromYear(2025)).toBe("2025-26");
  });

  it("pads a century rollover", () => {
    expect(seasonLabelFromYear(1999)).toBe("1999-00");
  });

  it("derives SEASON_LABEL from SEASON_YEAR", () => {
    expect(SEASON_LABEL).toBe(seasonLabelFromYear(Number(SEASON_YEAR)));
  });
});

describe("BACKFILL_SEASON_YEARS", () => {
  it("spans 2020 through the current season year, oldest first", () => {
    expect(BACKFILL_SEASON_YEARS).toEqual(["2020", "2021", "2022", "2023", "2024", "2025"]);
  });
});

describe("getApiKey", () => {
  it("returns the key when set", () => {
    process.env.BALLDONTLIE_API_KEY = "abc-123";
    expect(getApiKey()).toBe("abc-123");
  });

  it("throws a clear error when unset", () => {
    delete process.env.BALLDONTLIE_API_KEY;
    expect(() => getApiKey()).toThrow(/BALLDONTLIE_API_KEY/);
  });
});
