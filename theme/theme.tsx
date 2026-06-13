"use client";

import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { PaletteMode } from "@mui/material";

export const getAppTheme = (mode: PaletteMode) =>
  responsiveFontSizes(
    createTheme({
      palette: {
        mode,
        primary: { main: "#655AFF", light: "#8B82FF", dark: "#4740CC" },
        secondary: { main: "#F97316", light: "#FB923C", dark: "#C2570D" },
        success: { main: "#22C55E", light: "#4ADE80", dark: "#16A34A" },
        info: { main: "#0EA5E9", light: "#38BDF8", dark: "#0284C7" },
        warning: { main: "#F59E0B", light: "#FCD34D", dark: "#D97706" },
        error: { main: "#EF4444", light: "#F87171", dark: "#DC2626" },
        ...(mode === "light"
          ? {
              background: {
                default: "#F5F4FF",
                paper: "#FFFFFF",
              },
              text: {
                primary: "#0F0E1A",
                secondary: "#5B5675",
              },
              divider: "rgba(101,90,255,0.10)",
            }
          : {
              background: {
                default: "#0C0B14",
                paper: "#17161F",
              },
              text: {
                primary: "#F0EEFF",
                secondary: "#9B96B8",
              },
              divider: "rgba(101,90,255,0.14)",
            }),
      },
      shape: {
        borderRadius: 12,
      },
      typography: {
        fontFamily: '"Rubik", "Nunito Sans", "Helvetica Neue", Arial, sans-serif',
        h1: {
          fontFamily: '"Rubik", sans-serif',
          fontWeight: 900,
          fontSize: "2.125rem",    // 34px desktop → ~26px mobile via responsiveFontSizes
          letterSpacing: "-0.03em",
          lineHeight: 0.9,
        },
        h2: {
          fontFamily: '"Rubik", sans-serif',
          fontWeight: 800,
          fontSize: "1.875rem",    // 30px desktop → ~23px mobile
          letterSpacing: "-0.025em",
          lineHeight: 0.96,
        },
        h3: {
          fontFamily: '"Rubik", sans-serif',
          fontWeight: 800,
          fontSize: "1.5rem",      // 24px desktop → ~19px mobile
          letterSpacing: "-0.02em",
          lineHeight: 1.0,
        },
        h4: {
          fontFamily: '"Rubik", sans-serif',
          fontWeight: 700,
          fontSize: "1.25rem",     // 20px desktop → ~16px mobile
          letterSpacing: "-0.015em",
          lineHeight: 1.1,
        },
        h5: {
          fontFamily: '"Rubik", sans-serif',
          fontWeight: 700,
          fontSize: "1.125rem",    // 18px
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
        },
        h6: {
          fontFamily: '"Rubik", sans-serif',
          fontWeight: 600,
          fontSize: "1rem",        // 16px
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
        },
        subtitle1: {
          fontFamily: '"Nunito Sans", sans-serif',
          fontWeight: 600,
          lineHeight: 1.4,
        },
        subtitle2: {
          fontFamily: '"Nunito Sans", sans-serif',
          fontWeight: 600,
          lineHeight: 1.45,
        },
        body1: {
          fontFamily: '"Nunito Sans", sans-serif',
          lineHeight: 1.65,
          letterSpacing: "0.005em",
        },
        body2: {
          fontFamily: '"Nunito Sans", sans-serif',
          lineHeight: 1.6,
          letterSpacing: "0.005em",
        },
        caption: {
          fontFamily: '"Nunito Sans", sans-serif',
          fontWeight: 600,
          letterSpacing: "0.02em",
        },
        overline: {
          fontFamily: '"Nunito Sans", sans-serif',
          fontWeight: 700,
          letterSpacing: "0.12em",
        },
        button: {
          fontFamily: '"Rubik", sans-serif',
          fontWeight: 600,
          letterSpacing: "0.01em",
        },
      },
      components: {
        MuiButton: {
          defaultProps: {
            disableElevation: true,
          },
          styleOverrides: {
            root: {
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 700,
            },
            sizeLarge: {
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: 28,
              paddingRight: 28,
              fontSize: "1rem",
            },
            sizeMedium: {
              paddingTop: 9,
              paddingBottom: 9,
              paddingLeft: 20,
              paddingRight: 20,
            },
            sizeSmall: {
              paddingTop: 5,
              paddingBottom: 5,
              paddingLeft: 14,
              paddingRight: 14,
            },
          },
        },
        MuiButtonBase: {
          styleOverrides: {
            root: {
              "&:focus-visible": {
                outline: "2.5px solid #655AFF",
                outlineOffset: 2,
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              fontFamily: '"Nunito Sans", sans-serif',
              fontWeight: 700,
              "&.MuiChip-clickable": {
                minHeight: 44,
              },
            },
          },
        },
        MuiPaper: {
          defaultProps: {
            elevation: 0,
          },
        },
        MuiCard: {
          defaultProps: {
            elevation: 0,
          },
        },
        MuiTextField: {
          defaultProps: {
            variant: "outlined",
          },
        },
      },
    }),
    { factor: 2.0 }
  );
