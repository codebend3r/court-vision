"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useTransition } from "react";
import styles from "@/components/PlayersPager/PlayersPager.module.scss";
import {
  type AdvancedSortKey,
  buildPlayersHref,
  PAGE_SIZES,
  type PlayerGameRange,
  type PlayerSortKey,
  type PlayerStatMode,
  type PlayersTab,
  type SortDirection,
} from "@/lib/players/searchParams";

export type PlayersPagerProps = {
  q: string;
  page: number;
  size: number;
  totalPages: number;
  sort: PlayerSortKey | AdvancedSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
  tab?: PlayersTab;
};

export function PlayersPager({
  q,
  page,
  size,
  totalPages,
  sort,
  dir,
  range,
  mode,
  minimums,
  tab = "regular",
}: PlayersPagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goTo = ({ nextPage, nextSize }: { nextPage: number; nextSize?: number }) => {
    startTransition(() => {
      router.replace(
        buildPlayersHref({
          q,
          page: nextPage,
          size: nextSize ?? size,
          sort,
          dir,
          range,
          mode,
          minimums,
          tab,
        }),
      );
    });
  };

  const onSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    // A larger or smaller page reshuffles the rows, so return to page 1.
    goTo({ nextPage: 1, nextSize: Number.parseInt(event.target.value, 10) });
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
        <select value={size} onChange={onSizeChange} className={styles.select}>
          {PAGE_SIZES.map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => goTo({ nextPage: page - 1 })}
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
        onClick={() => goTo({ nextPage: page + 1 })}
        disabled={page >= totalPages}
        className={styles.pagerButton}
      >
        Next
      </button>
    </nav>
  );
}
