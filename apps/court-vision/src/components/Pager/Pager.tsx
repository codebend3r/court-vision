"use client";

import { ChangeEvent } from "react";

import { PAGE_SIZES } from "@/lib/players/searchParams";

import styles from "@/components/Pager/Pager.module.scss";

export type PagerProps = {
  page: number;
  size: number;
  totalPages: number;
  // False while a new page size is in flight: the total was counted at the old
  // size, so stating it would name a count that's about to change.
  isTotalKnown?: boolean;
  // Dims the bar while the requested page loads.
  isPending?: boolean;
  onPageChange: (args: { page: number }) => void;
  onSizeChange: (args: { size: number }) => void;
};

// The players lists' pagination bar: page size, the page count in mono, then
// Prev/Next keycaps. Presentational; the caller decides what a change does
// (a route change for the server-ranked tabs, URL state for Fantasy).
export function Pager({
  page,
  size,
  totalPages,
  isTotalKnown = true,
  isPending = false,
  onPageChange,
  onSizeChange,
}: PagerProps) {
  const onSize = (event: ChangeEvent<HTMLSelectElement>) => {
    onSizeChange({ size: Number.parseInt(event.target.value, 10) });
  };

  return (
    <nav
      className={styles.pager}
      aria-label="Pagination"
      data-pending={isPending ? "true" : "false"}
      aria-busy={isPending}
    >
      <label className={styles.sizeLabel}>
        Page size
        <select value={size} onChange={onSize} className={styles.select}>
          {PAGE_SIZES.map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </label>
      <span className={styles.pageCount}>
        Page {page}
        {isTotalKnown && ` of ${totalPages}`}
      </span>
      <span className={styles.buttons}>
        <button
          type="button"
          onClick={() => onPageChange({ page: page - 1 })}
          disabled={page <= 1}
          className={styles.pagerButton}
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange({ page: page + 1 })}
          disabled={page >= totalPages}
          className={styles.pagerButton}
        >
          Next
        </button>
      </span>
    </nav>
  );
}
