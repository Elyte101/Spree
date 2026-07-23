"use client";

import * as React from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

interface CategoryMarqueeProps {
  children: React.ReactNode;
  /** Full right-to-left loop duration. One configurable knob for speed. */
  durationSeconds?: number;
  /** Gap between chips, in px — kept consistent within a copy and across the seam. */
  gap?: number;
  sx?: SxProps<Theme>;
}

/**
 * A single non-wrapping horizontal strip that auto-scrolls right-to-left,
 * looping seamlessly (content is rendered twice; the CSS in globals.css
 * animates translateX(0 -> -50%), i.e. by exactly one copy's width).
 * Pauses on hover so chips stay clickable, and falls back to a plain
 * horizontal scroll strip under prefers-reduced-motion.
 */
export function CategoryMarquee({ children, durationSeconds = 30, gap = 12, sx }: CategoryMarqueeProps) {
  return (
    <Box
      className="marquee-row"
      sx={sx}
      style={
        {
          "--marquee-duration": `${durationSeconds}s`,
          "--marquee-gap": `${gap}px`,
        } as React.CSSProperties
      }
    >
      <div className="marquee-track">
        <div className="marquee-content">{children}</div>
        <div className="marquee-content" aria-hidden="true">
          {children}
        </div>
      </div>
    </Box>
  );
}
