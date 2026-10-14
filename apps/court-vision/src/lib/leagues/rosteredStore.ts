import { create } from "zustand";

type RosteredState = {
  playerIds: ReadonlySet<number>;
  hydrate: (args: { playerIds: number[] }) => void;
};

// The players on your teams in the active league. Not persisted, like the
// watchlist store: SessionHydrator re-seeds it from the server on every
// render of the root layout, and saving or deleting a team, or switching
// league, calls router.refresh(), which re-runs that layout.
export const useRosteredStore = create<RosteredState>()((set) => ({
  playerIds: new Set<number>(),
  hydrate: ({ playerIds }) => set({ playerIds: new Set(playerIds) }),
}));

export const useIsRostered = ({ playerId }: { playerId: number }): boolean =>
  useRosteredStore((state) => state.playerIds.has(playerId));
