"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useOptimistic, useRef, useTransition } from "react";

import {
  buildPlayersHref,
  isPlayerGameRange,
  isPlayerStatMode,
  MAX_QUERY_LENGTH,
  type AdvancedSortKey,
  type PlayerSortKey,
  type PlayerGameRange,
  type PlayerStatMode,
  type PlayersTab,
  type SortDirection,
} from "@/lib/players/searchParams";

import { InfoTip } from "@/components/InfoTip/InfoTip";

import styles from "@/components/PlayersSearchControls/PlayersSearchControls.module.scss";

export type PlayersSearchControlsProps = {
  q: string;
  size: number;
  sort: PlayerSortKey | AdvancedSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
  tab?: PlayersTab;
};

const DEBOUNCE_MS = 300;

// The filters a control click changes. Held optimistically so the select or
// keycap shows the user's choice the moment it's made, instead of snapping
// back to the server props until the new results render.
type FilterSelection = {
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
};

const applyFilterChange = (
  current: FilterSelection,
  change: Partial<FilterSelection>,
): FilterSelection => ({ ...current, ...change });

export function PlayersSearchControls({
  q,
  size,
  sort,
  dir,
  range,
  mode,
  minimums,
  tab = "regular",
}: PlayersSearchControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Reverts to the props once the navigation's transition settles, so the
  // server's parsed params always have the final word.
  const [selection, setSelection] = useOptimistic({ range, mode, minimums }, applyFilterChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQ = useRef(q);

  useEffect(() => {
    latestQ.current = q;
  }, [q]);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  // Builds from the optimistic selection, not the props, so a second change
  // made before the first lands keeps the first instead of undoing it.
  const navigate = ({
    query = q,
    change = {},
  }: {
    query?: string;
    change?: Partial<FilterSelection>;
  }) => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const href = buildPlayersHref({
      q: query,
      page: 1,
      size,
      sort,
      dir,
      tab,
      ...applyFilterChange(selection, change),
    });
    startTransition(() => {
      setSelection(change);
      router.replace(href);
    });
  };

  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim().slice(0, MAX_QUERY_LENGTH);
      if (trimmed === latestQ.current) {
        return;
      }
      navigate({ query: trimmed });
    }, DEBOUNCE_MS);
  };

  const onRangeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!isPlayerGameRange(event.target.value)) return;
    navigate({ change: { range: event.target.value } });
  };

  const onModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!isPlayerStatMode(event.target.value)) return;
    navigate({ change: { mode: event.target.value } });
  };

  const onMinimumsChange = ({ checked }: { checked: boolean }) => {
    navigate({ change: { minimums: checked } });
  };

  return (
    <>
      <section
        className={styles.controls}
        data-pending={isPending ? "true" : "false"}
        aria-busy={isPending}
      >
        <input
          type="search"
          defaultValue={q}
          onChange={onSearchChange}
          placeholder="Search players…"
          aria-label="Search players"
          maxLength={MAX_QUERY_LENGTH}
          className={styles.search}
        />
        <label className={styles.filterLabel}>
          Games
          <select
            value={selection.range}
            onChange={onRangeChange}
            aria-label="Game range"
            className={styles.select}
          >
            <option value="all">All games</option>
            <option value="last5">Last 5 games</option>
            <option value="last10">Last 10 games</option>
            <option value="last20">Last 20 games</option>
            <option value="last40">Last 40 games</option>
            <option value="last60">Last 60 games</option>
          </select>
        </label>
        {tab === "regular" && (
          <label className={styles.filterLabel}>
            Stats
            <select
              value={selection.mode}
              onChange={onModeChange}
              aria-label="Stat display"
              className={styles.select}
            >
              <option value="average">Averages</option>
              <option value="total">Totals</option>
            </select>
          </label>
        )}
        {tab === "regular" && (
          <span className={styles.minimums} role="group" aria-label="Qualifying minimums">
            <span className={styles.minimumsLabel}>Qualifying minimums</span>
            <button
              type="button"
              className={styles.minimumsOption}
              aria-pressed={selection.minimums}
              onClick={() => onMinimumsChange({ checked: true })}
            >
              On
            </button>
            <button
              type="button"
              className={styles.minimumsOption}
              aria-pressed={!selection.minimums}
              onClick={() => onMinimumsChange({ checked: false })}
            >
              Off
            </button>
            <InfoTip label="About qualifying minimums">
              <span className={styles.infoIntro}>
                NBA leaders must qualify: percentage leaders by made shots, per-game leaders by
                games played. With this on, players below the cutoff drop to the bottom of the sort.
              </span>
              <dl className={styles.infoList}>
                <dt>FG%</dt>
                <dd>300 made field goals</dd>
                <dt>3P%</dt>
                <dd>82 made threes</dd>
                <dt>FT%</dt>
                <dd>125 made free throws</dd>
                <dt>Per game</dt>
                <dd>70% of the selected span (58 of 82 games)</dd>
              </dl>
            </InfoTip>
          </span>
        )}
      </section>
      {/* A sibling, not a child: some screen readers hold back live updates
          inside an aria-busy subtree until it settles, which here would be
          after the new results have already landed. */}
      <span role="status" className={styles.status}>
        {isPending && "Updating players…"}
      </span>
    </>
  );
}
