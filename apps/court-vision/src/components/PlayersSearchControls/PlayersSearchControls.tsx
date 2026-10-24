"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useOptimistic, useTransition } from "react";

import { OwnerQuickFilter } from "@/components/OwnerQuickFilter/OwnerQuickFilter";
import { MIN_FG3M, MIN_FGM, MIN_FTM } from "@/lib/players/minimums";
import {
  buildPlayersHref,
  GAME_RANGE_LABELS,
  isPlayerGameRange,
  isPlayerStatMode,
  MAX_QUERY_LENGTH,
  PLAYER_GAME_RANGES,
  type PlayerGameRange,
  type PlayerStatMode,
  type PlayersSearchParams,
} from "@/lib/players/searchParams";
import { type PlayerOwnerFilter } from "@/lib/players/ownerFilter";
import { useDebouncedQuery } from "@/lib/players/useDebouncedQuery";

import { InfoTip } from "@vision/ui/components/InfoTip/InfoTip";

import styles from "@/components/PlayersSearchControls/PlayersSearchControls.module.scss";

export type PlayersSearchControlsProps = {
  params: PlayersSearchParams;
};

// The filters a control click changes. Held optimistically so the select or
// keycap shows the user's choice the moment it's made, instead of snapping
// back to the server props until the new results render.
type FilterSelection = {
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
  owner: PlayerOwnerFilter;
};

const applyFilterChange = (
  current: FilterSelection,
  change: Partial<FilterSelection>,
): FilterSelection => ({ ...current, ...change });

export function PlayersSearchControls({ params }: PlayersSearchControlsProps) {
  const { q, range, mode, minimums, owner, tab } = params;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Reverts to the props once the navigation's transition settles, so the
  // server's parsed params always have the final word.
  const [selection, setSelection] = useOptimistic(
    { range, mode, minimums, owner },
    applyFilterChange,
  );
  const search = useDebouncedQuery({ q, onCommit: ({ q: query }) => navigate({ query }) });

  // Builds from the optimistic selection, not the props, so a second change
  // made before the first lands keeps the first instead of undoing it.
  const navigate = ({
    query = q,
    change = {},
  }: {
    query?: string;
    change?: Partial<FilterSelection>;
  }) => {
    search.cancel();
    const href = buildPlayersHref({
      ...params,
      q: query,
      page: 1,
      ...applyFilterChange(selection, change),
    });
    startTransition(() => {
      setSelection(change);
      router.replace(href);
    });
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
          onChange={search.onChange}
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
            {PLAYER_GAME_RANGES.map((gameRange) => (
              <option key={gameRange} value={gameRange}>
                {GAME_RANGE_LABELS[gameRange]}
              </option>
            ))}
          </select>
        </label>
        <OwnerQuickFilter
          value={selection.owner}
          onChange={(next) => navigate({ change: { owner: next } })}
        />
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
                <dd>{`${MIN_FGM} made field goals`}</dd>
                <dt>3P%</dt>
                <dd>{`${MIN_FG3M} made threes`}</dd>
                <dt>FT%</dt>
                <dd>{`${MIN_FTM} made free throws`}</dd>
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
