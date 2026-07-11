import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SideNavState {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

export const useSideNavStore = create<SideNavState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
    }),
    {
      name: "court-vision-side-nav",
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
      skipHydration: true,
    },
  ),
);
