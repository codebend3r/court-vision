"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { Pager } from "@/components/Pager/Pager";
import { buildPlayersHref, type PlayersSearchParams } from "@/lib/players/searchParams";

import styles from "@/components/PlayersPager/PlayersPager.module.scss";

export type PlayersPagerProps = {
  params: PlayersSearchParams;
  // The page the server landed on, after clamping `params.page`.
  page: number;
  totalPages: number;
};

// Where the reader asked to be. Held optimistically so the page count, the
// Prev/Next bounds, and the size select move on the click instead of waiting
// for the server render behind the navigation.
type PageSelection = {
  page: number;
  size: number;
};

// The server-ranked tabs' pager: every change is a route change, so the bar
// is the shared Pager wired to the router.
export function PlayersPager({ params, page, totalPages }: PlayersPagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Reverts to the props once the navigation's transition settles, so the
  // server's clamped page always has the final word.
  const [selection, setSelection] = useOptimistic<PageSelection>({ page, size: params.size });

  const goTo = (next: PageSelection) => {
    startTransition(() => {
      setSelection(next);
      router.replace(buildPlayersHref({ ...params, ...next }));
    });
  };

  return (
    <>
      <Pager
        page={selection.page}
        size={selection.size}
        totalPages={totalPages}
        isTotalKnown={selection.size === params.size}
        isPending={isPending}
        // Steps from the optimistic page, so a second Next pressed before the
        // first lands moves on again instead of requesting the same page twice.
        onPageChange={({ page: nextPage }) => goTo({ page: nextPage, size: selection.size })}
        // A larger or smaller page reshuffles the rows, so return to page 1.
        onSizeChange={({ size }) => goTo({ page: 1, size })}
      />
      {/* A sibling, not a child: some screen readers hold back live updates
          inside an aria-busy subtree until it settles, which here would be
          after the new page has already landed. */}
      <span role="status" className={styles.status}>
        {isPending && `Loading page ${selection.page}…`}
      </span>
    </>
  );
}
