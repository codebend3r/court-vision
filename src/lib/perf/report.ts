import type { BudgetSummary, RouteBudget, RouteVerdict } from "@/lib/perf/budget";

// Every line the check prints. Kept beside the budget math rather than in the
// runner so the wording is unit-testable: the summary in particular has to
// distinguish "measured nothing" from "everything passed", and that judgement
// is the whole point of running the check.

export const skipLine = (route: RouteBudget): string =>
  `SKIP  ${route.path}  (needs a database; DATABASE_URL not set or --skip-db)`;

export const verdictLines = (verdict: RouteVerdict): string[] => {
  const status = verdict.pass ? "PASS" : "FAIL";
  const ttfb = `ttfb ${Math.round(verdict.ttfbMs)}ms/${verdict.budgetMs.ttfb}ms`;
  const total = `total ${Math.round(verdict.totalMs)}ms/${verdict.budgetMs.total}ms`;
  return [
    `${status}  ${verdict.path}  ${ttfb}  ${total}`,
    ...verdict.breaches.map((breach) => `      ${breach}`),
  ];
};

export const summaryLine = ({
  summary,
  skippedCount,
  percentile,
  runs,
}: {
  summary: BudgetSummary;
  skippedCount: number;
  percentile: number;
  runs: number;
}): string => {
  // Measuring nothing is not passing. Without this, a fully skipped run prints
  // "All 0 measured routes are inside budget" and reads as green coverage.
  if (summary.measured === 0) {
    return `\nNo routes measured: all ${skippedCount} configured route(s) were skipped, so this run asserts nothing. Set DATABASE_URL, or drop --skip-db, to cover the database-backed routes.`;
  }
  return summary.failed === 0
    ? `\nAll ${summary.measured} measured routes are inside budget (p${percentile} over ${runs} runs).`
    : `\n${summary.failed} route(s) over budget. See .claude/skills/perf-budget for the fix ladder; do not raise a budget to make this pass.`;
};
