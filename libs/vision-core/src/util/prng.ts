// Mulberry32 PRNG — deterministic, seeded, floats in [0, 1).
export const createPrng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Box-Muller transform — draws a normally distributed value from two rng() calls.
export const gaussian = (args: { rng: () => number; mean: number; spread: number }): number => {
  const { rng, mean, spread } = args;
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return mean + spread * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};
