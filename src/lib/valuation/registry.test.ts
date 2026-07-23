import { describe, expect, it } from "vitest";

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

  it("only exposes available methods as enabled", () => {
    expect(ENABLED_METHODS.every((method) => method.available)).toBe(true);
    expect(ENABLED_METHODS.map((method) => method.key)).toContain("zscore");
  });
});
