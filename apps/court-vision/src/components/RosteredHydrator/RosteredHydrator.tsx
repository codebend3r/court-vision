"use client";

import { useEffect } from "react";

import { useRosteredStore } from "@/lib/leagues/rosteredStore";

export type RosteredHydratorProps = {
  playerIds: number[];
};

// Seeds the "on your team" set from the server once per navigation, the same
// way WatchlistHydrator seeds stars, so every player table shares one query.
export function RosteredHydrator({ playerIds }: RosteredHydratorProps) {
  useEffect(() => {
    useRosteredStore.getState().hydrate({ playerIds });
  }, [playerIds]);
  return null;
}
