"use client";

import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";

export type Theme = "dark" | "light";

export type ThemeContextValue = {
  theme: Theme;
  mounted: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const hasSyncedStampedTheme = useRef(false);

  useEffect(() => {
    if (hasSyncedStampedTheme.current) {
      return;
    }
    hasSyncedStampedTheme.current = true;
    const stamped = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(stamped);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("theme", next);
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeContextValue => {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
};
