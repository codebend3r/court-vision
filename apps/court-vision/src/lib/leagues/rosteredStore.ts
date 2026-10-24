import { useMemo } from "react";
import { create } from "zustand";

// Who holds a player in the active league: the fantasy team's name and whether
// it is the one you manage. Only imported leagues know every roster.
export type LeagueOwner = {
  playerId: number;
  teamName: string;
  isMine: boolean;
};

type RosteredState = {
  playerIds: ReadonlySet<number>;
  // Every rostered player's holder, or null when the league's rosters are not
  // all known (no league, or a hand-built one), so nobody reads as a free agent.
  owners: ReadonlyMap<number, LeagueOwner> | null;
  hydrate: (args: { playerIds: number[]; owners?: readonly LeagueOwner[] | null }) => void;
};

// The players on your teams in the active league. Not persisted, like the
// watchlist store: SessionHydrator re-seeds it from the server on every
// render of the root layout, and saving or deleting a team, or switching
// league, calls router.refresh(), which re-runs that layout.
export const useRosteredStore = create<RosteredState>()((set) => ({
  playerIds: new Set<number>(),
  owners: null,
  hydrate: ({ playerIds, owners = null }) =>
    set({
      playerIds: new Set(playerIds),
      owners: owners && new Map(owners.map((owner) => [owner.playerId, owner])),
    }),
}));

export const useIsRostered = ({ playerId }: { playerId: number }): boolean =>
  useRosteredStore((state) => state.playerIds.has(playerId));

// "mine" and "other" name the holder; "free" is a player on no roster; null
// means ownership is unknown here, so no chip should show.
export type Ownership =
  | { status: "mine"; teamName: string }
  | { status: "other"; teamName: string }
  | { status: "free" };

// Two primitive-stable selections (the stored owner object, and whether owners
// are known at all) rather than one derived object, which would be a new
// snapshot on every read.
export const useOwnership = ({ playerId }: { playerId: number }): Ownership | null => {
  const owner = useRosteredStore((state) => state.owners?.get(playerId));
  const isKnown = useRosteredStore((state) => state.owners !== null);
  if (!isKnown) return null;
  if (owner === undefined) return { status: "free" };
  return { status: owner.isMine ? "mine" : "other", teamName: owner.teamName };
};

// Whether the active league's rosters are all known, so a roster-status control
// has something to say.
export const useAreOwnersKnown = (): boolean => useRosteredStore((state) => state.owners !== null);

// The ids of every player on some roster in the league, or null where rosters
// are unknown. Rebuilt only when the store is re-hydrated.
export const useTakenIds = (): ReadonlySet<number> | null => {
  const owners = useRosteredStore((state) => state.owners);
  return useMemo(() => owners && new Set(owners.keys()), [owners]);
};
