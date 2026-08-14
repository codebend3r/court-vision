import { z } from "zod";

// Load-time budgets, the repo's "acceptable threshold" contract. The config
// lives in perf-budget.json at the repo root; this module owns its shape and
// the pass/fail math so the runner (check.ts) stays a thin I/O shell and the
// logic stays unit-testable offline.

export const routeBudgetSchema = z.object({
  path: z.string().startsWith("/"),
  label: z.string().min(1),
  // Routes that read Prisma need a seeded database behind the server; the
  // runner skips them when the environment has no DATABASE_URL (e.g. CI).
  requiresDb: z.boolean().default(false),
  budgetMs: z.object({
    ttfb: z.number().positive(),
    total: z.number().positive(),
  }),
});

export const perfBudgetConfigSchema = z.object({
  runs: z.number().int().min(1),
  warmupRuns: z.number().int().min(0),
  percentile: z.number().min(1).max(100).default(95),
  routes: z.array(routeBudgetSchema).min(1),
});

export type RouteBudget = z.infer<typeof routeBudgetSchema>;
export type PerfBudgetConfig = z.infer<typeof perfBudgetConfigSchema>;

export type RouteSample = {
  ttfbMs: number;
  totalMs: number;
};

export type RouteVerdict = {
  path: string;
  label: string;
  ttfbMs: number;
  totalMs: number;
  budgetMs: RouteBudget["budgetMs"];
  breaches: string[];
  pass: boolean;
};

export const parsePerfBudgetConfig = (raw: unknown): PerfBudgetConfig =>
  perfBudgetConfigSchema.parse(raw);

// Nearest-rank percentile: for p95 over 5 samples this is the maximum, which
// is the honest reading at small run counts.
export const percentileOf = ({
  values,
  percentile,
}: {
  values: readonly number[];
  percentile: number;
}): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? 0;
};

export const evaluateRoute = ({
  route,
  samples,
  percentile,
}: {
  route: RouteBudget;
  samples: readonly RouteSample[];
  percentile: number;
}): RouteVerdict => {
  const ttfbMs = percentileOf({ values: samples.map((sample) => sample.ttfbMs), percentile });
  const totalMs = percentileOf({ values: samples.map((sample) => sample.totalMs), percentile });
  const breaches = [
    ...(ttfbMs > route.budgetMs.ttfb
      ? [`TTFB p${percentile} ${Math.round(ttfbMs)}ms exceeds the ${route.budgetMs.ttfb}ms budget`]
      : []),
    ...(totalMs > route.budgetMs.total
      ? [
          `Total p${percentile} ${Math.round(totalMs)}ms exceeds the ${route.budgetMs.total}ms budget`,
        ]
      : []),
  ];
  return {
    path: route.path,
    label: route.label,
    ttfbMs,
    totalMs,
    budgetMs: route.budgetMs,
    breaches,
    pass: breaches.length === 0,
  };
};

export const summarize = (verdicts: readonly RouteVerdict[]): { pass: boolean; failed: number } => {
  const failed = verdicts.filter((verdict) => !verdict.pass).length;
  return { pass: failed === 0, failed };
};
