"use client";

import * as React from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import { useTheme } from "@mui/material/styles";

interface ScrollableChipRowProps {
  children: React.ReactNode;
  /** Gap between chips, in px. */
  gap?: number;
  sx?: SxProps<Theme>;
}

/**
 * A single non-wrapping horizontal strip the user scrolls themselves (drag,
 * swipe, or mouse wheel) rather than an auto-scrolling marquee — no content
 * duplication, since there's no loop to make seamless. Small fade hints
 * appear on whichever side still has more to scroll to.
 */
export function ScrollableChipRow({ children, gap = 8, sx }: ScrollableChipRowProps) {
  const theme = useTheme();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateFades = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });

    const resizeObserver = new ResizeObserver(updateFades);
    resizeObserver.observe(el);
    window.addEventListener("resize", updateFades);

    // Plain (non-passive) listener so preventDefault() actually takes effect —
    // React's JSX onWheel is attached passively and can't block the default
    // vertical scroll. Only plain vertical wheel input is redirected; a
    // trackpad's native horizontal gesture (deltaX already present) passes
    // through untouched.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        el.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", updateFades);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFades);
      el.removeEventListener("wheel", onWheel);
    };
  }, [updateFades]);

  return (
    <Box sx={{ position: "relative", ...sx }}>
      <div
        ref={scrollRef}
        className="chip-scroll-row"
        style={{ "--chip-scroll-gap": `${gap}px` } as React.CSSProperties}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="chip-scroll-fade chip-scroll-fade-left"
        style={
          {
            "--chip-fade-color": theme.palette.background.paper,
            opacity: canScrollLeft ? 1 : 0,
          } as React.CSSProperties
        }
      />
      <div
        aria-hidden="true"
        className="chip-scroll-fade chip-scroll-fade-right"
        style={
          {
            "--chip-fade-color": theme.palette.background.paper,
            opacity: canScrollRight ? 1 : 0,
          } as React.CSSProperties
        }
      />
    </Box>
  );
}
