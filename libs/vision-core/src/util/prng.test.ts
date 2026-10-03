import { describe, expect, it } from "bun:test";

import { createPrng, gaussian } from "#core/util/prng";

const draw = ({ seed, count }: { seed: number; count: number }): number[] => {
  const rng = createPrng(seed);
  return Array.from({ length: count }, () => rng());
};

describe("createPrng", () => {
  it("replays the same sequence for the same seed", () => {
    expect(draw({ seed: 0x5eed, count: 50 })).toEqual(draw({ seed: 0x5eed, count: 50 }));
  });

  it("produces a different sequence for a different seed", () => {
    expect(draw({ seed: 1, count: 5 })).not.toEqual(draw({ seed: 2, count: 5 }));
  });

  it("keeps every draw in [0, 1)", () => {
    expect(draw({ seed: 42, count: 1000 }).every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("gaussian", () => {
  it("returns the mean when the angle term is zero", () => {
    // u2 = 0.25 puts cos(2π·u2) at 0, so the spread contributes nothing.
    expect(gaussian({ rng: () => 0.25, mean: 10, spread: 3 })).toBeCloseTo(10, 12);
  });
});
