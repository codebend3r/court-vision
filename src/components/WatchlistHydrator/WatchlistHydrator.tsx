"use client";

import { useEffect } from "react";

import { useWatchlistStore } from "@/lib/watchlist/store";

export type WatchlistHydratorProps = {
  playerIds: number[];
};

// Seeds the star set from the server once per navigation. Rendering this in
// the root layout means every surface — tables, detail page, homepage panels —
// shares one query and one source of truth, and no star click has to
// invalidate a `force-dynamic` page to keep them agreeing.
export function WatchlistHydrator({ playerIds }: WatchlistHydratorProps) {
  useEffect(() => {
    useWatchlistStore.getState().hydrate({ playerIds });
  }, [playerIds]);
  return null;
}
