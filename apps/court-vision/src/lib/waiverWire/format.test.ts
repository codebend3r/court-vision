import { describe, expect, it } from "bun:test";

import { formatCategoryDelta, formatCategoryValue, formatValue } from "@/lib/waiverWire/format";

describe("formatCategoryValue", () => {
  it("prints a ratio category as a rate with no leading zero", () => {
    expect(formatCategoryValue({ value: 0.532, kind: "ratio" })).toBe(".532");
    expect(formatCategoryValue({ value: 0.5, kind: "ratio" })).toBe(".500");
  });

  it("keeps the digit on a perfect rate", () => {
    expect(formatCategoryValue({ value: 1, kind: "ratio" })).toBe("1.000");
  });

  it("prints a counting category to one decimal", () => {
    expect(formatCategoryValue({ value: 11.84, kind: "counting" })).toBe("11.8");
    expect(formatCategoryValue({ value: 0.6, kind: "counting" })).toBe("0.6");
  });
});

describe("formatCategoryDelta", () => {
  it("signs a gain with a plus at the category's precision", () => {
    expect(formatCategoryDelta({ value: 3.31, kind: "counting" })).toBe("+3.3");
    expect(formatCategoryDelta({ value: 0.003, kind: "ratio" })).toBe("+.003");
  });

  it("signs a loss with a true minus sign", () => {
    expect(formatCategoryDelta({ value: -0.002, kind: "ratio" })).toBe("−.002");
    expect(formatCategoryDelta({ value: -0.4, kind: "counting" })).toBe("−0.4");
  });

  it("prints an exact zero as 0 with no sign", () => {
    expect(formatCategoryDelta({ value: 0, kind: "counting" })).toBe("0");
    expect(formatCategoryDelta({ value: -0, kind: "ratio" })).toBe("0");
  });

  it("prints a change that rounds to zero as 0 with no sign", () => {
    expect(formatCategoryDelta({ value: 0.04, kind: "counting" })).toBe("0");
    expect(formatCategoryDelta({ value: -0.04, kind: "counting" })).toBe("0");
    expect(formatCategoryDelta({ value: 0.0004, kind: "ratio" })).toBe("0");
  });
});

describe("formatValue", () => {
  it("prints a player value to two decimals", () => {
    expect(formatValue({ value: 0.938 })).toBe("0.94");
    expect(formatValue({ value: 1.1 })).toBe("1.10");
  });

  it("signs a negative value with a true minus sign", () => {
    expect(formatValue({ value: -0.42 })).toBe("\u22120.42");
  });

  it("drops the sign from a negative value that rounds to zero", () => {
    expect(formatValue({ value: -0.001 })).toBe("0.00");
  });
});
