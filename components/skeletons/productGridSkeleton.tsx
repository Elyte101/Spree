"use client";

import { Box, Paper, Skeleton, Stack } from "@mui/material";

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Paper
          key={index}
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Skeleton variant="rounded" height={220} />
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="85%" height={32} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="72%" />
            <Skeleton variant="rounded" width="55%" height={24} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Skeleton variant="text" width="30%" height={36} />
              <Skeleton variant="rounded" width={92} height={36} />
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
