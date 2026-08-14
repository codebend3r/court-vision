import { describe, expect, it } from "bun:test";

import {
  evaluateRoute,
  parsePerfBudgetConfig,
  percentileOf,
  summarize,
  type RouteBudget,
} from "@/lib/perf/budget";

const route: RouteBudget = {
  path: "/login",
  label: "Login",
  requiresDb: false,
  budgetMs: { ttfb: 500, total: 1000 },
};

describe("parsePerfBudgetConfig", () => {
  it("accepts a valid config and defaults requiresDb and percentile", () => {
    const config = parsePerfBudgetConfig({
      runs: 5,
      warmupRuns: 1,
      routes: [{ path: "/login", label: "Login", budgetMs: { ttfb: 500, total: 1000 } }],
    });
    expect(config.percentile).toBe(95);
    expect(config.routes[0]?.requiresDb).toBe(false);
  });

  it("rejects a route whose path does not start with a slash", () => {
    expect(() =>
      parsePerfBudgetConfig({
        runs: 5,
        warmupRuns: 1,
        routes: [{ path: "login", label: "Login", budgetMs: { ttfb: 500, total: 1000 } }],
      }),
    ).toThrow();
  });

  it("rejects non-positive budgets", () => {
    expect(() =>
      parsePerfBudgetConfig({
        runs: 5,
        warmupRuns: 1,
        routes: [{ path: "/login", label: "Login", budgetMs: { ttfb: 0, total: 1000 } }],
      }),
    ).toThrow();
  });
});

describe("percentileOf", () => {
  it("returns 0 for no samples", () => {
    expect(percentileOf({ values: [], percentile: 95 })).toBe(0);
  });

  it("returns the max for p95 over five samples (nearest rank)", () => {
    expect(percentileOf({ values: [100, 200, 300, 400, 5000], percentile: 95 })).toBe(5000);
  });

  it("returns the median for p50", () => {
    expect(percentileOf({ values: [300, 100, 200], percentile: 50 })).toBe(200);
  });
});

describe("evaluateRoute", () => {
  it("passes when both metrics sit inside budget", () => {
    const verdict = evaluateRoute({
      route,
      samples: [
        { ttfbMs: 100, totalMs: 400 },
        { ttfbMs: 120, totalMs: 450 },
      ],
      percentile: 95,
    });
    expect(verdict.pass).toBe(true);
    expect(verdict.breaches).toEqual([]);
  });

  it("reports each metric breach separately", () => {
    const verdict = evaluateRoute({
      route,
      samples: [{ ttfbMs: 800, totalMs: 2000 }],
      percentile: 95,
    });
    expect(verdict.pass).toBe(false);
    expect(verdict.breaches).toHaveLength(2);
    expect(verdict.breaches[0]).toContain("TTFB");
    expect(verdict.breaches[1]).toContain("Total");
  });

  it("flags a TTFB breach even when total passes", () => {
    const verdict = evaluateRoute({
      route,
      samples: [{ ttfbMs: 700, totalMs: 900 }],
      percentile: 95,
    });
    expect(verdict.breaches).toHaveLength(1);
    expect(verdict.breaches[0]).toContain("TTFB");
  });
});

describe("summarize", () => {
  it("counts failing routes", () => {
    const passing = evaluateRoute({
      route,
      samples: [{ ttfbMs: 100, totalMs: 400 }],
      percentile: 95,
    });
    const failing = evaluateRoute({
      route,
      samples: [{ ttfbMs: 9000, totalMs: 9000 }],
      percentile: 95,
    });
    expect(summarize([passing, failing])).toEqual({ pass: false, failed: 1 });
    expect(summarize([passing])).toEqual({ pass: true, failed: 0 });
  });
});
