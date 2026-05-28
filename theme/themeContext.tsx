'use client';

import React, { createContext, useContext, useState, useMemo } from "react";
import { CssBaseline, PaletteMode, ThemeProvider } from "@mui/material";
import { getAppTheme } from "./theme";

interface ThemeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
}

const STORAGE_KEY = "spree-theme-mode";

// useLayoutEffect on the client (fires before the browser paints, so no flash),
// useEffect on the server (no-op, avoids the SSR warning about useLayoutEffect).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  toggleMode: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always initialise to "light" so the first client render matches the SSR
  // render and there is no hydration mismatch. The layout effect then applies
  // the user's real preference synchronously before the browser paints.
  const [mode, setMode] = useState<PaletteMode>("light");

  useIsomorphicLayoutEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") {
      setMode(saved);
    } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setMode("dark");
    }
  }, []);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      // Write directly in the updater — no useEffect needed and no race with
      // the initialisation layout effect.
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const theme = useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};
