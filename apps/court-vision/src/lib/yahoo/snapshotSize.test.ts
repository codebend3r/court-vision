import { describe, expect, it } from "bun:test";

import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import waivers106344 from "@/lib/yahoo/fixtures/waivers-106344.json";
import { measureSnapshotBytes } from "@/lib/yahoo/snapshotSize";

const LIMIT = 1_500_000;

type Chain = { a: unknown; b: unknown };

// What React's reply decoder can hand an action from a few hundred bytes: one
// object reused at every level, so each level doubles what JSON would write.
const sharedChain = ({ depth }: { depth: number }): unknown =>
  Array.from({ length: depth }).reduce<unknown>((inner): Chain => ({ a: inner, b: inner }), "leaf");

describe("measureSnapshotBytes", () => {
  it("measures a normal payload as within the limit", () => {
    const payload = { game: {}, snapshot: league106344, waiverPages: [waivers106344] };

    expect(measureSnapshotBytes({ payload, limit: LIMIT })).toEqual({ status: "within" });
  });

  it("measures a 1.6 MB string as over the limit", () => {
    const payload = { game: {}, snapshot: {}, waiverPages: ["x".repeat(1_600_000)] };

    expect(measureSnapshotBytes({ payload, limit: LIMIT })).toEqual({ status: "over" });
  });

  it("counts multi-byte characters by their UTF-8 length", () => {
    // 600,000 characters, 1.8 MB as UTF-8 ("€" is three bytes).
    const payload = { name: "€".repeat(600_000) };

    expect(measureSnapshotBytes({ payload, limit: LIMIT })).toEqual({ status: "over" });
  });

  it("stops a shared-reference chain early instead of expanding it", () => {
    const started = performance.now();

    const result = measureSnapshotBytes({ payload: sharedChain({ depth: 30 }), limit: LIMIT });

    expect(result).toEqual({ status: "over" });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("measures a value JSON can't encode as over the limit", () => {
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;

    expect(measureSnapshotBytes({ payload: { n: BigInt(1) }, limit: LIMIT })).toEqual({
      status: "over",
    });
    expect(measureSnapshotBytes({ payload: cycle, limit: LIMIT })).toEqual({ status: "over" });
  });
});
