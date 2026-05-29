'use client';

import * as React from "react";
import NextLink from "next/link";
import Image from "next/image";
import {
  ArrowBackRounded,
  CheckCircleRounded,
  LocalShippingOutlined,
  ReplayOutlined,
  StarRounded,
  StorefrontRounded,
  WorkspacePremiumRounded,
} from "@mui/icons-material";
import {
  alpha,
  Breadcrumbs,
  Box,
  Button,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useCart } from "@/components/providers/cartProvider";
import { Product } from "@/types/types";
import { ProductCard } from "@/components/product/productCard";
import { formatPrice } from "@/lib/ghana";

interface ProductDetailsPageProps {
  product: Product;
  relatedProducts: Product[];
}

const formatLabel = (value: string) =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const sellerTypeLabels: Record<NonNullable<Product["sellerType"]>, string> = {
  retail: "Retail seller",
  wholesale: "Wholesale seller",
};

export function ProductDetailsPage({
  product,
  relatedProducts,
}: ProductDetailsPageProps) {
  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = React.useState(
    product.images[0] ?? product.image
  );
  const [selectedColor, setSelectedColor] = React.useState(
    product.colors[0] ?? null
  );
  const [selectedSize, setSelectedSize] = React.useState(
    product.sizes?.[0] ?? null
  );
  const [lastAddedAt, setLastAddedAt] = React.useState(0);
  const recentlyAdded = lastAddedAt > 0;

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSelectedImage(product.images[0] ?? product.image);
      setSelectedColor(product.colors[0] ?? null);
      setSelectedSize(product.sizes?.[0] ?? null);
      setLastAddedAt(0);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [product]);

  React.useEffect(() => {
    if (!recentlyAdded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLastAddedAt(0);
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentlyAdded, lastAddedAt]);

  const highlights = [
    {
      icon: <LocalShippingOutlined fontSize="small" color="primary" />,
      title: "Fast dispatch",
      body: "Ships in 1-2 business days from our fulfillment center.",
    },
    {
      icon: <ReplayOutlined fontSize="small" color="primary" />,
      title: "Easy returns",
      body: "30-day returns policy on eligible unworn items.",
    },
    {
      icon: <WorkspacePremiumRounded fontSize="small" color="primary" />,
      title: "Trusted sellers",
      body: "Each product is tied to a store that buyers can review, follow, and report if needed.",
    },
  ];

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100%",
        px: { xs: 1.5, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(circle at top right, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.18 : 0.1
        )}, transparent 28%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={4}>
        <Stack spacing={2}>
          <Button
            component={NextLink}
            href="/products"
            startIcon={<ArrowBackRounded />}
            variant="text"
            sx={{
              width: "fit-content",
              px: 0,
              textTransform: "none",
              fontWeight: 900,
            }}
          >
            Back to products
          </Button>

          <Breadcrumbs aria-label="breadcrumb" sx={{ flexWrap: "wrap" }}>
            <Link component={NextLink} href="/" underline="hover" color="inherit">
              Home
            </Link>
            <Link component={NextLink} href="/products" underline="hover" color="inherit">
              Products
            </Link>
            <Typography color="text.primary">{product.name}</Typography>
          </Breadcrumbs>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.05fr) minmax(320px, 0.95fr)" },
            alignItems: "start",
          }}
        >
          <Stack spacing={2}>
            <Paper
              elevation={0}
              sx={(theme) => ({
                p: { xs: 1, md: 1.75 },
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                background: `linear-gradient(145deg, ${alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === "dark" ? 0.18 : 0.12
                )}, ${alpha(
                  theme.palette.background.default,
                  theme.palette.mode === "dark" ? 0.92 : 0.97
                )})`,
              })}
            >
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  minHeight: { xs: 280, sm: 460, md: 560 },
                  aspectRatio: "4 / 5",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <Image
                  src={selectedImage}
                  alt={product.name}
                  fill
                  sizes="(max-width: 900px) 100vw, 50vw"
                  style={{
                    objectFit: "cover",
                    objectPosition: "center",
                  }}
                  priority
                />
              </Box>
            </Paper>

            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
              }}
            >
              {product.images.map((image) => (
                <Paper
                  key={image}
                  elevation={0}
                  onClick={() => setSelectedImage(image)}
                  sx={(theme) => ({
                    p: 1.25,
                    borderRadius: 3,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor:
                      selectedImage === image ? "primary.main" : "divider",
                    backgroundColor:
                      selectedImage === image
                        ? alpha(theme.palette.primary.main, 0.1)
                        : "background.paper",
                    transition: "border-color 0.2s ease, transform 0.2s ease",
                    "&:hover": {
                      borderColor: "primary.main",
                      transform: "translateY(-2px)",
                    },
                  })}
                >
                  <Box
                    sx={{
                      position: "relative",
                      width: "100%",
                      height: 76,
                    }}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} preview`}
                      fill
                      sizes="90px"
                      style={{
                        objectFit: "cover",
                        objectPosition: "center",
                      }}
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          </Stack>

          <Stack spacing={2.5}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {product.badge ? <Chip label={product.badge} color="primary" /> : null}
                <Chip
                  label={product.inStock ? "In Stock" : "Preorder"}
                  color={product.inStock ? "success" : "warning"}
                  variant="filled"
                />
                <Chip label={product.category} variant="outlined" />
                <Chip label={product.brand} variant="outlined" />
                {product.sellerType ? (
                  <Chip label={sellerTypeLabels[product.sellerType]} variant="outlined" />
                ) : null}
                {product.sellerBadge ? (
                  <Chip label={product.sellerBadge} color="success" variant="outlined" />
                ) : null}
              </Stack>

              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, color: "text.primary" }}>
                {product.name}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                <StarRounded color="warning" sx={{ fontSize: 20 }} />
                <Typography variant="body1" fontWeight={800} color="text.primary">
                  {product.rating.toFixed(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  based on {product.reviewsCount} reviews
                </Typography>
              </Stack>

              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
                {product.description}
              </Typography>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="baseline">
                  <Typography variant="h4" sx={{ fontWeight: 900 }}>
                    {formatPrice(product.price)}
                  </Typography>
                  {product.originalPrice ? (
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      sx={{ textDecoration: "line-through" }}
                    >
                      {formatPrice(product.originalPrice)}
                    </Typography>
                  ) : null}
                </Stack>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                    Color
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {product.colors.map((color) => (
                      <Chip
                        key={color}
                        label={color}
                        clickable
                        color={selectedColor === color ? "primary" : "default"}
                        variant={selectedColor === color ? "filled" : "outlined"}
                        onClick={() => setSelectedColor(color)}
                      />
                    ))}
                  </Stack>
                </Box>

                {product.sizes?.length ? (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                      Size
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {product.sizes.map((size) => (
                        <Chip
                          key={size}
                          label={size}
                          clickable
                          color={selectedSize === size ? "primary" : "default"}
                          variant={selectedSize === size ? "filled" : "outlined"}
                          onClick={() => setSelectedSize(size)}
                        />
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                  <Button
                    variant="contained"
                    size="large"
                    disableElevation
                    onClick={() => {
                      addToCart(product, {
                        color: selectedColor,
                        size: selectedSize,
                        isPreorder: !product.inStock,
                      });
                      setLastAddedAt(Date.now());
                    }}
                    sx={{
                      flex: 1,
                      borderRadius: 999,
                      py: 1.4,
                      textTransform: "none",
                      fontWeight: 900,
                    }}
                  >
                    {recentlyAdded
                      ? product.inStock
                        ? "Added to Cart"
                        : "Preordered"
                      : !product.inStock
                        ? "Preorder Now"
                        : "Add to Cart"}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    sx={{
                      flex: 1,
                      borderRadius: 999,
                      py: 1.4,
                      textTransform: "none",
                      fontWeight: 900,
                    }}
                  >
                    Save for Later
                  </Button>
                </Stack>

                {!product.inStock ? (
                  <Typography variant="body2" color="text.secondary">
                    This item is currently unavailable for immediate dispatch, but you can reserve
                    it with a preorder.
                  </Typography>
                ) : null}

                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleRounded color="success" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Selected {selectedColor ?? "default"} {selectedSize ? `· ${selectedSize}` : ""}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                useFlexGap
                flexWrap="wrap"
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Collection
                  </Typography>
                  <Typography variant="body1" fontWeight={700}>
                    {product.collection ? formatLabel(product.collection) : "General"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Sold by
                  </Typography>
                  <Typography variant="body1" fontWeight={700}>
                    {product.storeName ?? product.sellerName ?? "Marketplace seller"}
                  </Typography>
                  {product.sellerType ? (
                    <Typography variant="body2" color="text.secondary">
                      {sellerTypeLabels[product.sellerType]}
                    </Typography>
                  ) : null}
                  {product.sellerLocation ? (
                    <Typography variant="body2" color="text.secondary">
                      Ships from {product.sellerLocation}
                    </Typography>
                  ) : null}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Tags
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {product.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            {product.storeSlug ? (
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Store
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {product.storeName ?? product.sellerName}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ my: 1 }}>
                      {product.sellerType ? (
                        <Chip label={sellerTypeLabels[product.sellerType]} size="small" variant="outlined" />
                      ) : null}
                      {product.sellerBadge ? (
                        <Chip label={product.sellerBadge} size="small" color="success" variant="outlined" />
                      ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {product.sellerLocation
                        ? `Located in ${product.sellerLocation}. Explore the seller's storefront, follow their shop, or report them if something feels off.`
                        : "Explore the seller's storefront, follow their shop, or report them if something feels off."}
                    </Typography>
                  </Box>
                  <Button
                    component={NextLink}
                    href={`/stores/${product.storeSlug}`}
                    startIcon={<StorefrontRounded />}
                    variant="outlined"
                    sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900, alignSelf: "flex-start" }}
                  >
                    Visit store
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              {highlights.map((item) => (
                <Paper
                  key={item.title}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Stack spacing={1}>
                    {item.icon}
                    <Typography variant="subtitle1" fontWeight={800}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.body}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Box>

        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: "text.primary" }}>
            You May Also Like
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Related products from the same category or collection.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
            }}
          >
            {relatedProducts.length ? (
              relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} size="compact" />
              ))
            ) : (
              <Paper
                elevation={0}
                sx={{
                  gridColumn: "1 / -1",
                  p: 3,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  More suggestions will appear here soon.
                </Typography>
              </Paper>
            )}
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
