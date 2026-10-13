import { useEffect, useState } from "react";

import { loadFantasyTrendLogs } from "@/lib/valuation/actions";
import { type FantasyTrendLogsResult } from "@/lib/valuation/trendLogs";
import { type FantasyStatLine } from "@/lib/valuation/types";

type LoadTrendLogs = (args: { playerIds: number[] }) => Promise<FantasyTrendLogsResult>;

type TrendLogsRequest = {
  idsKey: string;
  lines: readonly FantasyStatLine[];
  promise: Promise<FantasyTrendLogsResult>;
};

// The rolling layout's game logs for the page in view, or null until they
// are requested. They are fetched from an effect rather than during render (a
// server action started mid-render trips React's update-while-rendering check
// and has no server to call during SSR), and the caller reads the promise
// with `use` inside Suspense. The request is keyed by the unordered player
// set, not the freshly scored row objects, so sorting and weight changes
// reuse it; a newly valued pool (`lines`) invalidates it so a refreshed
// season or range never reads logs from the previous payload.
export const useTrendLogs = ({
  enabled,
  pageRows,
  lines,
  load = loadFantasyTrendLogs,
}: {
  enabled: boolean;
  pageRows: readonly { playerId: number }[];
  lines: readonly FantasyStatLine[];
  load?: LoadTrendLogs;
}): Promise<FantasyTrendLogsResult> | null => {
  const idsKey = pageRows
    .map((row) => row.playerId)
    .toSorted((a, b) => a - b)
    .join(",");
  const [request, setRequest] = useState<TrendLogsRequest | null>(null);
  const promise =
    request !== null && request.idsKey === idsKey && request.lines === lines
      ? request.promise
      : null;
  const isCurrent = promise !== null;

  useEffect(() => {
    if (!enabled || idsKey === "" || isCurrent) return;
    setRequest({ idsKey, lines, promise: load({ playerIds: idsKey.split(",").map(Number) }) });
  }, [enabled, idsKey, lines, isCurrent, load]);

  return promise;
};
