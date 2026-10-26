"use client";

import { useEffect, useMemo } from "react";
import { useQueryStates } from "nuqs";

import {
  FantasyControls,
  type FantasyControlsChange,
} from "@/components/FantasyControls/FantasyControls";
import type { FantasyChartRow } from "@/components/FantasyValueCharts/FantasyValueCharts";
import { FantasyValueLegend } from "@/components/FantasyValueLegend/FantasyValueLegend";
import { FantasyValueTable } from "@/components/FantasyValueTable/FantasyValueTable";
import {
  FantasyValueCharts,
  LAYOUT_LABELS,
  PREFETCH_LAYOUT,
} from "@/components/FantasyValueView/layouts";
import { RollingLayout } from "@/components/FantasyValueView/RollingLayout";
import { useTrendLogs } from "@/components/FantasyValueView/useTrendLogs";
import { useValuation } from "@/components/FantasyValueView/useValuation";
import { Pager } from "@/components/Pager/Pager";
import { type FantasySeed } from "@/lib/leagues/fantasyDefaults";
import { useTakenIds } from "@/lib/leagues/rosteredStore";
import { filterByOwner } from "@/lib/players/ownerFilter";
import { GAME_RANGE_LABELS, gamesForRange } from "@/lib/players/searchParams";
import {
  buildCategoryBreakdown,
  CATEGORY_KEYS,
  CATEGORY_META,
} from "@vision/sport-basketball/engine";
import { type ValuationConfig } from "@vision/sport-basketball/types";
import { isWeightedMethodKey } from "@vision/core/valuation/registry";
import { DEFAULT_TREND_GAMES } from "@vision/core/valuation/trend";
import { type WeightedMethodKey } from "@vision/core/valuation/types";
import { rankFantasyRows, type ListSortProps } from "@/lib/valuation/fantasyRows";
import { FANTASY_LAYOUTS, fantasyParsers, type FantasySortKey } from "@/lib/valuation/searchParams";
import { type FantasyStatLine } from "@/lib/valuation/types";
import { setColumnWeights } from "@/lib/valuation/weights";

import styles from "@/components/FantasyValueView/FantasyValueView.module.scss";

export type FantasyValueViewProps = {
  isSignedIn: boolean;
  lines: FantasyStatLine[];
  leagueSeed?: FantasySeed;
  // Lists only these players (a team's roster). Every score is still standardized
  // against the whole pool, so a player's number is the same here as on /players.
  rosterPlayerIds?: readonly number[];
};

// Client orchestrator: URL state in, table out. The server ships the window's
// stat lines once; every config change (weights, exclusions, league size,
// sort, search, paging) recomputes every method's score in memory with no
// round trip.
export function FantasyValueView({
  lines,
  isSignedIn,
  leagueSeed,
  rosterPlayerIds,
}: FantasyValueViewProps) {
  const [params, setParams] = useQueryStates(fantasyParsers);
  const takenIds = useTakenIds();

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

  // Scored on the whole pool above, listed here: the roster's rows, and only those.
  const listedLines = useMemo(() => {
    const onRoster =
      rosterPlayerIds === undefined
        ? valuation.lines
        : valuation.lines.filter((line) => rosterPlayerIds.includes(line.playerId));
    return filterByOwner({
      rows: onRoster,
      owner: params.owner,
      takenIds,
      idOf: (line) => line.playerId,
    });
  }, [valuation.lines, rosterPlayerIds, params.owner, takenIds]);

  const {
    rows: pageRows,
    total,
    page,
  } = useMemo(
    () =>
      rankFantasyRows({
        lines: listedLines,
        values,
        q: params.q,
        page: params.page,
        size: params.size,
        dir: params.dir,
        sort: params.sort,
      }),
    [listedLines, values, params.q, params.page, params.size, params.dir, params.sort],
  );
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);

  // The rolling layout is the one view that needs more than the pool: each
  // row's season game logs, fetched once per page of players.
  const logsPromise = useTrendLogs({
    enabled: params.layout === "rolling",
    pageRows,
    lines: valuation.lines,
  });

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
    setParams(
      w === undefined || activeWeightKey === null
        ? rest
        : {
            ...rest,
            w: setColumnWeights({ methodWeights: params.w, key: activeWeightKey, weights: w }),
          },
    );
  };

  type OnSortProps = { sort: FantasySortKey };

  const onSort = ({ sort }: OnSortProps) => {
    setParams(
      params.sort === sort
        ? { dir: params.dir === "desc" ? "asc" : "desc", page: 1 }
        : { sort, dir: "desc", page: 1 },
    );
  };

  const listProps: ListSortProps = { sort: params.sort, dir: params.dir, isSignedIn, onSort };

  const summary =
    total === 0
      ? params.q === ""
        ? "No players yet — the season data hasn't been synced."
        : `No players match "${params.q}".`
      : `Showing ${rangeStart}–${rangeEnd} of ${total}`;

  // A roster is one short page, so a pager would only offer a page size to change.
  const pager = rosterPlayerIds === undefined && (
    <Pager
      page={page}
      totalPages={totalPages}
      size={params.size}
      onPageChange={({ page: nextPage }) => setParams({ page: nextPage })}
      onSizeChange={({ size }) => setParams({ size, page: 1 })}
    />
  );

  return (
    <section className={styles.view}>
      <FantasyControls
        q={params.q}
        range={params.range}
        mode={params.mode}
        owner={params.owner}
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
        key={`${params.sort}:${params.dir}:${params.range}:${params.mode}:${params.owner}:${page}:${params.layout}`}
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
            {pager}
            {params.layout === "categories" && (
              <FantasyValueCharts rows={chartRows} categories={chartCategories} {...listProps} />
            )}
            {params.layout === "rolling" && (
              <RollingLayout
                logsPromise={logsPromise}
                rows={pageRows}
                valuation={valuation}
                // The rolling charts follow a Games window the filter names,
                // and fall back to recent form (not the whole season) on All.
                windowGames={gamesForRange({ range: params.range }) ?? DEFAULT_TREND_GAMES}
                {...listProps}
              />
            )}
            {params.layout === "table" && <FantasyValueTable rows={pageRows} {...listProps} />}
            <FantasyValueLegend
              poolSize={poolStats.poolSize}
              windowLabel={GAME_RANGE_LABELS[params.range]}
              basis={basis}
            />
            {pager}
          </>
        )}
      </section>
    </section>
  );
}
