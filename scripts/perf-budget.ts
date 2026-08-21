import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateRoute,
  parsePerfBudgetConfig,
  summarize,
  type PerfBudgetConfig,
  type RouteBudget,
  type RouteSample,
  type RouteVerdict,
} from "@/lib/perf/budget";
import { isMainModule } from "@/lib/runtime";

/**
 * Load-time budget check.
 *
 * Measures each route in perf-budget.json against a running server and exits 1
 * when a percentile lands over budget. Offline, free, no API keys.
 *
 * Usage:
 *   bun run perf:budget                          # server on :46644 (dev or start)
 *   bun run perf:budget -- --base-url=http://localhost:3000
 *   bun run perf:budget -- --skip-db             # force-skip requiresDb routes
 *
 * Routes flagged requiresDb are skipped automatically when DATABASE_URL is not
 * set, so the same command works locally (full coverage) and in CI (shell
 * routes only).
 */

const DEFAULT_BASE_URL = "http://localhost:46644";

type CheckOptions = {
  baseUrl: string;
  skipDb: boolean;
};

const parseArgs = (argv: readonly string[]): CheckOptions =>
  argv.reduce<CheckOptions>(
    (options, arg) => {
      if (arg === "--skip-db") return { ...options, skipDb: true };
      if (arg.startsWith("--base-url=")) {
        return { ...options, baseUrl: arg.slice("--base-url=".length) };
      }
      return options;
    },
    { baseUrl: process.env.PERF_BASE_URL ?? DEFAULT_BASE_URL, skipDb: false },
  );

const loadConfig = (): PerfBudgetConfig => {
  const configPath = resolve(import.meta.dir, "..", "perf-budget.json");
  const raw: unknown = JSON.parse(readFileSync(configPath, "utf8"));
  return parsePerfBudgetConfig(raw);
};

const measureOnce = async ({ url }: { url: string }): Promise<RouteSample> => {
  const started = performance.now();
  const response = await fetch(url, { redirect: "manual" });
  // Headers received is the closest fetch gets to time-to-first-byte.
  const ttfbMs = performance.now() - started;
  await response.arrayBuffer();
  const totalMs = performance.now() - started;
  if (response.status !== 200) {
    throw new Error(`${url} responded ${response.status}; budgets only apply to 200s`);
  }
  return { ttfbMs, totalMs };
};

const measureRoute = async ({
  baseUrl,
  route,
  runs,
  warmupRuns,
}: {
  baseUrl: string;
  route: RouteBudget;
  runs: number;
  warmupRuns: number;
}): Promise<RouteSample[]> => {
  const url = new URL(route.path, baseUrl).toString();
  // Sequential on purpose: parallel requests contend for the same server and
  // would measure queueing, not the route.
  const samples = await Array.from({ length: warmupRuns + runs }).reduce<Promise<RouteSample[]>>(
    async (previous) => {
      const collected = await previous;
      const sample = await measureOnce({ url });
      return [...collected, sample];
    },
    Promise.resolve([]),
  );
  return samples.slice(warmupRuns);
};

const formatVerdict = (verdict: RouteVerdict): string => {
  const status = verdict.pass ? "PASS" : "FAIL";
  const ttfb = `ttfb ${Math.round(verdict.ttfbMs)}ms/${verdict.budgetMs.ttfb}ms`;
  const total = `total ${Math.round(verdict.totalMs)}ms/${verdict.budgetMs.total}ms`;
  return `${status}  ${verdict.path}  ${ttfb}  ${total}`;
};

export const runPerfCheck = async (options: CheckOptions): Promise<boolean> => {
  const config = loadConfig();
  const skipDbRoutes = options.skipDb || !process.env.DATABASE_URL;
  const [skipped, measured] = config.routes.reduce<[RouteBudget[], RouteBudget[]]>(
    ([toSkip, toMeasure], route) =>
      skipDbRoutes && route.requiresDb
        ? [[...toSkip, route], toMeasure]
        : [toSkip, [...toMeasure, route]],
    [[], []],
  );

  skipped.map((route) =>
    console.log(`SKIP  ${route.path}  (needs a database; DATABASE_URL not set or --skip-db)`),
  );

  const verdicts = await measured.reduce<Promise<RouteVerdict[]>>(async (previous, route) => {
    const collected = await previous;
    const samples = await measureRoute({
      baseUrl: options.baseUrl,
      route,
      runs: config.runs,
      warmupRuns: config.warmupRuns,
    });
    const verdict = evaluateRoute({ route, samples, percentile: config.percentile });
    console.log(formatVerdict(verdict));
    verdict.breaches.map((breach) => console.log(`      ${breach}`));
    return [...collected, verdict];
  }, Promise.resolve([]));

  const { pass, failed } = summarize(verdicts);
  // A run that measured nothing is not a pass. Saying so keeps a fully skipped
  // invocation (no DATABASE_URL, or --skip-db) from reading as green coverage.
  if (verdicts.length === 0) {
    console.log(
      `\nNo routes measured: all ${skipped.length} configured route(s) were skipped. This asserts nothing. Set DATABASE_URL and re-run to cover the database-backed routes.`,
    );
    return true;
  }
  console.log(
    pass
      ? `\nAll ${verdicts.length} measured routes are inside budget (p${config.percentile} over ${config.runs} runs).`
      : `\n${failed} route(s) over budget. See .claude/skills/perf-budget for the fix ladder; do not raise a budget to make this pass.`,
  );
  return pass;
};

if (isMainModule({ moduleUrl: import.meta.url })) {
  runPerfCheck(parseArgs(process.argv.slice(2)))
    .then((pass) => {
      process.exit(pass ? 0 : 1);
    })
    .catch((error: unknown) => {
      console.error(
        "Perf budget check failed to run. Is the server up? Start it with `bun run start` (or `bun dev`).",
      );
      console.error(error);
      process.exit(1);
    });
}
