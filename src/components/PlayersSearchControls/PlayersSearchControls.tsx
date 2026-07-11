"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useTransition } from "react";

import { DEFAULT_PAGE_SIZE, MAX_QUERY_LENGTH, PAGE_SIZES } from "@/lib/players/searchParams";

import styles from "./PlayersSearchControls.module.scss";

export interface PlayersSearchControlsProps {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
  totalPages: number;
}

const DEBOUNCE_MS = 300;

const buildHref = (args: {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
}): string => {
  const params = new URLSearchParams();
  if (args.q !== "") {
    params.set("q", args.q);
  }
  if (args.page > 1) {
    params.set("page", String(args.page));
  }
  if (args.size !== DEFAULT_PAGE_SIZE) {
    params.set("size", String(args.size));
  }
  if (args.includeRetired) {
    params.set("retired", "1");
  }
  const query = params.toString();
  return query === "" ? "/players" : `/players?${query}`;
};

export function PlayersSearchControls({
  q,
  page,
  size,
  includeRetired,
  totalPages,
}: PlayersSearchControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  const navigate = (href: string) => {
    startTransition(() => router.replace(href));
  };

  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim().slice(0, MAX_QUERY_LENGTH);
      if (trimmed === q) {
        return;
      }
      navigate(buildHref({ q: trimmed, page: 1, size, includeRetired }));
    }, DEBOUNCE_MS);
  };

  const onSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number.parseInt(event.target.value, 10);
    navigate(buildHref({ q, page: 1, size: newSize, includeRetired }));
  };

  const onRetiredChange = () => {
    navigate(buildHref({ q, page: 1, size, includeRetired: !includeRetired }));
  };

  const onPrev = () => {
    navigate(buildHref({ q, page: page - 1, size, includeRetired }));
  };

  const onNext = () => {
    navigate(buildHref({ q, page: page + 1, size, includeRetired }));
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
