"use client";

import { Box, Paper, Skeleton, Stack } from "@mui/material";

export function ProductDetailsSkeleton() {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.05fr) minmax(320px, 0.95fr)" },
      }}
    >
      <Stack spacing={2}>
        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <Skeleton variant="rounded" height={560} />
        </Paper>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} variant="rounded" height={90} />
          ))}
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Skeleton variant="rounded" width={120} height={32} />
          <Skeleton variant="text" width="75%" height={56} />
          <Skeleton variant="text" width="45%" />
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="94%" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="rounded" width={160} height={44} />
          <Skeleton variant="rounded" width={180} height={44} />
        </Stack>
      </Paper>
    </Box>
  );
}
