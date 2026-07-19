import { Box, Paper, Skeleton, Stack } from "@mui/material";

import { ProductGridSkeleton } from "@/components/skeletons/productGridSkeleton";

export default function ProductsLoading() {
  return (
    <Box sx={{ px: { xs: 1.5, sm: 3, md: 5 }, py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {/* Mirrors the loaded header's "Shop All Products" title +
              subtitle shape — a skeleton, not literal text, since this can
              be visible in the SSR'd HTML before the real page resolves. */}
          <Skeleton variant="text" width={220} height={40} />
          <Skeleton variant="text" width={160} height={24} />
        </Paper>
        <ProductGridSkeleton count={12} dense />
      </Stack>
    </Box>
  );
}
