"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useTransition } from "react";

import {
  buildPlayersHref,
  MAX_QUERY_LENGTH,
  PAGE_SIZES,
  type PlayerSortKey,
  type SortDirection,
} from "@/lib/players/searchParams";

import styles from "./PlayersSearchControls.module.scss";

export interface PlayersSearchControlsProps {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
  totalPages: number;
  sort: PlayerSortKey;
  dir: SortDirection;
}

const DEBOUNCE_MS = 300;

export function PlayersSearchControls({
  q,
  page,
  size,
  includeRetired,
  totalPages,
  sort,
  dir,
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
      navigate(buildPlayersHref({ q: trimmed, page: 1, size, includeRetired, sort, dir }));
    }, DEBOUNCE_MS);
  };

  const onSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number.parseInt(event.target.value, 10);
    navigate(buildPlayersHref({ q, page: 1, size: newSize, includeRetired, sort, dir }));
  };

  const onRetiredChange = () => {
    navigate(buildPlayersHref({ q, page: 1, size, includeRetired: !includeRetired, sort, dir }));
  };

  const onPrev = () => {
    navigate(buildPlayersHref({ q, page: page - 1, size, includeRetired, sort, dir }));
  };

  const onNext = () => {
    navigate(buildPlayersHref({ q, page: page + 1, size, includeRetired, sort, dir }));
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
      <select value={size} onChange={onSizeChange} aria-label="Page size" className={styles.select}>
        {PAGE_SIZES.map((pageSize) => (
          <option key={pageSize} value={pageSize}>
            {pageSize}
          </option>
        ))}
      </select>
      <label className={styles.retiredLabel}>
        <input type="checkbox" checked={includeRetired} onChange={onRetiredChange} />
        Include retired players
      </label>
      <div className={styles.pager}>
        <button type="button" onClick={onPrev} disabled={page <= 1} className={styles.pagerButton}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className={styles.pagerButton}
        >
          Next
        </button>
      </div>
    </section>
  );
}
