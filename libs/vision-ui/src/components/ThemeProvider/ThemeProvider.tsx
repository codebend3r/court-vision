"use client";

import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

import { type Theme, isTheme } from "#ui/theme/themes";

export type { Theme } from "#ui/theme/themes";

export type ThemeContextValue = {
  theme: Theme;
  setTheme: (args: { theme: Theme }) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // ThemeInitScript stamped data-theme on <html> before first paint; adopt it
  // once mounted, since the server render can't read it.
  useEffect(() => {
    const stamped = document.documentElement.dataset.theme;
    setThemeState(isTheme(stamped) ? stamped : "dark");
  }, []);

  const setTheme = ({ theme: next }: { theme: Theme }) => {
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("theme", next);
    setThemeState(next);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeContextValue => {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
};
