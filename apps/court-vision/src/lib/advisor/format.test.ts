import { describe, expect, it } from "bun:test";

import { formatScore } from "@/lib/advisor/format";

describe("formatScore", () => {
  it("signs to one place", () => {
    expect(formatScore({ value: 1.56 })).toBe("+1.6");
    expect(formatScore({ value: -3.94 })).toBe("-3.9");
  });

  it("never prints a negative zero", () => {
    expect(formatScore({ value: -0.04 })).toBe("0.0");
    expect(formatScore({ value: 0.04 })).toBe("0.0");
    expect(formatScore({ value: 0 })).toBe("0.0");
  });
});
