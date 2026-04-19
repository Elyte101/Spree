'use client';

import React, { createContext, useContext, useState, useMemo } from "react";
import { CssBaseline, PaletteMode, ThemeProvider } from "@mui/material";
import { getAppTheme } from "./theme";

interface ThemeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
}

const STORAGE_KEY = "spree-theme-mode";

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  toggleMode: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<PaletteMode>("light");

  React.useEffect(() => {
    const savedMode = window.localStorage.getItem(STORAGE_KEY);

    if (savedMode === "light" || savedMode === "dark") {
      setMode(savedMode);
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
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
