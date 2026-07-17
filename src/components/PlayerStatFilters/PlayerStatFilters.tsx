"use client";

import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useTransition } from "react";

import { useStatModeStore } from "@/lib/stats/modeStore";
import {
  STAT_MODES,
  STAT_SPANS,
  statFilterParsers,
  type StatMode,
  type StatSpan,
} from "@/lib/stats/searchParams";

import styles from "@/components/PlayerStatFilters/PlayerStatFilters.module.scss";

const MODE_LABELS: Record<StatMode, string> = {
  avg: "Avg",
  game: "Game",
  totals: "Totals",
  per36: "Per 36",
};

// The "season" span means the entire current selection, which the header
// dropdown can point at a single season or the whole career, so the label
// reads "All" rather than "Season".
const SPAN_LABELS: Record<StatSpan, string> = {
  "5": "L5",
  "10": "L10",
  "20": "L20",
  "40": "L40",
  "60": "L60",
  season: "All",
};

export function PlayerStatFilters() {
  const [isPending, startTransition] = useTransition();
  // shallow: false re-runs the RSC page so the series is recomputed
  // server-side; the transition drives the pending state while it streams.
  const [{ mode, span }, setFilters] = useQueryStates(statFilterParsers, {
    shallow: false,
    startTransition,
  });
  const preferredMode = useStatModeStore((state) => state.mode);
  const setPreferredMode = useStatModeStore((state) => state.setMode);
  // A shared link's explicit ?mode= wins over the remembered preference, so
  // only bare URLs (fresh navigations between players) re-apply it.
  const urlNamesMode = !!(useSearchParams()?.get("mode") ?? "");

  useEffect(() => {
    // While a click's transition is pending the store already holds the new
    // mode but the URL doesn't yet; skip so the pick isn't written twice.
    if (!urlNamesMode && !isPending && mode !== preferredMode) {
      setFilters({ mode: preferredMode });
    }
  }, [urlNamesMode, isPending, mode, preferredMode, setFilters]);

  return (
    <section
      className={styles.filters}
      data-pending={isPending ? "true" : "false"}
      aria-busy={isPending}
    >
      <div className={styles.group} role="group" aria-label="Stat mode">
        {STAT_MODES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => {
              setPreferredMode({ mode: option });
              setFilters({ mode: option });
            }}
            className={styles.option}
          >
            {MODE_LABELS[option]}
          </button>
        ))}
      </div>
      <div className={styles.group} role="group" aria-label="Timeframe">
        {STAT_SPANS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={span === option}
            onClick={() => setFilters({ span: option })}
            className={styles.option}
          >
            {SPAN_LABELS[option]}
          </button>
        ))}
      </div>
    </section>
  );
}
