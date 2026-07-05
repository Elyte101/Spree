'use client';

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BrokenImageRounded,
  Favorite,
  FavoriteBorder,
  ShoppingBagOutlined,
  StarRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { motion, AnimatePresence } from "motion/react";
import { useCart } from "@/components/providers/cartProvider";
import { useFavorites } from "@/components/providers/favoritesProvider";
import { Product } from "@/types/types";
import { formatPrice } from "@/lib/ghana";

interface ProductCardProps {
  product: Product;
  size?: "default" | "compact";
}

export function ProductCard({ product, size = "compact" }: ProductCardProps) {
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [lastAddedAt, setLastAddedAt] = React.useState(0);
  const [hovered, setHovered] = React.useState(false);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const liked = isFavorite(product.id);
  const recentlyAdded = lastAddedAt > 0;
  const isCompact = size === "compact";
  const priceNum = parseFloat(String(product.price));
  const origPriceNum = product.originalPrice ? parseFloat(String(product.originalPrice)) : 0;
  const discount = origPriceNum
    ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100)
    : 0;

  const allImages = product.images?.length ? product.images : [product.image];
  const heroImage = hovered && allImages.length > 1 ? allImages[1] : allImages[0];
  // Show "Limited" overlay only when the badge explicitly signals scarcity
  const isLimited = Boolean(product.badge?.toLowerCase().includes("limited"));

  React.useEffect(() => {
    if (!recentlyAdded) return;
    const id = window.setTimeout(() => setLastAddedAt(0), 1800);
    return () => window.clearTimeout(id);
  }, [recentlyAdded, lastAddedAt]);

  // Reset both image states when the displayed src changes (e.g. hover to second image)
  React.useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [heroImage]);

  return (
    <Card
      elevation={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={(theme) => ({
        height: "100%",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        borderRadius: 3,
        overflow: "hidden",
        border: "1.5px solid",
        borderColor: hovered ? "primary.main" : theme.palette.divider,
        backgroundColor: "background.paper",
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 2px 12px rgba(0,0,0,0.32)"
            : "0 2px 8px rgba(0,0,0,0.06)",
        transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
        cursor: "pointer",
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: `0 20px 48px ${alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 0.22 : 0.14
          )}`,
        },
      })}
    >
      {/* Image zone — no padding; Card overflow:hidden clips corners */}
      <Box sx={{ position: "relative" }}>
        <Box
          component={Link}
          href={`/products/${product.slug}`}
          sx={{ display: "block", textDecoration: "none" }}
        >
          <Box
            sx={(theme) => ({
              position: "relative",
              aspectRatio: "1 / 1",
              overflow: "hidden",
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.08)
                  : alpha(theme.palette.primary.main, 0.04),
            })}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={heroImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ position: "absolute", inset: 0 }}
              >
                {!imgError ? (
                  <>
                    {!imgLoaded && (
                      <Skeleton
                        variant="rounded"
                        sx={{ position: "absolute", inset: 0, transform: "none" }}
                      />
                    )}
                    <Image
                      src={heroImage}
                      alt={product.name}
                      fill
                      sizes={
                        isCompact
                          ? "(max-width: 600px) 100vw, 33vw"
                          : "(max-width: 900px) 100vw, 420px"
                      }
                      style={{
                        objectFit: "cover",
                        opacity: imgLoaded ? 1 : 0,
                        transition: "opacity 0.2s ease",
                      }}
                      onLoad={() => setImgLoaded(true)}
                      onError={() => setImgError(true)}
                    />
                  </>
                ) : (
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    spacing={0.75}
                    sx={(theme) => ({
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(135deg, ${alpha(
                        theme.palette.primary.main,
                        0.07
                      )}, ${alpha(theme.palette.secondary.main, 0.07)})`,
                    })}
                  >
                    <BrokenImageRounded sx={{ fontSize: 36, color: "text.disabled" }} />
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ textAlign: "center", px: 1 }}
                    >
                      Image unavailable
                    </Typography>
                  </Stack>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Image dot indicators */}
            {allImages.length > 1 && (
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  position: "absolute",
                  bottom: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                {allImages.slice(0, 4).map((_, i) => (
                  <Box
                    key={i}
                    sx={(theme) => ({
                      width: i === (hovered ? 1 : 0) ? 16 : 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: alpha(theme.palette.common.white, 0.9),
                      transition: "width 0.2s ease",
                    })}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </Box>

        {/* Overlaid badges — left: discount + limited; right: favorite */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            pointerEvents: "none",
          }}
        >
          <Stack direction="column" spacing={0.5}>
            {discount > 0 && (
              <Chip
                label={`−${discount}%`}
                size="small"
                sx={(theme) => ({
                  pointerEvents: "auto",
                  borderRadius: 1.5,
                  height: 22,
                  fontWeight: 800,
                  fontSize: "0.7rem",
                  backgroundColor: theme.palette.error.main,
                  color: "#fff",
                  "& .MuiChip-label": { px: 0.75 },
                })}
              />
            )}
            {isLimited && (
              <Chip
                label="Limited"
                size="small"
                sx={(theme) => ({
                  pointerEvents: "auto",
                  borderRadius: 1.5,
                  height: 22,
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  backgroundColor: alpha(theme.palette.warning.main, 0.9),
                  color: "#fff",
                  backdropFilter: "blur(8px)",
                  "& .MuiChip-label": { px: 0.75 },
                })}
              />
            )}
          </Stack>

          <IconButton
            size="small"
            aria-label={liked ? `Remove ${product.name} from saved` : `Save ${product.name}`}
            onClick={(e) => { e.preventDefault(); toggleFavorite(product.id); }}
            sx={(theme) => ({
              pointerEvents: "auto",
              width: 44,
              height: 44,
              color: liked ? "#EF4444" : theme.palette.text.primary,
              backgroundColor: alpha(
                theme.palette.background.paper,
                theme.palette.mode === "dark" ? 0.82 : 0.92
              ),
              backdropFilter: "blur(8px)",
              border: "1px solid",
              borderColor: liked ? alpha("#EF4444", 0.3) : theme.palette.divider,
              transition: "all 0.18s ease",
              "&:hover": {
                backgroundColor: alpha("#EF4444", 0.08),
                borderColor: alpha("#EF4444", 0.4),
                color: "#EF4444",
                transform: "scale(1.08)",
              },
            })}
          >
            {liked ? <Favorite sx={{ fontSize: 15 }} /> : <FavoriteBorder sx={{ fontSize: 15 }} />}
          </IconButton>
        </Stack>
      </Box>

      {/* Content */}
      <Stack
        spacing={isCompact ? 0.75 : 1}
        sx={{ p: isCompact ? 1.5 : 2, flexGrow: 1, pt: isCompact ? 1.25 : 1.5 }}
      >
        {/* Brand + stock status */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={0.5}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              letterSpacing: "0.08em",
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: "0.65rem",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {product.brand}
          </Typography>
          <Chip
            label={product.inStock ? "In stock" : "Preorder"}
            size="small"
            color={product.inStock ? "success" : "warning"}
            sx={{
              height: 18,
              fontSize: "0.62rem",
              fontWeight: 700,
              flexShrink: 0,
              "& .MuiChip-label": { px: 0.75 },
            }}
          />
        </Stack>

        {/* Product name — clamped to 2 lines with fixed min-height for grid alignment */}
        <Typography
          component={Link}
          href={`/products/${product.slug}`}
          variant={isCompact ? "subtitle1" : "h6"}
          sx={{
            lineHeight: 1.3,
            fontWeight: 700,
            color: "text.primary",
            textDecoration: "none",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.6em",
            "&:hover": { color: "primary.main" },
          }}
        >
          {product.name}
        </Typography>

        {/* Store link */}
        {product.storeName && product.storeSlug && (
          <Typography
            component={Link}
            href={`/stores/${product.storeSlug}`}
            variant="caption"
            color="text.secondary"
            sx={{ textDecoration: "none", "&:hover": { color: "primary.main" } }}
          >
            by {product.storeName}
          </Typography>
        )}

        {/* Rating — hidden when no reviews exist */}
        {product.reviewsCount > 0 ? (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <StarRounded sx={{ fontSize: 15, color: "#F59E0B" }} />
            <Typography variant="caption" fontWeight={700} color="text.primary">
              {product.rating.toFixed(1)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({product.reviewsCount})
            </Typography>
          </Stack>
        ) : (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
            No reviews yet
          </Typography>
        )}

        {/* Price + CTA — dedicated bottom row, never overlapping */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mt: "auto", pt: isCompact ? 0.75 : 1, gap: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant={isCompact ? "subtitle1" : "h6"}
              fontWeight={800}
              color="primary.main"
              lineHeight={1}
              noWrap
            >
              {formatPrice(product.price)}
            </Typography>
            {product.originalPrice && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textDecoration: "line-through", lineHeight: 1.2 }}
              >
                {formatPrice(product.originalPrice)}
              </Typography>
            )}
          </Box>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={recentlyAdded ? "added" : "add"}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
            >
              <Button
                variant={recentlyAdded ? "outlined" : "contained"}
                size="small"
                color={recentlyAdded ? "success" : "primary"}
                disableElevation
                startIcon={
                  !recentlyAdded ? (
                    <ShoppingBagOutlined sx={{ fontSize: "14px !important" }} />
                  ) : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (recentlyAdded) return;
                  addToCart(product, {
                    color: product.colors[0],
                    size: product.sizes?.[0],
                    isPreorder: !product.inStock,
                  });
                  setLastAddedAt(Date.now());
                }}
                sx={{
                  borderRadius: 999,
                  px: isCompact ? 1.25 : 2,
                  py: 0.6,
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {recentlyAdded
                  ? "Added ✓"
                  : !product.inStock
                    ? "Preorder"
                    : isCompact
                      ? "Add"
                      : "Add to cart"}
              </Button>
            </motion.div>
          </AnimatePresence>
        </Stack>
      </Stack>
    </Card>
  );
}
