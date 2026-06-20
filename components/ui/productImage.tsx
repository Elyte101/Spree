'use client';

import * as React from "react";
import Image from "next/image";
import { BrokenImageRounded } from "@mui/icons-material";
import { Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

interface ProductImageProps {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  objectFit?: "cover" | "contain";
}

const RETRY_DELAYS = [800, 2000];

export function ProductImage({ src, alt, sizes, priority, objectFit = "cover" }: ProductImageProps) {
  const [loaded, setLoaded] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [unoptimized, setUnoptimized] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
    setAttempt(0);
    setUnoptimized(false);
    setFailed(false);
  }, [src]);

  const handleError = React.useCallback(() => {
    if (attempt < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[attempt];
      setTimeout(() => setAttempt((a) => a + 1), delay);
    } else if (!unoptimized) {
      // Bypass the Next.js optimizer and try the raw URL once more
      setUnoptimized(true);
      setAttempt(0);
    } else {
      setFailed(true);
    }
  }, [attempt, unoptimized]);

  if (failed) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={0.75}
        sx={(theme) => ({
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.main,
            0.07
          )}, ${alpha(theme.palette.secondary.main, 0.07)})`,
        })}
      >
        <BrokenImageRounded sx={{ fontSize: 28, color: "text.disabled" }} />
        <Typography variant="caption" color="text.disabled" sx={{ textAlign: "center", px: 1 }}>
          {alt || "Unavailable"}
        </Typography>
      </Stack>
    );
  }

  return (
    <>
      {!loaded && (
        <Skeleton
          variant="rounded"
          sx={{ position: "absolute", inset: 0, transform: "none" }}
        />
      )}
      <Image
        key={`${src}-${attempt}-${unoptimized ? "raw" : "opt"}`}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
        style={{
          objectFit,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
    </>
  );
}
