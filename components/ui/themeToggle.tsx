'use client';

import { Brightness4, Brightness7 } from "@mui/icons-material";
import { IconButton, SxProps, Theme, useTheme } from "@mui/material";
import { useThemeContext } from "@/theme/themeContext";

interface ThemeToggleProps {
  sx?: SxProps<Theme>;
}

export const ThemeToggle = ({ sx }: ThemeToggleProps) => {
  const theme = useTheme();
  const { toggleMode } = useThemeContext();

  return (
    <IconButton
      onClick={toggleMode}
      color="inherit"
      sx={sx}
      aria-label="toggle theme"
    >
      {theme.palette.mode === "dark" ? <Brightness7 /> : <Brightness4 />}
    </IconButton>
  );
};
