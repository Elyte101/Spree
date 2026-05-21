import type { Metadata } from "next";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { ProductDetailsPage } from "@/components/product/productDetailsPage";
import { ThemedPageShell } from "@/components/ui/themedPageShell";
import type { Product } from "@/types/types";
import {
  getProductByIdOrSlug,
  getRelatedProducts,
} from "@/lib/serverApi";

interface ProductDetailsRouteProps {
  params: Promise<{ id: string }>;
}

const PRODUCT_DETAILS_FALLBACK_TITLE = "This product is unavailable right now.";
const PRODUCT_DETAILS_FALLBACK_DESCRIPTION =
  "We couldn't load this page, but you can keep browsing the catalog without losing your place.";

function ProductDetailsUnavailableState() {
  return (
    <ThemedPageShell accent="warning" anchor="top right" minHeight="100%" centerContent>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 720,
          p: { xs: 3, md: 5 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          textAlign: "center",
        }}
      >
        <Stack spacing={2.5} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
            {PRODUCT_DETAILS_FALLBACK_TITLE}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 540 }}>
            {PRODUCT_DETAILS_FALLBACK_DESCRIPTION}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              href="/products"
              variant="contained"
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
            >
              Back to products
            </Button>
            <Button
              href="/"
              variant="outlined"
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
            >
              Go home
            </Button>
          </Stack>
          </Stack>
      </Paper>
    </ThemedPageShell>
  );
}

export async function generateMetadata({
  params,
}: ProductDetailsRouteProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const product = await getProductByIdOrSlug(id);

    if (!product) {
      return {
        title: "Product unavailable | Spree",
        description: PRODUCT_DETAILS_FALLBACK_DESCRIPTION,
      };
    }

    return {
      title: `${product.name} | Spree`,
      description: product.description,
    };
  } catch {
    return {
      title: "Product unavailable | Spree",
      description: PRODUCT_DETAILS_FALLBACK_DESCRIPTION,
    };
  }
}

export default async function ProductDetailsRoute({
  params,
}: ProductDetailsRouteProps) {
  const { id } = await params;
  let product: Product | undefined;

  try {
    product = await getProductByIdOrSlug(id);
  } catch {
    product = undefined;
  }

  if (!product) {
    return <ProductDetailsUnavailableState />;
  }

  let relatedProducts: Product[] = [];

  try {
    relatedProducts = await getRelatedProducts(id, 4);
  } catch {
    relatedProducts = [];
  }

  return (
    <ProductDetailsPage
      product={product}
      relatedProducts={relatedProducts}
    />
  );
}
