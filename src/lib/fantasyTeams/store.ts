import { create } from "zustand";
import { persist } from "zustand/middleware";

import { type FantasyTeam } from "@/lib/fantasyTeams/types";

type FantasyTeamsState = {
  teams: FantasyTeam[];
  addTeam: (args: { team: FantasyTeam }) => void;
  updateTeam: (args: { team: FantasyTeam }) => void;
  removeTeam: (args: { teamId: string }) => void;
};

// Client-side persistence (localStorage) so anyone can build teams without an
// account. Syncing rosters to the Supabase profile is a future enhancement —
// the store's shape is the contract either way.
export const useFantasyTeamsStore = create<FantasyTeamsState>()(
  persist(
    (set) => ({
      teams: [],
      addTeam: ({ team }) => set((state) => ({ teams: [...state.teams, team] })),
      updateTeam: ({ team }) =>
        set((state) => ({
          teams: state.teams.map((existing) => (existing.id === team.id ? team : existing)),
        })),
      removeTeam: ({ teamId }) =>
        set((state) => ({ teams: state.teams.filter((team) => team.id !== teamId) })),
    }),
    {
      name: "court-vision-fantasy-teams",
      partialize: (state) => ({ teams: state.teams }),
      skipHydration: true,
    },
  ),
);
