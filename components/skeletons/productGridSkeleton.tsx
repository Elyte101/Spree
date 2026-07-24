"use client";

import { Box, Paper, Skeleton, Stack } from "@mui/material";

interface ProductGridSkeletonProps {
  count?: number;
  /** Matches the /products listing's denser "micro" card grid (see productCard.tsx). */
  dense?: boolean;
}

export function ProductGridSkeleton({ count = 8, dense = false }: ProductGridSkeletonProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: dense ? { xs: 1, sm: 1.5 } : 1.5,
        gridTemplateColumns: dense
          ? { xs: "repeat(2, 1fr)", sm: "repeat(auto-fill, minmax(220px, 1fr))" }
          : { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", xl: "repeat(4, 1fr)" },
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Paper
          key={index}
          elevation={0}
          sx={{
            p: dense ? 1 : 1.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Skeleton variant="rounded" height={dense ? 150 : 220} />
          <Stack spacing={dense ? 0.75 : 1} sx={{ mt: dense ? 1 : 1.5 }}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="85%" height={dense ? 22 : 32} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="72%" />
            <Skeleton variant="rounded" width="55%" height={dense ? 16 : 24} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Skeleton variant="text" width="30%" height={dense ? 24 : 36} />
              <Skeleton variant="rounded" width={dense ? 62 : 92} height={dense ? 24 : 36} />
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
