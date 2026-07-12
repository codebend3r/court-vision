"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";

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

const SPAN_LABELS: Record<StatSpan, string> = {
  "5": "L5",
  "10": "L10",
  "20": "L20",
  "40": "L40",
  "60": "L60",
  season: "Season",
};

export function PlayerStatFilters() {
  const [isPending, startTransition] = useTransition();
  // shallow: false re-runs the RSC page so the series is recomputed
  // server-side; the transition drives the pending state while it streams.
  const [{ mode, span }, setFilters] = useQueryStates(statFilterParsers, {
    shallow: false,
    startTransition,
  });

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
            onClick={() => setFilters({ mode: option })}
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
