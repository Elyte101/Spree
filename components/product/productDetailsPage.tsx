'use client';

import * as React from "react";
import NextLink from "next/link";
import { ProductImage } from "@/components/ui/productImage";
import {
  ArrowBackRounded,
  CheckCircleRounded,
  LocalShippingOutlined,
  ReplayOutlined,
  StarRounded,
  VerifiedRounded,
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
import { Product, ProductComment, SellerSummary } from "@/types/types";
import { ProductCard } from "@/components/product/productCard";
import { ProductReviews } from "@/components/product/productReviews";
import { StarRating } from "@/components/ui/starRating";
import { formatPrice } from "@/lib/ghana";

interface ProductDetailsPageProps {
  product: Product;
  relatedProducts: Product[];
  initialComments: ProductComment[];
  seller?: SellerSummary;
}

const formatLabel = (value: string) =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const sellerTypeLabels: Record<NonNullable<Product["sellerType"]>, string> = {
  retail: "Retail vendor",
  wholesale: "Wholesale vendor",
};

export function ProductDetailsPage({
  product,
  relatedProducts,
  initialComments,
  seller,
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
      body: "5-day returns policy on eligible unworn items.",
    },
    {
      icon: <WorkspacePremiumRounded fontSize="small" color="primary" />,
      title: "Trusted vendors",
      body: "Every vendor is identity-verified, and buyers who've received their order can leave a review.",
    },
  ];

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100%",
        pb: { xs: "76px", lg: 0 },
        background: `radial-gradient(circle at top right, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.18 : 0.1
        )}, transparent 28%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, md: 4 } }}>
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
          <Stack spacing={1.5}>
            {/* ── Main image — no padding, image fills edge-to-edge ── */}
            <Paper
              elevation={0}
              sx={(theme) => ({
                p: 0,
                borderRadius: { xs: 2, md: 2.5 },
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.22 : 0.16),
                overflow: "hidden",
                boxShadow: `0 2px 28px ${alpha(theme.palette.primary.main, 0.07)}`,
              })}
            >
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  // 4:3 gives compact landscape crop; maxHeight prevents
                  // dominating the viewport on very wide containers.
                  aspectRatio: "4 / 3",
                  maxHeight: { xs: "72vw", md: 500 },
                }}
              >
                <ProductImage
                  src={selectedImage}
                  alt={product.name}
                  sizes="(max-width: 1024px) 100vw, 560px"
                  priority
                />
              </Box>
            </Paper>

            {/* ── Thumbnails — square tiles, horizontal scroll row ── */}
            {product.images.length > 1 && (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  overflowX: "auto",
                  // Reserve bottom space for the thin scrollbar so it doesn't
                  // clip the bottom border of the last row.
                  pb: "3px",
                  scrollSnapType: "x mandatory",
                  // Thin, unobtrusive scrollbar on webkit.
                  "&::-webkit-scrollbar": { height: 3 },
                  "&::-webkit-scrollbar-thumb": {
                    borderRadius: 99,
                    bgcolor: "divider",
                  },
                }}
              >
                {product.images.map((image, i) => (
                  <Box
                    key={image}
                    component="button"
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    aria-label={`View image ${i + 1}`}
                    aria-pressed={selectedImage === image}
                    sx={(theme) => ({
                      // Fixed square — never stretches to fill a grid column.
                      flexShrink: 0,
                      width: { xs: 62, sm: 76, md: 88 },
                      height: { xs: 62, sm: 76, md: 88 },
                      // No padding — image fills the tile completely.
                      p: 0,
                      position: "relative",
                      borderRadius: { xs: 1.5, md: 2 },
                      overflow: "hidden",
                      cursor: "pointer",
                      scrollSnapAlign: "start",
                      bgcolor: "background.paper",
                      // Selected: accent border + outer ring.
                      border: "2px solid",
                      borderColor: selectedImage === image
                        ? "primary.main"
                        : alpha(theme.palette.divider, 1),
                      outline: selectedImage === image
                        ? `3px solid ${alpha(theme.palette.primary.main, 0.28)}`
                        : "3px solid transparent",
                      outlineOffset: "1px",
                      transition: "border-color 0.18s ease, outline 0.18s ease, transform 0.18s ease",
                      "&:hover": {
                        borderColor: "primary.main",
                        transform: "scale(1.06)",
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: "2px",
                      },
                    })}
                  >
                    <ProductImage
                      src={image}
                      alt={`${product.name} view ${i + 1}`}
                      sizes="88px"
                    />
                  </Box>
                ))}
              </Box>
            )}
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
                  based on {product.reviewsCount} review{product.reviewsCount === 1 ? "" : "s"}
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
                    {product.storeName ?? product.sellerName ?? "Marketplace vendor"}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    {product.sellerType ? (
                      <Typography variant="body2" color="text.secondary">
                        {sellerTypeLabels[product.sellerType]}
                      </Typography>
                    ) : null}
                    {product.sellerVerified ? (
                      <Stack direction="row" spacing={0.25} alignItems="center">
                        <VerifiedRounded sx={{ fontSize: 15, color: "success.main" }} />
                        <Typography variant="body2" color="success.main" fontWeight={700}>
                          Verified
                        </Typography>
                      </Stack>
                    ) : null}
                  </Stack>
                  {seller && seller.sellerReviewsCount > 0 ? (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                      <StarRating value={seller.sellerRating} size={14} />
                      <Typography variant="body2" color="text.secondary">
                        {seller.sellerRating.toFixed(1)} ({seller.sellerReviewsCount})
                      </Typography>
                    </Stack>
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

        <ProductReviews productId={product.id} initialComments={initialComments} />

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

      {/* Sticky Add-to-Cart bar — mobile only */}
      <Box
        sx={(theme) => ({
          display: { xs: "flex", lg: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.25,
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: "blur(16px)",
          borderTop: "1px solid",
          borderColor: theme.palette.divider,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.10)",
        })}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {product.name}
          </Typography>
          <Typography variant="subtitle1" color="primary.main" fontWeight={800} lineHeight={1.2}>
            {formatPrice(product.price)}
          </Typography>
        </Box>
        <Button
          variant="contained"
          disableElevation
          onClick={() => {
            addToCart(product, {
              color: selectedColor,
              size: selectedSize,
              isPreorder: !product.inStock,
            });
            setLastAddedAt(Date.now());
          }}
          sx={{ borderRadius: 999, fontWeight: 800, whiteSpace: "nowrap", minWidth: 140, py: 1.25 }}
        >
          {recentlyAdded
            ? product.inStock ? "Added ✓" : "Preordered ✓"
            : product.inStock ? "Add to Cart" : "Preorder Now"}
        </Button>
      </Box>
    </Box>
  );
}
