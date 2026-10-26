import { create } from "zustand";

import { type WatchlistError } from "@/lib/watchlist/types";

type HydrateProps = { playerIds: number[] };

type AddProps = { playerId: number };

type RemoveProps = { playerId: number };

type SetCountProps = { count: number };

type SetErrorProps = { error: WatchlistError };

type WatchlistState = {
  playerIds: ReadonlySet<number>;
  count: number;
  lastError: WatchlistError | null;
  hydrate: (args: HydrateProps) => void;
  add: (args: AddProps) => void;
  remove: (args: RemoveProps) => void;
  setCount: (args: SetCountProps) => void;
  setError: (args: SetErrorProps) => void;
  clearError: () => void;
};

// Deliberately NOT persisted: the database is the source of truth, and a stale
// localStorage copy would contradict it after a sign-out or on a second
// device. SessionHydrator re-seeds this store from the server on every
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

type UseIsStarredProps = { playerId: number };

export const useIsStarred = ({ playerId }: UseIsStarredProps): boolean =>
  useWatchlistStore((state) => state.playerIds.has(playerId));
