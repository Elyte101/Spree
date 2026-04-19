'use client';

import * as React from "react";
import Link from "next/link";
import {
  FavoriteBorderRounded,
  FavoriteRounded,
  ShoppingBagOutlined,
} from "@mui/icons-material";
import {
  alpha,
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { ProductCard } from "@/components/product/productCard";
import { ProductGridSkeleton } from "@/components/skeletons/productGridSkeleton";
import { useFavorites } from "@/components/providers/favoritesProvider";
import { useFavoriteProducts } from "@/lib/hooks/useStorefrontQueries";

export function FavoritesPage() {
  const { favoriteIds, favoriteCount, hasHydrated, clearFavorites } = useFavorites();
  const favoritesQuery = useFavoriteProducts(favoriteIds, hasHydrated);
  const loading = !hasHydrated || (favoritesQuery.isLoading && favoriteCount > 0);
  const error = favoritesQuery.error?.message ?? null;
  const products = favoritesQuery.orderedProducts;

  return (
    <Box
      sx={(theme) => ({
        minHeight: "1500px",
        px: { xs: 2, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.16 : 0.08
        )}, transparent 24%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={4}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Chip
                icon={<FavoriteRounded />}
                label="Favorites"
                color="primary"
                sx={{ mb: 1.5, borderRadius: 999 }}
              />
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
                Your saved products.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Keep track of the products you liked and jump back into them anytime.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={`${favoriteCount} saved`} color="primary" />
              {favoriteCount ? (
                <Button
                  variant="outlined"
                  onClick={clearFavorites}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
                >
                  Clear all
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>

        {loading ? <ProductGridSkeleton count={Math.max(4, favoriteCount)} /> : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        {hasHydrated && !loading && favoriteCount === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
              textAlign: "center",
            }}
          >
            <Stack spacing={2.5} alignItems="center">
              <FavoriteBorderRounded color="action" sx={{ fontSize: 44 }} />
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                No favorites yet
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520 }}>
                Tap the heart on any product card to save it here for later.
              </Typography>
              <Button
                component={Link}
                href="/products"
                variant="contained"
                startIcon={<ShoppingBagOutlined />}
                sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 800 }}
              >
                Browse products
              </Button>
            </Stack>
          </Paper>
        ) : null}

        {hasHydrated && !loading && favoriteCount > 0 ? (
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
            }}
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product} size="compact" />
            ))}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
