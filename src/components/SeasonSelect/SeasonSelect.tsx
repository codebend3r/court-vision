"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import { CAREER, statFilterParsers } from "@/lib/stats/searchParams";

import styles from "@/components/SeasonSelect/SeasonSelect.module.scss";

export type SeasonSelectProps = {
  seasons: readonly string[];
  value: string;
};

// The header's season picker. `value` is the server-resolved selection (the
// URL param may be absent while a default season is showing), so the select
// is controlled from props rather than from the param itself.
export function SeasonSelect({ seasons, value }: SeasonSelectProps) {
  const [isPending, startTransition] = useTransition();
  // shallow: false re-runs the RSC page so logs, card, and games count are
  // refetched for the picked season; the transition drives the pending state.
  const [, setFilters] = useQueryStates(statFilterParsers, {
    shallow: false,
    startTransition,
  });

  // A hand-edited URL can request a league season the player never played;
  // without a matching option the controlled select would display the first
  // season while showing another season's (empty) data.
  const optionSeasons = value === CAREER || seasons.includes(value) ? seasons : [value, ...seasons];

  return (
    <select
      value={value}
      onChange={(event) => setFilters({ season: event.target.value })}
      aria-label="Season"
      aria-busy={isPending}
      data-pending={isPending ? "true" : "false"}
      className={styles.select}
    >
      {optionSeasons.map((season) => (
        <option key={season} value={season}>
          {season}
        </option>
      ))}
      <option value={CAREER}>Career</option>
    </select>
  );
}
