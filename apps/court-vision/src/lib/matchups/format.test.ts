import { describe, expect, it } from "bun:test";

import { formatWeekDate, formatWeeklyAverage, formatWeekRange } from "@/lib/matchups/format";

describe("formatWeekDate", () => {
  it("formats a host date and rejects the rest", () => {
    expect(formatWeekDate({ value: "2026-10-20" })).toBe("Oct 20");
    expect(formatWeekDate({ value: null })).toBeNull();
    expect(formatWeekDate({ value: "soon" })).toBeNull();
  });
});

describe("formatWeekRange", () => {
  it("needs both ends", () => {
    expect(formatWeekRange({ weekStart: "2026-10-20", weekEnd: "2026-10-26" })).toBe(
      "Oct 20 to Oct 26",
    );
    expect(formatWeekRange({ weekStart: "2026-10-20", weekEnd: null })).toBeNull();
  });
});

describe("formatWeeklyAverage", () => {
  it("prints ratios as the host does and counts to one place", () => {
    expect(formatWeeklyAverage({ value: 0.4812 })).toBe(".481");
    expect(formatWeeklyAverage({ value: 41.25 })).toBe("41.3");
    expect(formatWeeklyAverage({ value: 0 })).toBe("0.0");
    expect(formatWeeklyAverage({ value: null })).toBe("-");
  });
});
