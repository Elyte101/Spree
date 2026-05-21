'use client';

import Link from "next/link";
import Image from "next/image";
import {
  ArrowOutward,
  AutoAwesomeRounded,
  GridViewRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  ShoppingBagOutlined,
  StorefrontOutlined,
  WorkspacePremiumRounded,
} from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useCart } from "@/components/providers/cartProvider";
import { ProductCard } from "@/components/product/productCard";
import { HomeFeed, Product } from "@/types/types";

interface LandingPageProps {
  homeFeed: HomeFeed;
  featuredProducts: Product[];
  newArrivals: Product[];
  totalProducts: number;
  averageRating: number;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

export function LandingPage({
  homeFeed,
  featuredProducts,
  newArrivals,
  totalProducts,
  averageRating,
}: LandingPageProps) {
  const { itemCount: cartItemCount } = useCart();
  const hasProducts = totalProducts > 0;
  const hero = homeFeed.hero;
  const heroTitle = hero?.title ?? (hasProducts ? "Find something you'll love." : "A fresh collection is on the way.");
  const heroSubtitle =
    hero?.subtitle ??
    (hasProducts
      ? "Browse popular picks, explore new arrivals, and discover what fits your style."
      : "We're getting the shop ready. Please check back soon for the first arrivals.");
  const primaryCta = {
    href: hero?.ctaHref ?? "/products",
    label: hero?.ctaLabel ?? (hasProducts ? "Shop now" : "Browse the shop"),
  };
  const statCards = [
    {
      icon: <StorefrontOutlined color="primary" />,
      label: "Products",
      value: `${totalProducts}`,
      helper: "ready to browse",
    },
    {
      icon: <GridViewRounded color="primary" />,
      label: "Categories",
      value: `${homeFeed.categories.length}`,
      helper: "ways to shop",
    },
    {
      icon: <WorkspacePremiumRounded color="primary" />,
      label: "Brands",
      value: `${homeFeed.brands.length}`,
      helper: "favorite names",
    },
    {
      icon: <ShoppingBagOutlined color="primary" />,
      label: "Cart",
      value: `${cartItemCount}`,
      helper: "item(s) saved for later",
    },
  ];

  const renderEmptyPanel = (title: string, description: string) => (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "action.hover",
      }}
    >
      <Stack spacing={1.5} alignItems="flex-start">
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
        <Button
          component={Link}
          href="/products"
          variant="contained"
          sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
        >
          Browse products
        </Button>
      </Stack>
    </Paper>
  );

  return (
    <Box
      component="main"
      sx={(theme) => ({
        minHeight: "100vh",
        px: { xs: 1.5, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.2 : 0.12
        )}, transparent 28%), radial-gradient(circle at 85% 10%, ${alpha(
          theme.palette.secondary.main,
          theme.palette.mode === "dark" ? 0.16 : 0.12
        )}, transparent 22%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={{ xs: 4, md: 5 }}>
        <Paper
          elevation={0}
          sx={(theme) => ({
            position: "relative",
            overflow: "hidden",
            borderRadius: 3,
            p: { xs: 2.5, md: 4 },
            border: "1px solid",
            borderColor: "divider",
            background: `linear-gradient(135deg, ${alpha(
              theme.palette.background.paper,
              theme.palette.mode === "dark" ? 0.94 : 0.96
            )} 0%, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.1)} 100%)`,
          })}
        >
          <Box
            sx={(theme) => ({
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 20% 25%, ${alpha(
                theme.palette.common.white,
                theme.palette.mode === "dark" ? 0.08 : 0.45
              )} 0%, transparent 20%), radial-gradient(circle at 90% 15%, ${alpha(
                theme.palette.primary.main,
                theme.palette.mode === "dark" ? 0.12 : 0.16
              )} 0%, transparent 22%)`,
            })}
          />

          <Box
            sx={{
              position: "relative",
              display: "grid",
              gap: { xs: 2.5, md: 3 },
              alignItems: "center",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
              },
            }}
          >
            <Stack spacing={2.5} sx={{ maxWidth: 760 }}>
              <Chip
                icon={<AutoAwesomeRounded />}
                label={hasProducts ? "Featured picks" : "Spree Storefront"}
                color="primary"
                sx={{ width: "fit-content", borderRadius: 999 }}
              />
              <Typography variant="h2" sx={{ fontWeight: 900, lineHeight: 0.95 }}>
                {heroTitle}
              </Typography>
              <Typography
                variant="h6"
                sx={(theme) => ({
                  maxWidth: 640,
                  color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                })}
              >
                {heroSubtitle}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  component={Link}
                  href={primaryCta.href}
                  variant="contained"
                  endIcon={<ArrowOutward />}
                  sx={{
                    borderRadius: 999,
                    px: 3,
                    py: 1.3,
                    textTransform: "none",
                    fontWeight: 900,
                  }}
                >
                  {primaryCta.label}
                </Button>
                <Button
                  component={Link}
                  href="/products"
                  variant="outlined"
                  sx={{
                    borderRadius: 999,
                    px: 3,
                    py: 1.3,
                    textTransform: "none",
                    fontWeight: 900,
                  }}
                >
                  {hasProducts ? "View all products" : "See what's available"}
                </Button>
              </Stack>
              {homeFeed.brands.length ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {homeFeed.brands.map((brand) => (
                    <Chip
                      key={brand.id}
                      label={brand.name}
                      variant="outlined"
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              ) : null}
            </Stack>

            <Stack spacing={2}>
              <Paper
                elevation={0}
                sx={(theme) => ({
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  background: `linear-gradient(145deg, ${alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark" ? 0.18 : 0.12
                  )}, ${alpha(
                    theme.palette.background.paper,
                    theme.palette.mode === "dark" ? 0.88 : 0.96
                  )})`,
                })}
              >
                {hero?.image ? (
                  <Box
                    sx={{
                      position: "relative",
                      minHeight: { xs: 260, sm: 300, md: 340 },
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      src={"/spreelogo.png"}
                      alt={heroTitle}
                      fill
                      sizes="(max-width: 600px) 100vw, 520px"
                      style={{ objectFit: "contain", padding: 10 }}
                      priority
                    />
                  </Box>
                ) : (
                  <Stack
                    justifyContent="center"
                    spacing={1}
                    sx={{
                      minHeight: { xs: 260, sm: 300, md: 340 },
                      borderRadius: 2,
                      px: 3,
                      py: 4,
                      border: "1px dashed",
                      borderColor: "divider",
                      backgroundColor: "action.hover",
                    }}
                  >
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>
                      {hasProducts ? "Popular picks" : "We're getting ready"}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {hasProducts
                        ? "Take a look at what's available right now."
                        : "New items will appear here as soon as the shop is ready."}
                    </Typography>
                  </Stack>
                )}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={2}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  sx={{ pt: 1.5 }}
                >
                  <Box>
                    <Typography
                      variant="body2"
                      sx={(theme) => ({
                        color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                      })}
                    >
                      Customer rating
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      {hasProducts ? `${averageRating.toFixed(1)} average rating` : "No ratings yet"}
                    </Typography>
                  </Box>
                  <Chip
                    icon={<LocalShippingRounded />}
                    label={hasProducts ? "Ready to shop" : "More items coming soon"}
                    sx={{ alignSelf: "center", borderRadius: 999 }}
                  />
                </Stack>
              </Paper>

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={(theme) => ({
                      color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                    })}
                  >
                    New arrivals
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                    {newArrivals.length}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={(theme) => ({
                      color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                    })}
                  >
                    styles added recently
                  </Typography>
                </Paper>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={(theme) => ({
                      color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                    })}
                  >
                    Collections
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                    {homeFeed.collections.length}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={(theme) => ({
                      color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                    })}
                  >
                    curated collections
                  </Typography>
                </Paper>
              </Box>
            </Stack>
          </Box>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          {statCards.map((item) => (
            <Paper
              key={item.label}
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={1.5}>
                {item.icon}
                <Typography variant="body2" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {item.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.helper}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Box>

        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1.5}
            alignItems={{ xs: "flex-start", md: "flex-end" }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 0.95, color: "text.primary" }}>
                Shop by category
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
                Explore the store by the kinds of items you need most.
              </Typography>
            </Box>
            <Button
              component={Link}
              href="/products"
              variant="text"
              endIcon={<ArrowOutward />}
              sx={{ textTransform: "none", fontWeight: 900 }}
            >
              View full catalog
            </Button>
          </Stack>

          {homeFeed.categories.length ? (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(4, minmax(0, 1fr))",
                },
              }}
            >
              {homeFeed.categories.map((category) => (
                <Paper
                  key={category.id}
                  component={Link}
                  href="/products"
                  elevation={0}
                  sx={(theme) => ({
                    p: 2,
                    display: "block",
                    color: "text.primary",
                    textDecoration: "none",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    background: `linear-gradient(155deg, ${alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === "dark" ? 0.12 : 0.08
                    )}, transparent)`,
                    transition: "transform 0.2s ease, border-color 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: "primary.main",
                    },
                  })}
                >
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box
                        sx={{
                          position: "relative",
                          width: 52,
                          height: 52,
                        }}
                      >
                        <Image
                          src={category.image}
                          alt={category.name}
                          fill
                          sizes="52px"
                          style={{ objectFit: "contain" }}
                        />
                      </Box>
                      <Chip label={`${category.itemCount} items`} size="small" />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        {category.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={(theme) => ({
                          mt: 0.5,
                          color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                        })}
                      >
                        Explore more in {category.name.toLowerCase()}.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Box>
          ) : (
            renderEmptyPanel(
              "No categories yet",
              "Categories will appear here as more items arrive."
            )
          )}
        </Stack>

        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1.5}
            alignItems={{ xs: "flex-start", md: "flex-end" }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, color: "text.primary" }}>
                Featured now
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
                A closer look at a few standout picks.
              </Typography>
            </Box>
            <Button
              component={Link}
              href="/products"
              variant="text"
              endIcon={<ArrowOutward />}
              sx={{ textTransform: "none", fontWeight: 900 }}
            >
              Browse all products
            </Button>
          </Stack>

          {featuredProducts.length ? (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
              }}
            >
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} size="compact" />
              ))}
            </Box>
          ) : (
            renderEmptyPanel(
              "No featured products yet",
              "Featured favorites will appear here soon."
            )
          )}
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, color: "text.primary" }}>
            Fresh arrivals
          </Typography>
          {newArrivals.length ? (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(3, minmax(0, 1fr))",
                },
              }}
            >
              {newArrivals.map((product) => (
                <Paper
                  key={product.id}
                  component={Link}
                  href={`/products/${product.slug}`}
                  elevation={0}
                  sx={{
                    display: "block",
                    color: "text.primary",
                    textDecoration: "none",
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    transition: "transform 0.2s ease, border-color 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: "primary.main",
                    },
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        position: "relative",
                        width: 92,
                        height: 92,
                        borderRadius: 2,
                        backgroundColor: "action.hover",
                        border: "1px solid",
                        borderColor: "divider",
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="92px"
                        style={{
                          objectFit: "contain",
                          padding: "10px",
                        }}
                      />
                    </Box>
                    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1 }}>
                        {product.brand.toUpperCase()}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                        {product.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {product.description}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 900, pt: 0.5 }}>
                        {formatPrice(product.price)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Box>
          ) : (
            renderEmptyPanel(
              "No arrivals yet",
              "New arrivals will show up here as soon as fresh items are added."
            )
          )}
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, color: "text.primary" }}>
            Collection spotlight
          </Typography>
          {homeFeed.collections.length ? (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "repeat(3, minmax(0, 1fr))",
                },
              }}
            >
              {homeFeed.collections.map((collection, index) => (
                <Paper
                  key={collection.id}
                  component={Link}
                  href="/products"
                  elevation={0}
                  sx={(theme) => ({
                    p: 2.5,
                    display: "block",
                    color: "text.primary",
                    textDecoration: "none",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    background: `linear-gradient(150deg, ${alpha(
                      index === 0
                        ? theme.palette.primary.main
                        : index === 1
                          ? theme.palette.info.main
                          : theme.palette.secondary.main,
                      theme.palette.mode === "dark" ? 0.18 : 0.12
                    )}, transparent 70%)`,
                    transition: "transform 0.2s ease, border-color 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: "primary.main",
                    },
                  })}
                >
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        position: "relative",
                        width: 64,
                        height: 64,
                      }}
                    >
                      <Image
                        src={collection.image}
                        alt={collection.name}
                        fill
                        sizes="64px"
                        style={{ objectFit: "contain" }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        {collection.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={(theme) => ({
                          mt: 0.75,
                          color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                        })}
                      >
                        {collection.description}
                      </Typography>
                    </Box>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography
                        variant="body2"
                        sx={(theme) => ({
                          color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                        })}
                      >
                        {collection.productCount} products
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>
                        Browse collection
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Box>
          ) : (
            renderEmptyPanel(
              "No collections yet",
              "Curated collections will appear here soon."
            )
          )}
        </Stack>

        <Paper
          elevation={0}
          sx={(theme) => ({
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            background: `linear-gradient(135deg, ${alpha(
              theme.palette.primary.main,
              theme.palette.mode === "dark" ? 0.18 : 0.12
            )}, ${alpha(
              theme.palette.background.paper,
              theme.palette.mode === "dark" ? 0.88 : 0.96
            )})`,
          })}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            spacing={2}
            alignItems={{ xs: "flex-start", lg: "center" }}
          >
            <Box sx={{ maxWidth: 760 }}>
              <Chip
                icon={<Inventory2Rounded />}
                label={hasProducts ? "Ready to explore" : "More to come"}
                color="primary"
                sx={{ mb: 1.5, borderRadius: 999 }}
              />
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
                Shop your way, whenever you&apos;re ready.
              </Typography>
              <Typography
                variant="body1"
                sx={(theme) => ({
                  mt: 1,
                  color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.78 : 0.7),
                })}
              >
                Browse featured finds, discover new arrivals, and keep your favorites close at hand.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                component={Link}
                href="/products"
                variant="contained"
                endIcon={<ArrowOutward />}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
              >
                {hasProducts ? "Start shopping" : "Browse the shop"}
              </Button>
              <Button
                component={Link}
                href="/cart"
                variant="outlined"
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
              >
                View cart
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
