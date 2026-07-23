"use client";

import type { ChangeEvent } from "react";
import styles from "@/components/FantasyPager/FantasyPager.module.scss";
import { PAGE_SIZES } from "@/lib/players/searchParams";

export type FantasyPagerProps = {
  page: number;
  totalPages: number;
  size: number;
  onPageChange: (args: { page: number }) => void;
  onSizeChange: (args: { size: number }) => void;
};

// Visual twin of PlayersPager, but callback-driven: fantasy pagination is
// client state (nuqs shallow), so a router round trip would be wasted work.
export function FantasyPager({
  page,
  totalPages,
  size,
  onPageChange,
  onSizeChange,
}: FantasyPagerProps) {
  const onSize = (event: ChangeEvent<HTMLSelectElement>) => {
    onSizeChange({ size: Number.parseInt(event.target.value, 10) });
  };

  return (
    <nav className={styles.pager} aria-label="Pagination">
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
      <button
        type="button"
        onClick={() => onPageChange({ page: page - 1 })}
        disabled={page <= 1}
        className={styles.pagerButton}
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange({ page: page + 1 })}
        disabled={page >= totalPages}
        className={styles.pagerButton}
      >
        Next
      </button>
    </nav>
  );
}
