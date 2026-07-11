import { describe, expect, it } from "vitest";

import { sum } from "@/lib/math";

describe("sum", () => {
  it("adds an array of numbers", () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });

  it("returns 0 for an empty array", () => {
    expect(sum([])).toBe(0);
  });
});
