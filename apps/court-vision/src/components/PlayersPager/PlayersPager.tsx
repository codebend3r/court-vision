"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useOptimistic, useTransition } from "react";

import {
  buildPlayersHref,
  PAGE_SIZES,
  type AdvancedSortKey,
  type PlayerGameRange,
  type PlayerSortKey,
  type PlayerStatMode,
  type PlayersTab,
  type SortDirection,
} from "@/lib/players/searchParams";

import styles from "@/components/PlayersPager/PlayersPager.module.scss";

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

// Where the reader asked to be. Held optimistically so the page count, the
// Prev/Next bounds, and the size select move on the click instead of waiting
// for the server render behind the navigation.
type PageSelection = {
  page: number;
  size: number;
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
  // Reverts to the props once the navigation's transition settles, so the
  // server's clamped page always has the final word.
  const [selection, setSelection] = useOptimistic<PageSelection>({ page, size });

  // Steps from the optimistic page, so a second Next pressed before the first
  // lands moves on again instead of requesting the same page twice.
  const goTo = ({
    nextPage,
    nextSize = selection.size,
  }: {
    nextPage: number;
    nextSize?: number;
  }) => {
    const next = { page: nextPage, size: nextSize };
    startTransition(() => {
      setSelection(next);
      router.replace(
        buildPlayersHref({
          q,
          ...next,
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

  // `totalPages` was counted at the old size; until the server answers for the
  // new one, showing it would state a total that's about to change.
  const isTotalKnown = selection.size === size;

  return (
    <>
      <nav
        className={styles.pager}
        aria-label="Pagination"
        data-pending={isPending ? "true" : "false"}
        aria-busy={isPending}
      >
        <label className={styles.sizeLabel}>
          Page size
          <select value={selection.size} onChange={onSizeChange} className={styles.select}>
            {PAGE_SIZES.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.pageCount}>
          Page {selection.page}
          {isTotalKnown && ` of ${totalPages}`}
        </span>
        <span className={styles.buttons}>
          <button
            type="button"
            onClick={() => goTo({ nextPage: selection.page - 1 })}
            disabled={selection.page <= 1}
            className={styles.pagerButton}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => goTo({ nextPage: selection.page + 1 })}
            disabled={selection.page >= totalPages}
            className={styles.pagerButton}
          >
            Next
          </button>
        </span>
      </nav>
      {/* A sibling, not a child: some screen readers hold back live updates
          inside an aria-busy subtree until it settles, which here would be
          after the new page has already landed. */}
      <span role="status" className={styles.status}>
        {isPending && `Loading page ${selection.page}…`}
      </span>
    </>
  );
}
