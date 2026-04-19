import { Box, Stack } from "@mui/material";

import { ProductDetailsSkeleton } from "@/components/skeletons/productDetailsSkeleton";

export default function ProductDetailsLoading() {
  return (
    <Box sx={{ px: { xs: 1.5, sm: 3, md: 5 }, py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <ProductDetailsSkeleton />
      </Stack>
    </Box>
  );
}
