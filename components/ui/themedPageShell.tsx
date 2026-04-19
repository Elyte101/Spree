'use client';

import type { ReactNode } from "react";
import { alpha, Box } from "@mui/material";

interface ThemedPageShellProps {
  children: ReactNode;
  accent?: "primary" | "warning";
  anchor?: string;
  minHeight?: string;
  centerContent?: boolean;
}

export function ThemedPageShell({
  children,
  accent = "primary",
  anchor = "top left",
  minHeight = "100vh",
  centerContent = false,
}: ThemedPageShellProps) {
  return (
    <Box
      component="main"
      sx={(theme) => ({
        minHeight,
        px: { xs: 2, sm: 4, md: 6 },
        py: { xs: 4, sm: 6 },
        ...(centerContent
          ? {
              display: "grid",
              placeItems: "center",
            }
          : null),
        background: `radial-gradient(circle at ${anchor}, ${alpha(
          theme.palette[accent].main,
          theme.palette.mode === "dark" ? 0.18 : 0.08
        )} 0%, transparent 24%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      {children}
    </Box>
  );
}
