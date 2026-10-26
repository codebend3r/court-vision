"use client";

import { Suspense, use, useMemo } from "react";

import type { FantasyTrendRow } from "@/components/FantasyValueTrends/FantasyValueTrends";
import { FantasyValueTrends } from "@/components/FantasyValueView/layouts";
import { type Valuation } from "@/components/FantasyValueView/useValuation";
import { buildFantasyTrend } from "@vision/sport-basketball/engine";
import { type FantasyTableRow, type ListSortProps } from "@/lib/valuation/fantasyRows";
import {
  isFantasyTrendLogsResult,
  toDatedLogs,
  type FantasyTrendLogsResult,
} from "@/lib/valuation/trendLogs";

export type RollingLayoutProps = ListSortProps & {
  // The page's game logs, or null until they are requested.
  logsPromise: Promise<FantasyTrendLogsResult> | null;
  rows: readonly FantasyTableRow[];
  // The pool, config and weights the rows' values were computed from.
  valuation: Pick<Valuation, "poolStats" | "config" | "methodWeights">;
  // How many of each player's most recent games the charts cover.
  windowGames: number;
};

// A page's rows before (or without) their game logs: each chart row draws its
// placeholder.
type UntrendedRowsProps = { rows: readonly FantasyTableRow[] };

const untrendedRows = ({ rows }: UntrendedRowsProps): FantasyTrendRow[] =>
  rows.map((row) => ({ ...row, trend: [] }));

// Suspends on the page's game logs, then scores each row's rolling value
// against the pool the view already holds.
type RollingRowsProps = RollingLayoutProps & { logsPromise: Promise<FantasyTrendLogsResult> };

function RollingRows({
  logsPromise,
  rows,
  valuation: { poolStats, config, methodWeights },
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
  return (
    <FantasyValueTrends
      rows={trendRows ?? untrendedRows({ rows })}
      status={trendRows === null ? "error" : "ready"}
      windowGames={windowGames}
      {...listProps}
    />
  );
}

// The Rolling layout: placeholders until the logs are requested and while
// they load, then the scored trends. Only this subtree waits; the controls,
// summary, and pager stay interactive.
export function RollingLayout({
  logsPromise,
  rows,
  valuation,
  windowGames,
  ...listProps
}: RollingLayoutProps) {
  const loading = (
    <FantasyValueTrends
      rows={untrendedRows({ rows })}
      status="loading"
      windowGames={windowGames}
      {...listProps}
    />
  );
  if (logsPromise === null) return loading;
  return (
    <Suspense fallback={loading}>
      <RollingRows
        logsPromise={logsPromise}
        rows={rows}
        valuation={valuation}
        windowGames={windowGames}
        {...listProps}
      />
    </Suspense>
  );
}
