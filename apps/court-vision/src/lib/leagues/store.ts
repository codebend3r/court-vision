import { create } from "zustand";

import { type LeagueSummary } from "@/lib/leagues/types";

type LeaguesState = {
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
  hydrate: (args: { leagues: LeagueSummary[]; activeLeagueId: string | null }) => void;
  setActive: (args: { leagueId: string }) => void;
  upsert: (args: { league: LeagueSummary }) => void;
  remove: (args: { leagueId: string }) => void;
};

// Deliberately NOT persisted: the database is the source of truth.
// LeaguesHydrator re-seeds this store from the server on every navigation.
export const useLeaguesStore = create<LeaguesState>()((set) => ({
  leagues: [],
  activeLeagueId: null,
  hydrate: ({ leagues, activeLeagueId }) => set({ leagues, activeLeagueId }),
  setActive: ({ leagueId }) => set({ activeLeagueId: leagueId }),
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
