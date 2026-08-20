import { describe, expect, it } from "bun:test";

import {
  isActionArray,
  isActionId,
  isActionInt,
  isActionText,
  isOptionalActionId,
} from "@/lib/actions/argGuards";

// The Prisma filter shapes a caller can smuggle through a server action
// boundary in place of a scalar.
const FILTERS = [
  { not: "" },
  { gte: 0 },
  { in: ["a", "b"] },
  { contains: "" },
  { equals: undefined },
] as const;

describe("isActionId", () => {
  it("accepts a non-empty string", () => {
    expect(isActionId("clx123")).toBe(true);
  });

  it("rejects an empty string, which Prisma would treat as a real id", () => {
    expect(isActionId("")).toBe(false);
  });

  it("rejects every Prisma filter object", () => {
    FILTERS.forEach((filter) => {
      expect(isActionId(filter)).toBe(false);
    });
  });

  it("rejects null, undefined, numbers, and arrays", () => {
    expect(isActionId(null)).toBe(false);
    expect(isActionId(undefined)).toBe(false);
    expect(isActionId(7)).toBe(false);
    expect(isActionId(["clx123"])).toBe(false);
  });
});

describe("isOptionalActionId", () => {
  it("accepts null, which signals create rather than update", () => {
    expect(isOptionalActionId(null)).toBe(true);
  });

  it("accepts a non-empty string", () => {
    expect(isOptionalActionId("clx123")).toBe(true);
  });

  it("rejects undefined and every filter object", () => {
    expect(isOptionalActionId(undefined)).toBe(false);
    FILTERS.forEach((filter) => {
      expect(isOptionalActionId(filter)).toBe(false);
    });
  });
});

describe("isActionInt", () => {
  it("accepts an integer", () => {
    expect(isActionInt(0)).toBe(true);
    expect(isActionInt(203507)).toBe(true);
  });

  it("rejects a float, NaN, and Infinity", () => {
    expect(isActionInt(1.5)).toBe(false);
    expect(isActionInt(Number.NaN)).toBe(false);
    expect(isActionInt(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("rejects every filter object and a numeric string", () => {
    FILTERS.forEach((filter) => {
      expect(isActionInt(filter)).toBe(false);
    });
    expect(isActionInt("7")).toBe(false);
  });
});

describe("isActionText", () => {
  it("accepts any string, including empty, which callers trim themselves", () => {
    expect(isActionText("")).toBe(true);
    expect(isActionText("Bench Mob")).toBe(true);
  });

  it("rejects a filter object and a non-string", () => {
    expect(isActionText({ contains: "" })).toBe(false);
    expect(isActionText(42)).toBe(false);
    expect(isActionText(null)).toBe(false);
  });
});

describe("isActionArray", () => {
  it("accepts an empty array and a populated one", () => {
    expect(isActionArray([])).toBe(true);
    expect(isActionArray([{ slotType: "PG", position: 0, playerId: null }])).toBe(true);
  });

  it("rejects every filter object, a string, and a nullish value", () => {
    FILTERS.forEach((filter) => {
      expect(isActionArray(filter)).toBe(false);
    });
    expect(isActionArray("not-an-array")).toBe(false);
    expect(isActionArray({ length: 2 })).toBe(false);
    expect(isActionArray(null)).toBe(false);
    expect(isActionArray(undefined)).toBe(false);
  });
});
