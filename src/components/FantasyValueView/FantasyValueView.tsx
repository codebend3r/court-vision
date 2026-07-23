"use client";

import { useQueryStates } from "nuqs";
import { useMemo } from "react";

import {
  FantasyControls,
  type FantasyControlsChange,
} from "@/components/FantasyControls/FantasyControls";
import { FantasyPager } from "@/components/FantasyPager/FantasyPager";
import { FantasyValueLegend } from "@/components/FantasyValueLegend/FantasyValueLegend";
import {
  type FantasyTableRow,
  FantasyValueTable,
} from "@/components/FantasyValueTable/FantasyValueTable";
import styles from "@/components/FantasyValueView/FantasyValueView.module.scss";
import type { PlayerGameRange } from "@/lib/players/searchParams";
import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { valuePlayers } from "@/lib/valuation/index";
import { type FantasySortKey, fantasyParsers } from "@/lib/valuation/searchParams";
import type { FantasyPlayerValues, FantasyStatLine } from "@/lib/valuation/types";

const WINDOW_LABELS: Record<PlayerGameRange, string> = {
  all: "All games",
  last5: "Last 5 games",
  last10: "Last 10 games",
  last20: "Last 20 games",
  last40: "Last 40 games",
  last60: "Last 60 games",
};

const NEUTRAL_VALUES = (playerId: number): FantasyPlayerValues => ({
  playerId,
  z: 0,
  g: 0,
  points: 0,
  vorp: 0,
  positional: 0,
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
};

export type FantasyValueViewProps = {
  lines: FantasyStatLine[];
};

// Client orchestrator: URL state in, table out. The server ships the window's
// stat lines once; every config change (weights, exclusions, league size,
// sort, search, paging) recomputes every method's score in memory with no
// round trip.
export function FantasyValueView({ lines }: FantasyValueViewProps) {
  const [params, setParams] = useQueryStates(fantasyParsers);

  const included = useMemo(
    () => CATEGORY_KEYS.filter((key) => !params.x.some((excluded) => excluded === key)),
    [params.x],
  );
  const basis = params.mode === "total" ? "total" : "perGame";

  const { values, poolStats } = useMemo(
    () =>
      valuePlayers({
        lines,
        config: {
          categories: [...included],
          weights: params.w,
          basis,
          teams: params.teams,
          rosterSlots: params.slots,
        },
        range: params.range,
      }),
    [lines, included, params.w, basis, params.teams, params.slots, params.range],
  );

  const scored = useMemo(() => {
    const byId = new Map(values.map((value) => [value.playerId, value]));
    return lines.map((line) => ({
      line,
      values: byId.get(line.playerId) ?? NEUTRAL_VALUES(line.playerId),
    }));
  }, [lines, values]);

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

  const pageRows: FantasyTableRow[] = visible
    .slice((page - 1) * params.size, page * params.size)
    .map(({ line, values: playerValues }, index) => ({
      ...line,
      values: playerValues,
      rank: (page - 1) * params.size + index + 1,
    }));

  const onControlsChange = (change: FantasyControlsChange) => {
    setParams(change);
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
        weights={params.w}
        teams={params.teams}
        slots={params.slots}
        onChange={onControlsChange}
      />
      {!!lines.length && poolStats.poolSize < 2 && (
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
        key={`${params.sort}:${params.dir}:${params.range}:${params.mode}:${page}`}
      >
        <p className={styles.summary}>{summary}</p>
        {total > 0 && (
          <>
            <FantasyPager
              page={page}
              totalPages={totalPages}
              size={params.size}
              onPageChange={({ page: nextPage }) => setParams({ page: nextPage })}
              onSizeChange={({ size }) => setParams({ size, page: 1 })}
            />
            <FantasyValueTable
              rows={pageRows}
              sort={params.sort}
              dir={params.dir}
              onSort={onSort}
            />
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
