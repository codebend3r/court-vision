import { describe, expect, it } from "bun:test";

import { evaluateRoute, summarize, type RouteBudget } from "@/lib/perf/budget";
import { skipLine, summaryLine, verdictLines } from "@/lib/perf/report";

const route: RouteBudget = {
  path: "/players",
  label: "Players",
  requiresDb: true,
  budgetMs: { ttfb: 1200, total: 2500 },
};

const verdictFor = (sample: { ttfbMs: number; totalMs: number }) =>
  evaluateRoute({ route, samples: [sample], percentile: 95 });

describe("skipLine", () => {
  it("names the route and both reasons it was skipped", () => {
    expect(skipLine(route)).toBe(
      "SKIP  /players  (needs a database; DATABASE_URL not set or --skip-db)",
    );
  });
});

describe("verdictLines", () => {
  it("prints one PASS line and nothing else when inside budget", () => {
    expect(verdictLines(verdictFor({ ttfbMs: 100.4, totalMs: 400.6 }))).toEqual([
      "PASS  /players  ttfb 100ms/1200ms  total 401ms/2500ms",
    ]);
  });

  it("prints a FAIL line followed by one indented line per breach", () => {
    const lines = verdictLines(verdictFor({ ttfbMs: 1900, totalMs: 9000 }));
    expect(lines[0]).toStartWith("FAIL  /players");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("      TTFB p95 1900ms exceeds the 1200ms budget");
    expect(lines[2]).toBe("      Total p95 9000ms exceeds the 2500ms budget");
  });
});

describe("summaryLine", () => {
  const line = (args: Parameters<typeof summaryLine>[0]) => summaryLine(args);

  // The regression this exists to prevent: a fully skipped run used to print
  // "All 0 measured routes are inside budget", which reads as coverage.
  it("says a run that measured nothing asserts nothing", () => {
    const text = line({
      summary: summarize([]),
      skippedCount: 5,
      percentile: 95,
      runs: 5,
    });
    expect(text).toContain("No routes measured");
    expect(text).toContain("all 5 configured route(s) were skipped");
    expect(text).not.toContain("inside budget");
  });

  it("reports how many routes passed and at what percentile", () => {
    expect(
      line({
        summary: summarize([verdictFor({ ttfbMs: 100, totalMs: 400 })]),
        skippedCount: 0,
        percentile: 95,
        runs: 5,
      }),
    ).toContain("All 1 measured routes are inside budget (p95 over 5 runs).");
  });

  it("counts the breaches and refuses to suggest raising a budget", () => {
    const text = line({
      summary: summarize([
        verdictFor({ ttfbMs: 100, totalMs: 400 }),
        verdictFor({ ttfbMs: 9000, totalMs: 9000 }),
      ]),
      skippedCount: 0,
      percentile: 95,
      runs: 5,
    });
    expect(text).toContain("1 route(s) over budget");
    expect(text).toContain("do not raise a budget to make this pass");
  });
});
