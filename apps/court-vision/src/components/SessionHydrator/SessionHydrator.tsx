"use client";

import { useEffect } from "react";

import { useRosteredStore } from "@/lib/leagues/rosteredStore";
import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";
import { useWatchlistStore } from "@/lib/watchlist/store";

// Plain data only: the root layout is a server component, and functions (a
// store's own setters) cannot cross into a client component's props.
export type SessionHydratorProps = {
  watchlistPlayerIds: number[];
  rosteredPlayerIds: number[];
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
};

// Seeds the client stores from the root layout's reads once per navigation, so
// every surface (star buttons, on-your-team tints, the side-nav league
// switcher, the league pages) shares one query and one source of truth, and no client action has to
// invalidate a `force-dynamic` page to keep them agreeing.
export function SessionHydrator({
  watchlistPlayerIds,
  rosteredPlayerIds,
  leagues,
  activeLeagueId,
}: SessionHydratorProps) {
  useEffect(() => {
    useWatchlistStore.getState().hydrate({ playerIds: watchlistPlayerIds });
  }, [watchlistPlayerIds]);

  useEffect(() => {
    useRosteredStore.getState().hydrate({ playerIds: rosteredPlayerIds });
  }, [rosteredPlayerIds]);

  useEffect(() => {
    useLeaguesStore.getState().hydrate({ leagues, activeLeagueId });
  }, [leagues, activeLeagueId]);

  return null;
}
