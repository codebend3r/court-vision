import { describe, expect, it } from "vitest";

import { parseGameDate, parseMinutes } from "@/lib/stats/parse";

describe("parseMinutes", () => {
  it("passes through numeric minutes", () => {
    expect(parseMinutes(34)).toBe(34);
  });

  it("parses mm:ss strings to decimal minutes", () => {
    expect(parseMinutes("34:30")).toBe(34.5);
  });

  it("parses plain numeric strings", () => {
    expect(parseMinutes("28")).toBe(28);
  });

  it("falls back to 0 for unparseable input", () => {
    expect(parseMinutes("")).toBe(0);
  });
});

describe("parseGameDate", () => {
  it("parses a date-only string as UTC midnight", () => {
    expect(parseGameDate("2025-10-22").toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("treats a tz-less datetime as UTC", () => {
    expect(parseGameDate("2025-10-22T00:00:00").toISOString()).toBe("2025-10-22T00:00:00.000Z");
  });

  it("respects an explicit Z designator", () => {
    expect(parseGameDate("2025-10-22T12:00:00Z").toISOString()).toBe("2025-10-22T12:00:00.000Z");
  });
});
