import { describe, expect, it } from "bun:test";

import { fontScaleOf, isFontScale, isPreferredFormula } from "@/lib/settings/guards";

describe("isFontScale", () => {
  it("accepts the four scales", () => {
    expect(isFontScale("sm")).toBe(true);
    expect(isFontScale("default")).toBe(true);
    expect(isFontScale("lg")).toBe(true);
    expect(isFontScale("xl")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isFontScale("xxl")).toBe(false);
    expect(isFontScale("")).toBe(false);
  });
});

describe("isPreferredFormula", () => {
  it("accepts available registry methods", () => {
    expect(isPreferredFormula("zscore")).toBe(true);
    expect(isPreferredFormula("simvalue")).toBe(true);
  });
  it("rejects unknown methods", () => {
    expect(isPreferredFormula("montecarlo")).toBe(false);
    expect(isPreferredFormula("")).toBe(false);
  });
});

describe("fontScaleOf", () => {
  it("returns the profile's fontScale when valid", () => {
    expect(fontScaleOf({ profile: { fontScale: "sm" } })).toBe("sm");
    expect(fontScaleOf({ profile: { fontScale: "default" } })).toBe("default");
    expect(fontScaleOf({ profile: { fontScale: "lg" } })).toBe("lg");
    expect(fontScaleOf({ profile: { fontScale: "xl" } })).toBe("xl");
  });
  it("returns default when profile is null", () => {
    expect(fontScaleOf({ profile: null })).toBe("default");
  });
  it("returns default when fontScale is invalid", () => {
    expect(fontScaleOf({ profile: { fontScale: "xxl" } })).toBe("default");
    expect(fontScaleOf({ profile: { fontScale: "" } })).toBe("default");
  });
});
