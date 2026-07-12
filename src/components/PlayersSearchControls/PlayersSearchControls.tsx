"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useTransition } from "react";

import {
  buildPlayersHref,
  isPlayerGameRange,
  isPlayerStatMode,
  MAX_QUERY_LENGTH,
  type PlayerSortKey,
  type PlayerGameRange,
  type PlayerStatMode,
  type SortDirection,
} from "@/lib/players/searchParams";

import { InfoTip } from "@/components/InfoTip/InfoTip";
import { Switch } from "@/components/Switch/Switch";

import styles from "@/components/PlayersSearchControls/PlayersSearchControls.module.scss";

export type PlayersSearchControlsProps = {
  q: string;
  size: number;
  sort: PlayerSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
};

const DEBOUNCE_MS = 300;

export function PlayersSearchControls({
  q,
  size,
  sort,
  dir,
  range,
  mode,
  minimums,
}: PlayersSearchControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  const navigate = (href: string) => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    startTransition(() => router.replace(href));
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
      navigate(
        buildPlayersHref({
          q: trimmed,
          page: 1,
          size,
          sort,
          dir,
          range,
          mode,
          minimums,
        }),
      );
    }, DEBOUNCE_MS);
  };

  const onRangeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!isPlayerGameRange(event.target.value)) return;
    navigate(
      buildPlayersHref({
        q,
        page: 1,
        size,
        sort,
        dir,
        range: event.target.value,
        mode,
        minimums,
      }),
    );
  };

  const onModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!isPlayerStatMode(event.target.value)) return;
    navigate(
      buildPlayersHref({
        q,
        page: 1,
        size,
        sort,
        dir,
        range,
        mode: event.target.value,
        minimums,
      }),
    );
  };

  const onMinimumsChange = ({ checked }: { checked: boolean }) => {
    navigate(
      buildPlayersHref({
        q,
        page: 1,
        size,
        sort,
        dir,
        range,
        mode,
        minimums: checked,
      }),
    );
  };

  return (
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
          value={range}
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
      <label className={styles.filterLabel}>
        Stats
        <select
          value={mode}
          onChange={onModeChange}
          aria-label="Stat display"
          className={styles.select}
        >
          <option value="average">Averages</option>
          <option value="total">Totals</option>
        </select>
      </label>
      <span className={styles.minimums}>
        <Switch label="Qualifying minimums" checked={minimums} onChange={onMinimumsChange} />
        <InfoTip label="About qualifying minimums">
          <span className={styles.infoIntro}>
            NBA percentage leaders must clear a minimum of made shots to qualify. With this on,
            players below the cutoff drop to the bottom of the sort.
          </span>
          <dl className={styles.infoList}>
            <dt>FG%</dt>
            <dd>300 made field goals</dd>
            <dt>3P%</dt>
            <dd>82 made threes</dd>
            <dt>FT%</dt>
            <dd>125 made free throws</dd>
          </dl>
        </InfoTip>
      </span>
    </section>
  );
}
