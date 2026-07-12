"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  buildPlayersHref,
  type PlayerGameRange,
  type PlayerSortKey,
  type PlayerStatMode,
  type SortDirection,
} from "@/lib/players/searchParams";

import styles from "@/components/PlayersPager/PlayersPager.module.scss";

export type PlayersPagerProps = {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
  totalPages: number;
  sort: PlayerSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
};

export function PlayersPager({
  q,
  page,
  size,
  includeRetired,
  totalPages,
  sort,
  dir,
  range,
  mode,
  minimums,
}: PlayersPagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goTo = ({ nextPage }: { nextPage: number }) => {
    startTransition(() => {
      router.replace(
        buildPlayersHref({
          q,
          page: nextPage,
          size,
          includeRetired,
          sort,
          dir,
          range,
          mode,
          minimums,
        }),
      );
    });
  };

  return (
    <nav
      className={styles.pager}
      aria-label="Pagination"
      data-pending={isPending ? "true" : "false"}
      aria-busy={isPending}
    >
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
