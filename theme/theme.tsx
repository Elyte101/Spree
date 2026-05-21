"use client";

import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { PaletteMode } from "@mui/material";

export const getAppTheme = (mode: PaletteMode) =>
  responsiveFontSizes(
    createTheme({
      palette: {
        mode,
        primary: { main: "#655AFF" },
        info: { main: "#0EA5E9" },
        warning: { main: "#F59E0B" },
        secondary: { main: "#F97316" },
        ...(mode === "light"
          ? {
              background: {
                default: "#F7F9FC",
                paper: "#FFFFFF",
              },
              text: {
                primary: "#1A1A1A",
                secondary: "#5F6B7A",
              },
            }
          : {
              background: {
                default: "#0F0F12",
                paper: "#1C1C1F",
              },
              text: {
                primary: "#FFFFFF",
                secondary: "#A6ADBB",
              },
            }),
      },
      shape: {
        borderRadius: 12,
      },
      typography: {
        fontFamily:
          '"UI Sans", "Lato", "HelveticaNeue", Helvetica Neue, Helvetica, Arial, sans-serif',
        h2: {
          fontWeight: 900,
          fontSize: "3.5rem",
          lineHeight: 0.98,
        },
        h3: {
          fontWeight: 900,
          fontSize: "2.45rem",
          lineHeight: 1.02,
        },
        h4: {
          fontWeight: 900,
          fontSize: "1.9rem",
          lineHeight: 1.08,
        },
        h5: {
          fontWeight: 900,
          fontSize: "1.4rem",
          lineHeight: 1.14,
        },
        h6: {
          fontWeight: 900,
          fontSize: "1.1rem",
          lineHeight: 1.2,
        },
        body1: {
          lineHeight: 1.65,
        },
        button: {
          fontWeight: 600,
          letterSpacing: 0,
        },
      },
    }),
    { factor: 2.2 }
  );
