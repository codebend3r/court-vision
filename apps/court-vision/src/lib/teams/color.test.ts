import { describe, expect, it } from "bun:test";

import { contrastRatio, contrastTextFor, relativeLuminance } from "@/lib/teams/color";

describe("relativeLuminance", () => {
  it("spans black to white", () => {
    expect(relativeLuminance({ hex: "#000000" })).toBe(0);
    expect(relativeLuminance({ hex: "#FFFFFF" })).toBeCloseTo(1, 10);
  });

  it("linearises each channel before weighting it", () => {
    // sRGB mid-grey is about a fifth as luminous as white, not half.
    expect(relativeLuminance({ hex: "#808080" })).toBeCloseTo(0.2159, 4);
  });
});

describe("contrastRatio", () => {
  it("is 21 between black and white whichever way round", () => {
    expect(contrastRatio({ a: "#000000", b: "#FFFFFF" })).toBeCloseTo(21, 10);
    expect(contrastRatio({ a: "#FFFFFF", b: "#000000" })).toBeCloseTo(21, 10);
  });

  it("is 1 for a color against itself", () => {
    expect(contrastRatio({ a: "#1D1160", b: "#1D1160" })).toBe(1);
  });
});

describe("contrastTextFor", () => {
  it("puts black text on light fills and white text on dark ones", () => {
    expect(contrastTextFor({ background: "#C4CED4" })).toBe("#000000");
    expect(contrastTextFor({ background: "#000000" })).toBe("#FFFFFF");
    expect(contrastTextFor({ background: "#1D428A" })).toBe("#FFFFFF");
  });
});
