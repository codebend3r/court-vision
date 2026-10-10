import { describe, expect, it } from "bun:test";

import {
  datesBetween,
  isIsoDate,
  todayInNewYork,
  yesterdayInNewYork,
} from "@/lib/balldontlie/dates";

describe("isIsoDate", () => {
  it("accepts a real YYYY-MM-DD date", () => {
    expect(isIsoDate("2026-10-21")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects other formats", () => {
    expect(isIsoDate("10/21/2026")).toBe(false);
    expect(isIsoDate("2026-10-21T00:00:00Z")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("rejects a date the calendar does not have", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
  });
});

describe("todayInNewYork", () => {
  it("reads the New York calendar date, not the UTC one", () => {
    // 03:00 UTC on the 22nd is still 23:00 on the 21st in New York (EDT).
    expect(todayInNewYork({ now: new Date("2026-10-22T03:00:00Z") })).toBe("2026-10-21");
  });
});

describe("yesterdayInNewYork", () => {
  it("returns last night's game date at 3am Eastern during daylight time", () => {
    expect(yesterdayInNewYork({ now: new Date("2026-10-22T07:00:00Z") })).toBe("2026-10-21");
  });

  it("returns last night's game date at 3am Eastern during standard time", () => {
    expect(yesterdayInNewYork({ now: new Date("2026-12-26T08:00:00Z") })).toBe("2026-12-25");
  });

  it("crosses a month and year boundary", () => {
    expect(yesterdayInNewYork({ now: new Date("2027-01-01T08:00:00Z") })).toBe("2026-12-31");
  });
});

describe("datesBetween", () => {
  it("lists every date in the range, inclusive", () => {
    expect(datesBetween({ from: "2026-10-30", to: "2026-11-02" })).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("returns the single date when from equals to", () => {
    expect(datesBetween({ from: "2026-10-21", to: "2026-10-21" })).toEqual(["2026-10-21"]);
  });

  it("refuses a range that runs backwards", () => {
    expect(() => datesBetween({ from: "2026-10-22", to: "2026-10-21" })).toThrow("after");
  });
});
