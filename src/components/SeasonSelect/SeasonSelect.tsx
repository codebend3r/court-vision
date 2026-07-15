"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import { CAREER_SCOPE, seasonScopeParsers } from "@/lib/players/seasonScope";

import styles from "@/components/SeasonSelect/SeasonSelect.module.scss";

export type SeasonSelectProps = {
  seasons: readonly string[];
  value: string;
};

export function SeasonSelect({ seasons, value }: SeasonSelectProps) {
  const [isPending, startTransition] = useTransition();
  // shallow: false re-runs the RSC page so the whole view (card, chart, log
  // table) recomputes for the chosen season; the transition drives the dim.
  const [, setScope] = useQueryStates(seasonScopeParsers, {
    shallow: false,
    startTransition,
  });

  return (
    <section
      className={styles.wrap}
      data-pending={isPending ? "true" : "false"}
      aria-busy={isPending}
    >
      <label className={styles.label}>
        Season
        <select
          className={styles.select}
          value={value}
          onChange={(event) => setScope({ season: event.target.value })}
        >
          {seasons.map((season) => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
          <option value={CAREER_SCOPE}>Career</option>
        </select>
      </label>
    </section>
  );
}
