'use client';

import React, { createContext, useContext, useState, useMemo } from "react";
import { CssBaseline, GlobalStyles, PaletteMode, ThemeProvider } from "@mui/material";
import { getAppTheme } from "./theme";

interface ThemeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
}

const STORAGE_KEY = "spree-theme-mode";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  toggleMode: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<PaletteMode>("light");

  // Hydrate from localStorage before the first paint (no flash)
  useIsomorphicLayoutEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") {
      setMode(saved);
    } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setMode("dark");
    }
  }, []);

  // Keep <html> in sync whenever mode changes (covers live toggle + initial hydration).
  // This updates the inline styles set by the blocking script so the html element
  // immediately reflects the new palette while React/MUI re-render in the background.
  useIsomorphicLayoutEffect(() => {
    const el = document.documentElement;
    if (mode === "dark") {
      el.style.background = "#0C0B14";
      el.style.color = "#F0EEFF";
      el.style.colorScheme = "dark";
    } else {
      el.style.background = "#F5F4FF";
      el.style.color = "#0F0E1A";
      el.style.colorScheme = "light";
    }
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const theme = useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        {/*
         * CssBaseline resets browser defaults (margin, box-sizing, etc.).
         * GlobalStyles drives body + html background from the active palette.
         * Using GlobalStyles here (not just CssBaseline) ensures the body
         * background updates live when mode toggles, bypassing Emotion's SSR
         * cache which can retain the light-mode body rule after hydration.
         */}
        <CssBaseline />
        <GlobalStyles
          styles={(t) => ({
            "html, body": {
              backgroundColor: t.palette.background.default,
              color: t.palette.text.primary,
            },
            // Ensure the Next.js root div fills the viewport so short pages
            // (404, empty states) don't expose a bare background below <main>.
            "#__next": {
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              backgroundColor: t.palette.background.default,
            },
          })}
        />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};
