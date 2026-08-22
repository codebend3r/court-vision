import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateRoute,
  parsePerfBudgetConfig,
  partitionRoutes,
  summarize,
  type PerfBudgetConfig,
  type RouteBudget,
  type RouteSample,
  type RouteVerdict,
} from "@/lib/perf/budget";
import { parseCheckOptions, type CheckOptions } from "@/lib/perf/options";
import { skipLine, summaryLine, verdictLines } from "@/lib/perf/report";
import { isMainModule } from "@/lib/runtime";
import { sequentially } from "@/lib/sequentially";

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
 *
 * This file is the I/O shell: reading the config, reading the environment,
 * making requests, and printing. Every decision it prints lives in
 * lib/perf/{budget,options,report}.ts, where it is unit-tested offline.
 */

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
  // Checked before the body is read: a redirect or an error page is not a
  // measurement, and there is no reason to time downloading one.
  if (response.status !== 200) {
    throw new Error(`${url} responded ${response.status}; budgets only apply to 200s`);
  }
  await response.arrayBuffer();
  return { ttfbMs, totalMs: performance.now() - started };
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
  const samples = await sequentially({
    items: Array.from({ length: warmupRuns + runs }),
    run: () => measureOnce({ url }),
  });
  return samples.slice(warmupRuns);
};

export const runPerfCheck = async ({
  config,
  baseUrl,
  skipDbRoutes,
}: CheckOptions & { config: PerfBudgetConfig }): Promise<boolean> => {
  const { measured, skipped } = partitionRoutes({ routes: config.routes, skipDbRoutes });
  skipped.forEach((route) => console.log(skipLine(route)));

  const verdicts = await sequentially({
    items: measured,
    run: async ({ item: route }): Promise<RouteVerdict> => {
      const samples = await measureRoute({
        baseUrl,
        route,
        runs: config.runs,
        warmupRuns: config.warmupRuns,
      });
      const verdict = evaluateRoute({ route, samples, percentile: config.percentile });
      verdictLines(verdict).forEach((line) => console.log(line));
      return verdict;
    },
  });

  const summary = summarize(verdicts);
  console.log(
    summaryLine({
      summary,
      skippedCount: skipped.length,
      percentile: config.percentile,
      runs: config.runs,
    }),
  );
  return summary.pass;
};

if (isMainModule({ moduleUrl: import.meta.url })) {
  const options = parseCheckOptions({
    argv: process.argv.slice(2),
    perfBaseUrl: process.env.PERF_BASE_URL,
    databaseUrl: process.env.DATABASE_URL,
  });
  runPerfCheck({ config: loadConfig(), ...options })
    .then((pass) => {
      process.exit(pass ? 0 : 1);
    })
    .catch((error: unknown) => {
      // Lead with what actually went wrong. The old wording asserted the server
      // was down, which was a wrong diagnosis for every non-200 the check makes
      // a point of rejecting.
      console.error("Perf budget check could not complete:");
      console.error(error instanceof Error ? error.message : error);
      console.error(
        "If that is a connection failure, start the server first with `bun run start` (or `bun dev`).",
      );
      process.exit(1);
    });
}
