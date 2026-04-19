'use client';

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Favorite, FavoriteBorder, LocalOfferOutlined, StarRounded } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useCart } from "@/components/providers/cartProvider";
import { useFavorites } from "@/components/providers/favoritesProvider";
import { Product } from "@/types/types";

interface ProductCardProps {
  product: Product;
  size?: "default" | "compact";
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

export function ProductCard({ product, size = "compact" }: ProductCardProps) {
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [lastAddedAt, setLastAddedAt] = React.useState(0);
  const isCompact = size === "compact";
  const liked = isFavorite(product.id);
  const tallViewportQuery = "@media (min-height: 800px)";
  const recentlyAdded = lastAddedAt > 0;

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

  return (
    <Card
      elevation={0}
      sx={(theme) => ({
        height: "100%",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        borderRadius: isCompact ? 3 : 4,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        ...(isCompact
          ? {}
          : {
              [tallViewportQuery]: {
                maxWidth: 420,
                mx: "auto",
              },
            }),
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 18px 40px ${alpha(
            theme.palette.common.black,
            theme.palette.mode === "dark" ? 0.28 : 0.12
          )}`,
          borderColor: "primary.main",
        },
      })}
    >
      <Box
        sx={{
          position: "relative",
          px: isCompact ? 1.25 : 2,
          pt: isCompact ? 1.25 : 2,
          ...(isCompact
            ? {}
            : {
                [tallViewportQuery]: {
                  px: 1.75,
                  pt: 1.75,
                },
              }),
        }}
      >
        <Box
          component={Link}
          href={`/products/${product.slug}`}
          sx={{
            display: "block",
            textDecoration: "none",
          }}
        >
          <Box
            sx={(theme) => ({
              position: "relative",
              minHeight: isCompact ? 180 : 260,
              aspectRatio: isCompact ? "4 / 5" : "5 / 6",
              borderRadius: isCompact ? 2.5 : 3,
              background: `linear-gradient(145deg, ${alpha(
                theme.palette.primary.main,
                theme.palette.mode === "dark" ? 0.2 : 0.14
              )}, ${alpha(
                theme.palette.background.default,
                theme.palette.mode === "dark" ? 0.92 : 0.95
              )})`,
              overflow: "hidden",
              ...(isCompact
                ? {}
                : {
                    [tallViewportQuery]: {
                      minHeight: 220,
                    },
                  }),
            })}
            >
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes={
                isCompact
                  ? "(max-width: 600px) 100vw, (max-width: 1200px) 33vw, 220px"
                  : "(max-width: 900px) 100vw, 420px"
              }
              style={{
                objectFit: "cover",
                objectPosition: "center",
              }}
            />
          </Box>
        </Box>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{
            position: "absolute",
            top: isCompact ? 16 : 24,
            left: isCompact ? 16 : 24,
            right: isCompact ? 16 : 24,
            pointerEvents: "none",
          }}
        >
          {product.badge ? (
            <Chip
              icon={<LocalOfferOutlined />}
              label={product.badge}
              size="small"
              sx={(theme) => ({
                pointerEvents: "auto",
                borderRadius: 2,
                color: theme.palette.text.primary,
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.42 : 0.18),
                backgroundColor: alpha(
                  theme.palette.background.paper,
                  theme.palette.mode === "dark" ? 0.82 : 0.9
                ),
                backdropFilter: "blur(8px)",
                height: isCompact ? 24 : undefined,
                "& .MuiChip-label": {
                  px: isCompact ? 0.75 : undefined,
                },
                "& .MuiChip-icon": {
                  color: theme.palette.primary.main,
                },
              })}
            />
          ) : (
            <span />
          )}
          <IconButton
            size="small"
            aria-label={liked ? `Remove ${product.name} from saved items` : `Save ${product.name}`}
            onClick={() => toggleFavorite(product.id)}
            sx={(theme) => ({
              pointerEvents: "auto",
              color: liked ? theme.palette.primary.main : theme.palette.text.primary,
              border: "1px solid",
              borderColor: liked
                ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.66 : 0.34)
                : alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.38 : 0.16),
              backgroundColor: liked
                ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.12)
                : alpha(
                    theme.palette.background.paper,
                    theme.palette.mode === "dark" ? 0.82 : 0.9
                  ),
              backdropFilter: "blur(8px)",
              p: isCompact ? 0.625 : undefined,
              transition:
                "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease",
              "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.16),
                borderColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.72 : 0.36),
                color: theme.palette.primary.main,
                transform: "translateY(-1px)",
              },
            })}
          >
            {liked ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>

      <Stack
        spacing={isCompact ? 1.1 : 1.35}
        sx={{
          p: isCompact ? 1.5 : 2.25,
          flexGrow: 1,
          ...(isCompact
            ? {}
            : {
                [tallViewportQuery]: {
                  p: 2,
                },
              }),
        }}
      >
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Box width="100%">
            <Stack direction="row" justifyContent="space-between" alignItems="center" alignContent="center" sx={{ mb:"5px" }}>
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1 }}>
                {product.brand.toUpperCase()}
              </Typography>
              <Chip
              label={product.inStock ? "In Stock" : "Preorder"}
              color={product.inStock ? "success" : "warning"}
              size="small"
              variant="filled"
              />
            </Stack>
            <Typography
              component={Link}
              href={`/products/${product.slug}`}
              variant={isCompact ? "subtitle1" : "h6"}
              sx={{
                mt: 0.5,
                lineHeight: 1.2,
                fontWeight: isCompact ? 700 : undefined,
                color: "text.primary",
                textDecoration: "none",
                "&:hover": {
                  color: "primary.main",
                },
              }}
            >
              {product.name}
            </Typography>
          </Box>
        </Stack>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={
            isCompact
              ? {
                  display: "-webkit-box",
                  overflow: "hidden",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }
              : {
                  display: "-webkit-box",
                  overflow: "hidden",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }
          }
        >
          {product.description}
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {product.colors.slice(0, isCompact ? 2 : 3).map((color) => (
            <Chip key={color} label={color} size="small" variant="outlined" />
          ))}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          <StarRounded color="warning" sx={{ fontSize: 18 }} />
          <Typography variant="body2" fontWeight={700}>
            {product.rating.toFixed(1)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ({product.reviewCount} reviews)
          </Typography>
        </Stack>

        <Stack
          direction="row"
          alignItems="flex-end"
          justifyContent="space-between"
          spacing={1}
          sx={{ mt: "auto", pt: isCompact ? 0.5 : 1 }}
        >
          <Box>
            <Typography variant={isCompact ? "subtitle1" : "h6"} fontWeight={800}>
              {formatPrice(product.price)}
            </Typography>
            {product.originalPrice ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textDecoration: "line-through" }}
              >
                {formatPrice(product.originalPrice)}
              </Typography>
            ) : null}
          </Box>
          <Stack
            direction={isCompact ? "column" : { xs: "column", sm: "row" }}
            spacing={0.75}
            alignItems="stretch"
          >
            <Button
              component={Link}
              href={`/products/${product.slug}`}
              variant="outlined"
              size={isCompact ? "small" : "medium"}
              sx={{
                borderRadius: 999,
                px: isCompact ? 1.5 : 2,
                textTransform: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {isCompact ? "Details" : "View Details"}
            </Button>
            <Button
              variant="contained"
              size={isCompact ? "small" : "medium"}
              disableElevation
              onClick={() => {
                addToCart(product, {
                  color: product.colors[0],
                  size: product.sizes?.[0],
                  isPreorder: !product.inStock,
                });
                setLastAddedAt(Date.now());
              }}
              sx={{
                borderRadius: 999,
                px: isCompact ? 1.75 : 2.5,
                textTransform: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {recentlyAdded
                ? product.inStock
                  ? "Added"
                  : "Preordered"
                : !product.inStock
                  ? "Preorder"
                  : isCompact
                    ? "Add"
                    : "Add to Cart"}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}
