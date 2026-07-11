import { Box, Paper, Stack, Typography } from "@mui/material";

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
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Loading products...
          </Typography>
        </Paper>
        <ProductGridSkeleton count={12} dense />
      </Stack>
    </Box>
  );
}
