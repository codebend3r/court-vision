import { create } from "zustand";

import { type WatchlistError } from "@/lib/watchlist/types";

type WatchlistState = {
  playerIds: ReadonlySet<number>;
  count: number;
  lastError: WatchlistError | null;
  hydrate: (args: { playerIds: number[] }) => void;
  add: (args: { playerId: number }) => void;
  remove: (args: { playerId: number }) => void;
  setCount: (args: { count: number }) => void;
  setError: (args: { error: WatchlistError }) => void;
  clearError: () => void;
};

// Deliberately NOT persisted: the database is the source of truth, and a stale
// localStorage copy would contradict it after a sign-out or on a second
// device. WatchlistHydrator re-seeds this store from the server on every
// navigation, and `count` is corrected from each action's result.
export const useWatchlistStore = create<WatchlistState>()((set) => ({
  playerIds: new Set<number>(),
  count: 0,
  lastError: null,
  hydrate: ({ playerIds }) => set({ playerIds: new Set(playerIds), count: playerIds.length }),
  add: ({ playerId }) =>
    set((state) => {
      const playerIds = new Set(state.playerIds).add(playerId);
      return { playerIds, count: playerIds.size };
    }),
  remove: ({ playerId }) =>
    set((state) => {
      const playerIds = new Set(state.playerIds);
      playerIds.delete(playerId);
      return { playerIds, count: playerIds.size };
    }),
  setCount: ({ count }) => set({ count }),
  setError: ({ error }) => set({ lastError: error }),
  clearError: () => set({ lastError: null }),
}));

export const useIsStarred = ({ playerId }: { playerId: number }): boolean =>
  useWatchlistStore((state) => state.playerIds.has(playerId));

export const useWatchlistCount = (): number => useWatchlistStore((state) => state.count);
