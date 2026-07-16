'use client';

import * as React from "react";
import NextLink from "next/link";
import { ProductImage } from "@/components/ui/productImage";
import {
  ArrowBackRounded,
  CheckCircleRounded,
  CloseRounded,
  LocalShippingOutlined,
  ReplayOutlined,
  StarRounded,
  VerifiedRounded,
  WorkspacePremiumRounded,
  ZoomInRounded,
} from "@mui/icons-material";
import {
  alpha,
  Breadcrumbs,
  Box,
  Button,
  Chip,
  Divider,
  Fade,
  IconButton,
  Link,
  Modal,
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
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const openLightbox = () => setLightboxOpen(true);
  const closeLightbox = () => setLightboxOpen(false);
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
            {/* ── Main image — capped + centered, like the lightbox's own
                min(92vw,900px) box, instead of stretching to the full grid
                column edge-to-edge ── */}
            <Paper
              elevation={0}
              sx={(theme) => ({
                p: 0,
                width: "100%",
                // Mobile: fills the column. Tablet/desktop: capped and
                // centered so the box itself is sized close to the photo
                // rather than an oversized frame around a small image.
                maxWidth: { xs: "100%", sm: 420, md: 500 },
                mx: "auto",
                borderRadius: { xs: 2, md: 2.5 },
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.22 : 0.16),
                overflow: "hidden",
                boxShadow: `0 2px 28px ${alpha(theme.palette.primary.main, 0.07)}`,
              })}
            >
              <Box
                role="button"
                tabIndex={0}
                aria-label="View full-size image"
                onClick={openLightbox}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openLightbox();
                  }
                }}
                sx={(theme) => ({
                  position: "relative",
                  width: "100%",
                  // Square + object-fit: contain (below) fits both portrait
                  // and landscape product photos without ever cropping —
                  // no forced non-square ratio, and maxHeight keeps it from
                  // dominating the viewport on short/wide windows, same as
                  // the lightbox's own min(85vh, 900px) cap.
                  aspectRatio: "1 / 1",
                  maxHeight: "70vh",
                  // Product photos are shot on white — solid white so
                  // contain's letterboxing reads as intentional padding
                  // rather than a mismatched frame (same treatment as the
                  // product-listing cards).
                  bgcolor: "#ffffff",
                  cursor: "pointer",
                  "&:focus-visible": {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: "2px",
                  },
                  "&:hover .zoom-affordance": {
                    opacity: 1,
                  },
                })}
              >
                <ProductImage
                  src={selectedImage}
                  alt={product.name}
                  // The box now caps at 420px (sm, 600-899px) / 500px (md+,
                  // 900px+) instead of stretching to the grid column, so
                  // those caps — not the grid's own breakpoint — are the
                  // real rendered width above 600px viewport width.
                  sizes="(max-width: 599px) 100vw, (max-width: 899px) 420px, 500px"
                  priority
                  objectFit="contain"
                />
                <Box
                  className="zoom-affordance"
                  aria-hidden
                  sx={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: alpha("#000", 0.55),
                    color: "#fff",
                    opacity: { xs: 1, md: 0 },
                    transition: "opacity 0.18s ease",
                    pointerEvents: "none",
                  }}
                >
                  <ZoomInRounded sx={{ fontSize: 19 }} />
                </Box>
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
                      // Small padding insets the contained image (its
                      // containing block is this box's padding edge) so a
                      // portrait photo doesn't touch the tile edges.
                      p: 0.5,
                      boxSizing: "border-box",
                      position: "relative",
                      borderRadius: { xs: 1.5, md: 2 },
                      overflow: "hidden",
                      cursor: "pointer",
                      scrollSnapAlign: "start",
                      // Product photos are shot on white — solid white (not
                      // background.paper, which is dark in dark mode) so the
                      // gutter blends invisibly, same treatment as the hero
                      // image and the /products listing cards.
                      bgcolor: "#ffffff",
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
                    {/* Explicit objectFit="contain" (not the component's
                        implicit "cover" default) — set once here, in the
                        single place every thumbnail renders through, so
                        every tile shows the full product uniformly instead
                        of a per-tile-inconsistent crop. */}
                    <ProductImage
                      src={image}
                      alt={`${product.name} view ${i + 1}`}
                      sizes="88px"
                      objectFit="contain"
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

      {/* Full-image lightbox — shows whichever image is currently selected */}
      <Modal
        open={lightboxOpen}
        onClose={closeLightbox}
        closeAfterTransition
        role="dialog"
        aria-modal="true"
        aria-label={`Full-size view of ${product.name}`}
      >
        <Fade in={lightboxOpen}>
          <Box
            onClick={closeLightbox}
            sx={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: { xs: 2, sm: 4 },
              outline: "none",
            }}
          >
            <IconButton
              aria-label="Close image viewer"
              onClick={closeLightbox}
              sx={{
                position: "fixed",
                top: { xs: 12, sm: 20 },
                right: { xs: 12, sm: 20 },
                color: "#fff",
                bgcolor: alpha("#000", 0.45),
                "&:hover": { bgcolor: alpha("#000", 0.65) },
              }}
            >
              <CloseRounded />
            </IconButton>
            <Box
              onClick={(event) => event.stopPropagation()}
              sx={{
                position: "relative",
                width: "min(92vw, 900px)",
                height: "min(85vh, 900px)",
              }}
            >
              <ProductImage
                src={selectedImage}
                alt={product.name}
                sizes="92vw"
                objectFit="contain"
              />
            </Box>
          </Box>
        </Fade>
      </Modal>
    </Box>
  );
}
