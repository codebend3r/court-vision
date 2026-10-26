import { describe, expect, it } from "bun:test";

import { createPrng, gaussian, standardNormal } from "#core/util/prng";

type DrawProps = { seed: number; count: number };

const draw = ({ seed, count }: DrawProps): number[] => {
  const rng = createPrng({ seed });
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

describe("standardNormal", () => {
  it("returns 0 when the angle term is zero", () => {
    expect(standardNormal({ random: () => 0.25 })).toBeCloseTo(0, 12);
  });

  it("reads a draw of e^(-1/2) at angle 0 as exactly one standard deviation", () => {
    const draws = [Math.exp(-0.5), 0].values();
    const random = () => draws.next().value ?? 0;
    expect(standardNormal({ random })).toBeCloseTo(1, 12);
  });

  it("stays finite when the first draw is exactly 0", () => {
    expect(Number.isFinite(standardNormal({ random: () => 0 }))).toBe(true);
  });
});
