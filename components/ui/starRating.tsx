'use client';

import * as React from "react";
import { StarRounded } from "@mui/icons-material";
import { Stack } from "@mui/material";

interface StarRatingProps {
  value: number;
  size?: number;
  /** Renders an interactive 1-5 picker instead of a read-only display. */
  onChange?: (value: number) => void;
  color?: string;
}

export function StarRating({ value, size = 18, onChange, color = "#F59E0B" }: StarRatingProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const interactive = Boolean(onChange);
  const displayValue = hovered ?? value;

  return (
    <Stack
      direction="row"
      spacing={0.25}
      component={interactive ? "div" : "span"}
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? "Rating" : `${value.toFixed(1)} out of 5 stars`}
      onMouseLeave={interactive ? () => setHovered(null) : undefined}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <StarRounded
          key={star}
          role={interactive ? "radio" : undefined}
          aria-checked={interactive ? star === value : undefined}
          aria-label={interactive ? `${star} star${star > 1 ? "s" : ""}` : undefined}
          onClick={interactive ? () => onChange!(star) : undefined}
          onMouseEnter={interactive ? () => setHovered(star) : undefined}
          sx={{
            fontSize: size,
            color: star <= displayValue ? color : "action.disabledBackground",
            cursor: interactive ? "pointer" : "default",
            transition: "color 0.12s ease",
          }}
        />
      ))}
    </Stack>
  );
}
