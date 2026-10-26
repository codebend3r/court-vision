import { create } from "zustand";

import { setActiveLeague } from "@/lib/leagues/actions";
import { type LeagueSummary } from "@/lib/leagues/types";

export type SwitchActiveLeagueResult = { status: "ok" } | { status: "error" };

export const SWITCH_LEAGUE_ERROR = "Could not switch leagues — try again.";

type HydrateProps = { leagues: LeagueSummary[]; activeLeagueId: string | null };

type SetActiveProps = { leagueId: string };

type SwitchActiveLeagueProps = { leagueId: string };

type UpsertProps = { league: LeagueSummary };

type RemoveProps = { leagueId: string };

type LeaguesState = {
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
  hydrate: (args: HydrateProps) => void;
  setActive: (args: SetActiveProps) => void;
  // Optimistic: flips the active league at once, so every league-scoped
  // surface updates on the click, then persists it. A failure, or an action
  // that throws, puts the previous league back. The caller refreshes the
  // server render on success and reports a failure.
  switchActiveLeague: (args: SwitchActiveLeagueProps) => Promise<SwitchActiveLeagueResult>;
  upsert: (args: UpsertProps) => void;
  remove: (args: RemoveProps) => void;
};

// Deliberately NOT persisted: the database is the source of truth.
// SessionHydrator re-seeds this store from the server on every navigation.
export const useLeaguesStore = create<LeaguesState>()((set, get) => ({
  leagues: [],
  activeLeagueId: null,
  hydrate: ({ leagues, activeLeagueId }) => set({ leagues, activeLeagueId }),
  setActive: ({ leagueId }) => set({ activeLeagueId: leagueId }),
  switchActiveLeague: async ({ leagueId }) => {
    const previousActiveId = get().activeLeagueId;
    set({ activeLeagueId: leagueId });
    const result = await setActiveLeague({ leagueId }).catch(() => null);
    if (result !== null && result.status === "ok") return { status: "ok" };
    // Only undo our own flip: if another switch landed meanwhile, it wins.
    set((state) =>
      state.activeLeagueId === leagueId ? { activeLeagueId: previousActiveId } : state,
    );
    return { status: "error" };
  },
  upsert: ({ league }) =>
    set((state) => ({
      leagues: state.leagues.some((entry) => entry.id === league.id)
        ? state.leagues.map((entry) => (entry.id === league.id ? league : entry))
        : [...state.leagues, league],
    })),
  remove: ({ leagueId }) =>
    set((state) => ({
      leagues: state.leagues.filter((entry) => entry.id !== leagueId),
      activeLeagueId: state.activeLeagueId === leagueId ? null : state.activeLeagueId,
    })),
}));

export const useLeagues = (): LeagueSummary[] => useLeaguesStore((state) => state.leagues);

export const useActiveLeague = (): LeagueSummary | null =>
  useLeaguesStore(
    (state) => state.leagues.find((entry) => entry.id === state.activeLeagueId) ?? null,
  );
