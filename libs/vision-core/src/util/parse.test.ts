import { describe, expect, it } from "bun:test";

import { blankToNull, parseGameDate, parseMinutes } from "#core/util/parse";

describe("parseMinutes", () => {
  it("passes through numeric minutes", () => {
    expect(parseMinutes({ value: 34 })).toBe(34);
  });

  it("parses mm:ss strings to decimal minutes", () => {
    expect(parseMinutes({ value: "34:30" })).toBe(34.5);
  });

  it("parses plain numeric strings", () => {
    expect(parseMinutes({ value: "28" })).toBe(28);
  });

  it("falls back to 0 for unparseable input", () => {
    expect(parseMinutes({ value: "" })).toBe(0);
  });
});

describe("parseGameDate", () => {
  it("parses a date-only string as UTC midnight", () => {
    expect(parseGameDate({ value: "2025-10-22" }).toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("treats a tz-less datetime as UTC", () => {
    expect(parseGameDate({ value: "2025-10-22T00:00:00" }).toISOString()).toBe(
      "2025-10-22T00:00:00.000Z",
    );
  });

  it("respects an explicit Z designator", () => {
    expect(parseGameDate({ value: "2025-10-22T12:00:00Z" }).toISOString()).toBe(
      "2025-10-22T12:00:00.000Z",
    );
  });
});

describe("blankToNull", () => {
  it("returns null for empty, whitespace-only, null, and undefined values", () => {
    expect(blankToNull({ value: "" })).toBeNull();
    expect(blankToNull({ value: "   " })).toBeNull();
    expect(blankToNull({ value: null })).toBeNull();
    expect(blankToNull({ value: undefined })).toBeNull();
  });

  it("trims surrounding whitespace from real values", () => {
    expect(blankToNull({ value: "  G-F " })).toBe("G-F");
  });
});
