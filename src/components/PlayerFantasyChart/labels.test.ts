import { describe, expect, it } from "bun:test";

import { formatSigned, METHOD_LABELS } from "@/components/PlayerFantasyChart/labels";

describe("formatSigned", () => {
  it("prefixes a positive value with a plus sign", () => {
    expect(formatSigned(1.44)).toBe("+1.4");
  });

  it("keeps the minus sign on a negative value", () => {
    expect(formatSigned(-2.06)).toBe("-2.1");
  });

  it("leaves zero unsigned", () => {
    expect(formatSigned(0)).toBe("0.0");
  });

  it("always prints one decimal", () => {
    expect(formatSigned(3)).toBe("+3.0");
  });
});

describe("METHOD_LABELS", () => {
  it("names both series", () => {
    expect(METHOD_LABELS).toEqual({ z: "Z-Score", g: "G-Score" });
  });
});
