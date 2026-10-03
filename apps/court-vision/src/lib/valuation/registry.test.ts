import { describe, expect, it } from "bun:test";

import { ENABLED_METHODS, FANTASY_METHODS } from "@/lib/valuation/registry";

describe("FANTASY_METHODS", () => {
  it("registers Z-Score with complete metadata", () => {
    const zscore = FANTASY_METHODS.find((method) => method.key === "zscore");
    expect(zscore?.available).toBe(true);
    expect(zscore?.label).not.toBe("");
    expect(zscore?.fullName).not.toBe("");
    expect(zscore?.description).not.toBe("");
    expect(zscore?.formula).not.toBe("");
  });

  it("gives every method a plain-language reason it matters", () => {
    // The tooltips and the legend both render this; a blank one would leave a
    // labelled empty section rather than degrade quietly.
    FANTASY_METHODS.forEach((method) => {
      expect(method.whyItMatters.length).toBeGreaterThan(40);
    });
  });

  it("only exposes available methods as enabled", () => {
    expect(ENABLED_METHODS.every((method) => method.available)).toBe(true);
    expect(ENABLED_METHODS.map((method) => method.key)).toContain("zscore");
  });
});
