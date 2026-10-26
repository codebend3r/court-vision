import { create } from "zustand";

import { DEFAULT_MODE, type StatMode } from "@/lib/stats/searchParams";

type SetModeProps = { mode: StatMode };

type StatModeState = {
  mode: StatMode;
  setMode: (args: SetModeProps) => void;
};

// Remembers the last stat mode the user picked so the choice follows them from
// player page to player page, where each bare URL would otherwise reset the
// filters to the default. In-memory only: a full reload starts fresh.
export const useStatModeStore = create<StatModeState>()((set) => ({
  mode: DEFAULT_MODE,
  setMode: ({ mode }) => set({ mode }),
}));
