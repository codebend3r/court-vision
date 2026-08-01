"use client";

import { useEffect } from "react";

import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

export type LeaguesHydratorProps = {
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
};

// Seeds the leagues store from the server once per navigation, so the side-nav
// switcher and league pages share one query and one source of truth.
export function LeaguesHydrator({ leagues, activeLeagueId }: LeaguesHydratorProps) {
  useEffect(() => {
    useLeaguesStore.getState().hydrate({ leagues, activeLeagueId });
  }, [leagues, activeLeagueId]);
  return null;
}
