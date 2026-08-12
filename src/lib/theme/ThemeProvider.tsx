"use client";

import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";

import { type Theme, isTheme } from "@/lib/theme/themes";

export type { Theme } from "@/lib/theme/themes";

export type ThemeContextValue = {
  theme: Theme;
  mounted: boolean;
  setTheme: (args: { theme: Theme }) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const hasSyncedStampedTheme = useRef(false);

  useEffect(() => {
    if (hasSyncedStampedTheme.current) {
      return;
    }
    hasSyncedStampedTheme.current = true;
    const stamped = document.documentElement.dataset.theme;
    setThemeState(isTheme(stamped) ? stamped : "dark");
    setMounted(true);
  }, []);

  const setTheme = ({ theme: next }: { theme: Theme }) => {
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("theme", next);
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, mounted, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeContextValue => {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
};
