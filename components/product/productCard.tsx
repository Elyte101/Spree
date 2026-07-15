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
  /**
   * "micro" is a further ~2/3 scale-down of "compact" (padding, badges,
   * favorite button, Add button, title/price typography) for denser grids
   * like the /products listing — it shares all of "compact"'s layout
   * choices (short "Add" label, no full image sizes hint change) via
   * `isCompact`, and only overrides the specific dimensions that need to
   * shrink further via `isMicro`.
   */
  size?: "default" | "compact" | "micro";
}

export function ProductCard({ product, size = "compact" }: ProductCardProps) {
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [lastAddedAt, setLastAddedAt] = React.useState(0);
  const [hovered, setHovered] = React.useState(false);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const [secondImgError, setSecondImgError] = React.useState(false);
  const liked = isFavorite(product.id);
  const recentlyAdded = lastAddedAt > 0;
  const isCompact = size !== "default";
  const isMicro = size === "micro";
  const priceNum = parseFloat(String(product.price));
  const origPriceNum = product.originalPrice ? parseFloat(String(product.originalPrice)) : 0;
  const discount = origPriceNum
    ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100)
    : 0;

  const allImages = product.images?.length ? product.images : [product.image];
  const primaryImage = allImages[0];
  const secondaryImage = allImages.length > 1 ? allImages[1] : null;
  // Show "Limited" overlay only when the badge explicitly signals scarcity
  const isLimited = Boolean(product.badge?.toLowerCase().includes("limited"));

  React.useEffect(() => {
    if (!recentlyAdded) return;
    const id = window.setTimeout(() => setLastAddedAt(0), 1800);
    return () => window.clearTimeout(id);
  }, [recentlyAdded, lastAddedAt]);

  // Reset load/error state only when the underlying product image actually
  // changes (e.g. this card gets recycled for a different product) — NOT on
  // hover. The hover preview is a separate, always-mounted overlay (see
  // below), so nothing here ever needs to re-fade the primary image.
  React.useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [primaryImage]);

  React.useEffect(() => {
    setSecondImgError(false);
  }, [secondaryImage]);

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
        // Pure CSS hover — the browser's real-time pointer state, not React
        // state, drives this, so a fast enter+leave can never get "stuck":
        // there's no intermediate render where this can be left at 1.
        // Both rules are driven together so exactly one image layer is ever
        // fully opaque: the lead image fades out as the hover preview fades in.
        "&:hover .product-card-hover-preview": {
          opacity: 1,
        },
        "&:hover .product-card-primary-image": {
          opacity: 0,
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
            sx={{
              position: "relative",
              aspectRatio: "1 / 1",
              overflow: "hidden",
              // Padding here insets the absolutely-positioned `fill` images
              // below (their containing block is this box's padding edge),
              // so the background shows as an even gutter around the
              // fully-visible product photo — Amazon-style "floating" image.
              p: isMicro ? 1 : 1.5,
              boxSizing: "border-box",
              // Product photos are shot on pure white — solid white here
              // (not a theme-derived tint, and not background.paper, which
              // is dark in dark mode) so the gutter blends invisibly with
              // every photo in both themes instead of framing it.
              backgroundColor: "#ffffff",
            }}
          >
            {!imgError ? (
              <>
                {!imgLoaded && (
                  <Skeleton
                    variant="rounded"
                    sx={{ position: "absolute", inset: 0, transform: "none" }}
                  />
                )}
                {/* Primary image — always mounted; its load-fade (imgLoaded)
                    is independent of hover. The hover fade-out itself is
                    driven purely by the Card's `:hover` CSS rule targeting
                    this wrapper's className (see Card sx above) — never by
                    the `hovered` React state — so a fast hover-in/out can
                    never leave this "stuck": there's no intermediate render
                    where either state could disagree with the real pointer.
                    Opacity/background live on this wrapper Box rather than
                    Next Image's own inline style, because an inline style
                    can't be overridden by an external CSS class (no
                    !important) — the wrapper's class-based opacity can. */}
                <Box
                  className="product-card-primary-image"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1,
                    opacity: imgLoaded ? 1 : 0,
                    transition: "opacity 0.2s ease",
                    // Opaque so the lead photo never bleeds through the
                    // hover-preview's contain letterbox margins once both
                    // layers briefly overlap during the cross-fade.
                    backgroundColor: "#ffffff",
                  }}
                >
                  <Image
                    src={primaryImage}
                    alt={product.name}
                    fill
                    sizes={
                      isCompact
                        ? "(max-width: 600px) 100vw, 33vw"
                        : "(max-width: 900px) 100vw, 420px"
                    }
                    style={{ objectFit: "contain" }}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                  />
                </Box>
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

            {/* Secondary hover-preview — layered on top of the primary via
                z-index (not just DOM order) and faded in purely via CSS
                :hover on the card below. Never key-based, never touches
                imgLoaded, so a fast hover-in/out can at worst leave this
                overlay transparent — the primary underneath is unaffected
                either way. Opaque white background so it fully covers the
                primary layer once on top, instead of the primary bleeding
                through this image's own contain letterbox margins. */}
            {secondaryImage && !secondImgError && (
              <Box
                className="product-card-hover-preview"
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  opacity: 0,
                  transition: "opacity 0.25s ease",
                  pointerEvents: "none",
                  backgroundColor: "#ffffff",
                }}
              >
                <Image
                  src={secondaryImage}
                  alt=""
                  fill
                  sizes={
                    isCompact
                      ? "(max-width: 600px) 100vw, 33vw"
                      : "(max-width: 900px) 100vw, 420px"
                  }
                  style={{ objectFit: "contain" }}
                  onError={() => setSecondImgError(true)}
                />
              </Box>
            )}

            {/* Image dot indicators — zIndex above both image layers (1, 2)
                so it stays visible whichever one is on top. */}
            {allImages.length > 1 && (
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  position: "absolute",
                  bottom: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 3,
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
                  height: isMicro ? 16 : 22,
                  fontWeight: 800,
                  fontSize: isMicro ? "0.62rem" : "0.7rem",
                  backgroundColor: theme.palette.error.main,
                  color: "#fff",
                  "& .MuiChip-label": { px: isMicro ? 0.5 : 0.75 },
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
                  height: isMicro ? 16 : 22,
                  fontWeight: 700,
                  fontSize: isMicro ? "0.62rem" : "0.7rem",
                  backgroundColor: alpha(theme.palette.warning.main, 0.9),
                  color: "#fff",
                  backdropFilter: "blur(8px)",
                  "& .MuiChip-label": { px: isMicro ? 0.5 : 0.75 },
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
              width: isMicro ? 30 : 44,
              height: isMicro ? 30 : 44,
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
            {liked ? (
              <Favorite sx={{ fontSize: isMicro ? 10 : 15 }} />
            ) : (
              <FavoriteBorder sx={{ fontSize: isMicro ? 10 : 15 }} />
            )}
          </IconButton>
        </Stack>
      </Box>

      {/* Content */}
      <Stack
        spacing={isMicro ? 0.5 : isCompact ? 0.75 : 1}
        sx={{ p: isMicro ? 1 : isCompact ? 1.5 : 2, flexGrow: 1, pt: isMicro ? 0.75 : isCompact ? 1.25 : 1.5 }}
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
              fontSize: isMicro ? "0.6rem" : "0.65rem",
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
              height: isMicro ? 14 : 18,
              fontSize: isMicro ? "0.58rem" : "0.62rem",
              fontWeight: 700,
              flexShrink: 0,
              "& .MuiChip-label": { px: isMicro ? 0.5 : 0.75 },
            }}
          />
        </Stack>

        {/* Product name — clamped to 2 lines with fixed min-height for grid alignment */}
        <Typography
          component={Link}
          href={`/products/${product.slug}`}
          variant={isMicro ? "body2" : isCompact ? "subtitle1" : "h6"}
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

        {/* Store attribution */}
        {product.storeName && (
          <Typography variant="caption" color="text.secondary">
            by {product.storeName}
          </Typography>
        )}

        {/* Rating — hidden when no reviews exist */}
        {product.reviewsCount > 0 ? (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <StarRounded sx={{ fontSize: isMicro ? 12 : 15, color: "#F59E0B" }} />
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
          sx={{ mt: "auto", pt: isMicro ? 0.5 : isCompact ? 0.75 : 1, gap: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant={isMicro ? "body2" : isCompact ? "subtitle1" : "h6"}
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
                    <ShoppingBagOutlined sx={{ fontSize: isMicro ? "10px !important" : "14px !important" }} />
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
                  px: isMicro ? 0.75 : isCompact ? 1.25 : 2,
                  py: isMicro ? 0.4 : 0.6,
                  fontWeight: 700,
                  fontSize: isMicro ? "0.68rem" : "0.75rem",
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
