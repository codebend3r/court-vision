"use client";

import dynamic from "next/dynamic";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";

import {
  FantasyControls,
  type FantasyControlsChange,
} from "@/components/FantasyControls/FantasyControls";
import { FantasyPager } from "@/components/FantasyPager/FantasyPager";
import type { FantasyChartRow } from "@/components/FantasyValueCharts/FantasyValueCharts";
import { FantasyValueLegend } from "@/components/FantasyValueLegend/FantasyValueLegend";
import {
  FantasyValueTable,
  type FantasyTableRow,
} from "@/components/FantasyValueTable/FantasyValueTable";
import type { FantasyTrendRow } from "@/components/FantasyValueTrends/FantasyValueTrends";
import { useValuation } from "@/components/FantasyValueView/useValuation";
import { Preloader } from "@vision/ui/components/Preloader/Preloader";
import { type FantasySeed } from "@/lib/leagues/fantasyDefaults";
import { gamesForRange, type PlayerGameRange } from "@/lib/players/searchParams";
import { loadFantasyTrendLogs } from "@/lib/valuation/actions";
import {
  buildCategoryBreakdown,
  buildFantasyTrend,
  CATEGORY_KEYS,
  CATEGORY_META,
} from "@vision/sport-basketball/engine";
import { isWeightedMethodKey, WEIGHTED_METHOD_KEYS } from "@vision/core/valuation/registry";
import { DEFAULT_TREND_GAMES } from "@vision/core/valuation/trend";
import {
  FANTASY_LAYOUTS,
  fantasyParsers,
  type FantasyLayout,
  type FantasySortKey,
} from "@/lib/valuation/searchParams";
import {
  isFantasyTrendLogsResult,
  toDatedLogs,
  type FantasyTrendLogsResult,
} from "@/lib/valuation/trendLogs";
import {
  type FantasyPlayerValues,
  type FantasyStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
  type WeightedMethodKey,
} from "@/lib/valuation/types";

import styles from "@/components/FantasyValueView/FantasyValueView.module.scss";

// The two chart layouts are the only recharts consumers on /players, and the
// table is the default layout. Loading them on demand keeps the chart library
// off every tab's critical path. SSR stays on, so a deep link to a chart
// layout still arrives server-rendered and hydrates in place. The Preloader
// only shows on a client-side switch, while the layout's chunk downloads.
const FantasyValueCharts = dynamic(
  () =>
    import("@/components/FantasyValueCharts/FantasyValueCharts").then(
      (mod) => mod.FantasyValueCharts,
    ),
  { loading: () => <Preloader label="Loading category charts" lines={8} /> },
);

const FantasyValueTrends = dynamic(
  () =>
    import("@/components/FantasyValueTrends/FantasyValueTrends").then(
      (mod) => mod.FantasyValueTrends,
    ),
  { loading: () => <Preloader label="Loading rolling charts" lines={8} /> },
);

// Hovering or focusing a chart layout's keycap starts its chunk download, so
// the click usually lands on a module that is already there. The specifiers
// match the loaders above, so the bundler resolves both to the same chunk. A
// failed prefetch is ignored; the click retries through next/dynamic.
const ignoreFailure = (): undefined => undefined;
const PREFETCH_LAYOUT: Record<FantasyLayout, () => void> = {
  table: () => undefined,
  categories: () =>
    void import("@/components/FantasyValueCharts/FantasyValueCharts").catch(ignoreFailure),
  rolling: () =>
    void import("@/components/FantasyValueTrends/FantasyValueTrends").catch(ignoreFailure),
};

const WINDOW_LABELS: Record<PlayerGameRange, string> = {
  all: "All games",
  last5: "Last 5 games",
  last10: "Last 10 games",
  last20: "Last 20 games",
  last40: "Last 40 games",
  last60: "Last 60 games",
};

const LAYOUT_LABELS: Record<FantasyLayout, string> = {
  table: "Table",
  categories: "Categories",
  rolling: "Rolling",
};

const NEUTRAL_VALUES = (playerId: number): FantasyPlayerValues => ({
  playerId,
  z: 0,
  g: 0,
  points: 0,
  vorp: 0,
  positional: 0,
  sgp: 0,
  sim: 0,
});

const sortField: Record<
  Exclude<FantasySortKey, "firstName" | "lastName">,
  (values: FantasyPlayerValues) => number
> = {
  z: (values) => values.z,
  g: (values) => values.g,
  points: (values) => values.points,
  vorp: (values) => values.vorp,
  pos: (values) => values.positional,
  sgp: (values) => values.sgp,
  sim: (values) => values.sim,
};

export type FantasyValueViewProps = {
  isSignedIn: boolean;
  lines: FantasyStatLine[];
  leagueSeed?: FantasySeed;
};

type RollingRowsProps = {
  logsPromise: Promise<FantasyTrendLogsResult>;
  rows: readonly FantasyTableRow[];
  poolStats: PoolStats;
  config: ValuationConfig;
  methodWeights: MethodWeights;
  windowGames: number;
  sort: FantasySortKey;
  dir: "asc" | "desc";
  isSignedIn: boolean;
  onSort: (args: { sort: FantasySortKey }) => void;
};

// Suspends on the page's game logs, then scores each row's rolling value
// against the pool the view already holds. Kept apart from the view so only
// this subtree waits; the controls, summary, and pager stay interactive.
function RollingRows({
  logsPromise,
  rows,
  poolStats,
  config,
  methodWeights,
  windowGames,
  ...listProps
}: RollingRowsProps) {
  const result: unknown = use(logsPromise);
  // Scoring a page of rolling trends is this layout's heaviest work, so a
  // re-render that changes none of its inputs reuses the last result. Null
  // means the logs failed to load.
  const trendRows = useMemo(() => {
    if (!isFantasyTrendLogsResult(result) || result.status === "error") return null;
    const logsById = new Map(
      result.players.map((player) => [player.playerId, toDatedLogs({ logs: player.logs })]),
    );
    return rows.map((row): FantasyTrendRow => ({
      ...row,
      trend: buildFantasyTrend({
        line: row,
        logs: logsById.get(row.playerId) ?? [],
        poolStats,
        config,
        methodWeights,
        windowGames,
      }),
    }));
  }, [result, rows, poolStats, config, methodWeights, windowGames]);
  if (trendRows === null) {
    return (
      <FantasyValueTrends
        rows={rows.map((row): FantasyTrendRow => ({ ...row, trend: [] }))}
        status="error"
        windowGames={windowGames}
        {...listProps}
      />
    );
  }
  return (
    <FantasyValueTrends rows={trendRows} status="ready" windowGames={windowGames} {...listProps} />
  );
}

// Client orchestrator: URL state in, table out. The server ships the window's
// stat lines once; every config change (weights, exclusions, league size,
// sort, search, paging) recomputes every method's score in memory with no
// round trip.
export function FantasyValueView({ lines, isSignedIn, leagueSeed }: FantasyValueViewProps) {
  const [params, setParams] = useQueryStates(fantasyParsers);

  useEffect(() => {
    if (Object.keys(leagueSeed ?? {}).length === 0) return;
    void setParams(leagueSeed ?? {}, { history: "replace" });
    // Seed exactly once per mount: URL params the user changes afterwards win.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weights belong to the sorted method column; PL Linear and the name sorts
  // have no weight set to edit.
  const activeWeightKey: WeightedMethodKey | null = isWeightedMethodKey(params.sort)
    ? params.sort
    : null;
  const activeWeights = (activeWeightKey && params.w[activeWeightKey]) || {};

  const included = useMemo(
    () => CATEGORY_KEYS.filter((key) => !params.x.some((excluded) => excluded === key)),
    [params.x],
  );
  const basis = params.mode === "total" ? "total" : "perGame";

  const requestedConfig = useMemo(
    (): ValuationConfig => ({
      categories: [...included],
      weights: {},
      basis,
      teams: params.teams,
      rosterSlots: params.slots,
      scoring: params.s,
    }),
    [included, basis, params.teams, params.slots, params.s],
  );

  // Scored in a worker. Until it answers for the requested inputs, everything
  // below renders from the lines, config and weights the values on screen were
  // computed from (`valuation.*`), so rows, breakdowns and trends always agree.
  const valuation = useValuation({
    lines,
    config: requestedConfig,
    methodWeights: params.w,
    windowGames: gamesForRange({ range: params.range }),
  });
  const { values, poolStats } = valuation;

  const scored = useMemo(() => {
    const byId = new Map(values.map((value) => [value.playerId, value]));
    return valuation.lines.map((line) => ({
      line,
      values: byId.get(line.playerId) ?? NEUTRAL_VALUES(line.playerId),
    }));
  }, [valuation.lines, values]);

  const visible = useMemo(() => {
    const query = params.q.trim().toLowerCase();
    const filtered =
      query === ""
        ? scored
        : scored.filter(({ line }) => line.fullName.toLowerCase().includes(query));
    const dirFactor = params.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (params.sort === "firstName" || params.sort === "lastName") {
        const primary =
          params.sort === "firstName"
            ? a.line.firstName.localeCompare(b.line.firstName) ||
              a.line.lastName.localeCompare(b.line.lastName)
            : a.line.lastName.localeCompare(b.line.lastName) ||
              a.line.firstName.localeCompare(b.line.firstName);
        return primary * dirFactor || a.line.playerId - b.line.playerId;
      }
      const metric = sortField[params.sort];
      const difference = metric(a.values) - metric(b.values);
      if (difference !== 0) return difference * dirFactor;
      return a.line.playerId - b.line.playerId;
    });
  }, [scored, params.q, params.sort, params.dir]);

  const total = visible.length;
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const page = Math.min(params.page, totalPages);
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);

  const pageRows = useMemo(
    (): FantasyTableRow[] =>
      visible
        .slice((page - 1) * params.size, page * params.size)
        .map(({ line, values: playerValues }, index) => ({
          ...line,
          values: playerValues,
          rank: (page - 1) * params.size + index + 1,
        })),
    [visible, page, params.size],
  );

  // The rolling layout is the one view that needs more than the pool: each
  // row's season game logs. They are fetched once per page of players, from
  // an effect rather than during render (a server action started mid-render
  // trips React's update-while-rendering check and has no server to call
  // during SSR), and read with `use` inside Suspense below. The promise is
  // keyed by the unordered player set, not the freshly scored row objects:
  // sorting and weight changes reuse it. A newly valued pool invalidates it
  // so a refreshed season/range never reads logs from the previous payload.
  const idsKey = pageRows
    .map((row) => row.playerId)
    .sort((a, b) => a - b)
    .join(",");
  const [logsRequest, setLogsRequest] = useState<{
    idsKey: string;
    lines: readonly FantasyStatLine[];
    promise: Promise<FantasyTrendLogsResult>;
  } | null>(null);
  const requestMatches =
    logsRequest !== null && logsRequest.idsKey === idsKey && logsRequest.lines === valuation.lines;
  useEffect(() => {
    if (params.layout !== "rolling" || idsKey === "" || requestMatches) return;
    setLogsRequest({
      idsKey,
      lines: valuation.lines,
      promise: loadFantasyTrendLogs({ playerIds: idsKey.split(",").map(Number) }),
    });
  }, [params.layout, idsKey, valuation.lines, requestMatches]);
  const logsPromise = requestMatches && logsRequest !== null ? logsRequest.promise : null;
  // The rolling charts follow a Games window the filter names, and fall back
  // to recent form (not the whole season) when the filter is on All games.
  const windowGames = gamesForRange({ range: params.range }) ?? DEFAULT_TREND_GAMES;

  // The categories layout scores only the page in view: fifty breakdowns
  // against a pool already computed, not the whole pool's again.
  const chartRows: FantasyChartRow[] =
    params.layout === "categories"
      ? pageRows.map((row) => ({
          ...row,
          breakdown: buildCategoryBreakdown({
            line: row,
            poolStats,
            config: valuation.config,
            methodWeights: valuation.methodWeights,
          }),
        }))
      : [];
  const chartCategories = CATEGORY_META.filter((meta) =>
    valuation.config.categories.some((key) => key === meta.key),
  );

  const onControlsChange = ({ w, ...rest }: FantasyControlsChange) => {
    // The controls edit a flat weight map; it lands under the sorted column's
    // key so every other column's stored weights stay untouched.
    if (w === undefined || activeWeightKey === null) {
      setParams(rest);
      return;
    }
    const next = WEIGHTED_METHOD_KEYS.reduce<MethodWeights>((acc, key) => {
      const entry = key === activeWeightKey ? w : params.w[key];
      return entry === undefined || Object.keys(entry).length === 0
        ? acc
        : { ...acc, [key]: entry };
    }, {});
    setParams({ ...rest, w: next });
  };

  const onSort = ({ sort }: { sort: FantasySortKey }) => {
    setParams(
      params.sort === sort
        ? { dir: params.dir === "desc" ? "asc" : "desc", page: 1 }
        : { sort, dir: "desc", page: 1 },
    );
  };

  const summary =
    total === 0
      ? params.q === ""
        ? "No players yet — the season data hasn't been synced."
        : `No players match "${params.q}".`
      : `Showing ${rangeStart}–${rangeEnd} of ${total}`;

  return (
    <section className={styles.view}>
      <FantasyControls
        q={params.q}
        range={params.range}
        mode={params.mode}
        excluded={params.x}
        weights={activeWeights}
        sort={params.sort}
        scoring={params.s}
        teams={params.teams}
        slots={params.slots}
        onChange={onControlsChange}
      />
      {!!valuation.lines.length && poolStats.poolSize < 2 && (
        <p className={styles.notice}>
          The player pool is too small to standardize against, so Z-Score and G-Score are neutral.
          Try a wider game range.
        </p>
      )}
      {included.length === 0 && (
        <p className={styles.notice}>
          Every category is excluded, so Z-Score, G-Score, and VORP read zero — add a category to
          see them again.
        </p>
      )}
      <section
        className={styles.results}
        aria-busy={valuation.isPending}
        key={`${params.sort}:${params.dir}:${params.range}:${params.mode}:${page}:${params.layout}`}
      >
        <header className={styles.summaryRow}>
          <p className={styles.summary}>{summary}</p>
          <span className={styles.layoutGroup} role="group" aria-label="Layout">
            {FANTASY_LAYOUTS.map((layout) => (
              <button
                key={layout}
                type="button"
                aria-pressed={params.layout === layout}
                onClick={() => setParams({ layout })}
                onPointerEnter={PREFETCH_LAYOUT[layout]}
                onFocus={PREFETCH_LAYOUT[layout]}
                className={styles.layoutOption}
              >
                {LAYOUT_LABELS[layout]}
              </button>
            ))}
          </span>
        </header>
        {total > 0 && (
          <>
            <FantasyPager
              page={page}
              totalPages={totalPages}
              size={params.size}
              onPageChange={({ page: nextPage }) => setParams({ page: nextPage })}
              onSizeChange={({ size }) => setParams({ size, page: 1 })}
            />
            {params.layout === "categories" && (
              <FantasyValueCharts
                isSignedIn={isSignedIn}
                rows={chartRows}
                categories={chartCategories}
                sort={params.sort}
                dir={params.dir}
                onSort={onSort}
              />
            )}
            {params.layout === "rolling" &&
              (logsPromise === null ? (
                <FantasyValueTrends
                  rows={pageRows.map((row): FantasyTrendRow => ({ ...row, trend: [] }))}
                  status="loading"
                  windowGames={windowGames}
                  isSignedIn={isSignedIn}
                  sort={params.sort}
                  dir={params.dir}
                  onSort={onSort}
                />
              ) : (
                <Suspense
                  fallback={
                    <FantasyValueTrends
                      rows={pageRows.map((row): FantasyTrendRow => ({ ...row, trend: [] }))}
                      status="loading"
                      windowGames={windowGames}
                      isSignedIn={isSignedIn}
                      sort={params.sort}
                      dir={params.dir}
                      onSort={onSort}
                    />
                  }
                >
                  <RollingRows
                    logsPromise={logsPromise}
                    rows={pageRows}
                    poolStats={poolStats}
                    config={valuation.config}
                    methodWeights={valuation.methodWeights}
                    windowGames={windowGames}
                    isSignedIn={isSignedIn}
                    sort={params.sort}
                    dir={params.dir}
                    onSort={onSort}
                  />
                </Suspense>
              ))}
            {params.layout === "table" && (
              <FantasyValueTable
                isSignedIn={isSignedIn}
                rows={pageRows}
                sort={params.sort}
                dir={params.dir}
                onSort={onSort}
              />
            )}
            <FantasyValueLegend
              poolSize={poolStats.poolSize}
              windowLabel={WINDOW_LABELS[params.range]}
              basis={basis}
            />
            <FantasyPager
              page={page}
              totalPages={totalPages}
              size={params.size}
              onPageChange={({ page: nextPage }) => setParams({ page: nextPage })}
              onSizeChange={({ size }) => setParams({ size, page: 1 })}
            />
          </>
        )}
      </section>
    </section>
  );
}
