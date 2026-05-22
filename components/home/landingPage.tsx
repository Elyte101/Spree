'use client';

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import {
  ArrowForwardRounded,
  CheckCircleOutlined,
  LocalShippingRounded,
  PhoneAndroidRounded,
  SecurityRounded,
  StorefrontOutlined,
  VerifiedRounded,
} from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { ProductCard } from "@/components/product/productCard";
import { HomeFeed, Product } from "@/types/types";

const ease = [0.22, 1, 0.36, 1] as const;

interface LandingPageProps {
  homeFeed: HomeFeed;
  featuredProducts: Product[];
  newArrivals: Product[];
  totalProducts: number;
  averageRating: number;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

const trustPillars = [
  {
    icon: <SecurityRounded />,
    title: "Escrow Protection",
    desc: "Your payment is held safely until you confirm delivery. No risk, no stress.",
    color: "primary" as const,
  },
  {
    icon: <VerifiedRounded />,
    title: "Verified Sellers",
    desc: "Every seller submits a Ghana Card and selfie before they can list a product.",
    color: "success" as const,
  },
  {
    icon: <PhoneAndroidRounded />,
    title: "Mobile Money",
    desc: "Pay and receive via MTN MoMo, Vodafone Cash, AirtelTigo, or card.",
    color: "info" as const,
  },
  {
    icon: <LocalShippingRounded />,
    title: "Live Tracking",
    desc: "Track every order from dispatch to your door with real-time updates.",
    color: "warning" as const,
  },
];

const escrowSteps = [
  {
    step: "01",
    title: "You pay into escrow",
    body: "Place your order and pay via MoMo, card, or Vodafone Cash. Your money is held safely — the seller receives nothing yet.",
    color: "primary" as const,
  },
  {
    step: "02",
    title: "Seller dispatches",
    body: "The verified seller packs and ships your item, uploads a tracking number, and you receive live delivery updates.",
    color: "info" as const,
  },
  {
    step: "03",
    title: "You confirm — seller gets paid",
    body: "Once you confirm delivery, Spree releases the seller's payment instantly to their MoMo or bank. No delivery = no payment.",
    color: "success" as const,
  },
];

export function LandingPage({
  homeFeed,
  featuredProducts,
  newArrivals,
  totalProducts,
  averageRating,
}: LandingPageProps) {
  const hasProducts = totalProducts > 0;
  const hero = homeFeed.hero;

  return (
    <Box component="main" sx={{ minHeight: "100vh", overflowX: "hidden" }}>
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <Box
        sx={(theme) => ({
          position: "relative",
          pt: { xs: 10, md: 12 },
          pb: { xs: 7, md: 9 },
          background: `
            radial-gradient(ellipse 70% 55% at 50% -10%,
              ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.28 : 0.16)} 0%,
              transparent 65%),
            radial-gradient(ellipse 40% 40% at 90% 40%,
              ${alpha(theme.palette.secondary.main, theme.palette.mode === "dark" ? 0.2 : 0.1)} 0%,
              transparent 60%),
            ${theme.palette.background.default}
          `,
        })}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 400px" },
              gap: { xs: 5, lg: 7 },
              alignItems: "center",
            }}
          >
            {/* Left — copy */}
            <Stack gap={3.5}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease }}
              >
                <Chip
                  icon={<VerifiedRounded />}
                  label="Ghana's trusted marketplace"
                  color="primary"
                  sx={{ width: "fit-content", borderRadius: 999, fontWeight: 700 }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.06, ease }}
              >
                <Typography
                  variant="h1"
                  sx={(theme) => ({
                    fontWeight: 900,
                    lineHeight: 0.92,
                    fontSize: { xs: "2.75rem", sm: "3.8rem", md: "4.8rem" },
                    letterSpacing: "-0.025em",
                    color: theme.palette.text.primary,
                  })}
                >
                  {hero?.title ?? (
                    <>
                      Shop safe.
                      <br />
                      <Box component="span" sx={{ color: "primary.main" }}>
                        Pay smart.
                      </Box>
                      <br />
                      Delivered.
                    </>
                  )}
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.12, ease }}
              >
                <Typography
                  variant="h6"
                  sx={(theme) => ({
                    maxWidth: 560,
                    fontWeight: 400,
                    lineHeight: 1.65,
                    color: alpha(theme.palette.text.primary, 0.72),
                  })}
                >
                  {hero?.subtitle ??
                    "Buy from verified Ghanaian sellers with full escrow protection. Pay with Mobile Money or card — your money stays safe until your order arrives."}
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.17, ease }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
                  <Button
                    component={Link}
                    href={hero?.ctaHref ?? "/products"}
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardRounded />}
                    sx={{
                      borderRadius: 999,
                      px: 3.5,
                      py: 1.5,
                      textTransform: "none",
                      fontWeight: 800,
                      fontSize: "1rem",
                    }}
                  >
                    {hero?.ctaLabel ?? (hasProducts ? "Shop now" : "Browse the shop")}
                  </Button>
                  <Button
                    component={Link}
                    href="/profile"
                    variant="outlined"
                    size="large"
                    startIcon={<StorefrontOutlined />}
                    sx={{
                      borderRadius: 999,
                      px: 3.5,
                      py: 1.5,
                      textTransform: "none",
                      fontWeight: 800,
                      fontSize: "1rem",
                    }}
                  >
                    Sell on Spree
                  </Button>
                </Stack>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.25, ease }}
              >
                <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Pay with:
                  </Typography>
                  {["MTN MoMo", "Vodafone Cash", "AirtelTigo", "Card"].map((m) => (
                    <Chip
                      key={m}
                      label={m}
                      size="small"
                      variant="outlined"
                      sx={{ borderRadius: 999, fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </motion.div>
            </Stack>

            {/* Right — stats card */}
            <motion.div
              initial={{ opacity: 0, x: 32, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.1, ease }}
            >
              <Paper
                elevation={0}
                sx={(theme) => ({
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 4,
                  overflow: "hidden",
                  background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.15 : 0.07)}, ${theme.palette.background.paper})`,
                })}
              >
                <Box
                  sx={(theme) => ({
                    position: "relative",
                    p: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 200,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.13)}, ${alpha(theme.palette.secondary.main, 0.08)})`,
                  })}
                >
                  <Image
                    src="/spreelogo.png"
                    alt="Spree"
                    width={165}
                    height={165}
                    style={{ objectFit: "contain", borderRadius: 9, marginBottom: "10px" }}
                    priority
                    
                  />
                  <Chip
                    icon={<CheckCircleOutlined />}
                    label="Escrow protected"
                    color="success"
                    size="small"
                    sx={{
                      position: "absolute",
                      bottom: 12,
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {[
                    { label: "Products", value: totalProducts.toLocaleString() },
                    { label: "Categories", value: homeFeed.categories.length.toString() },
                    { label: "Collections", value: homeFeed.collections.length.toString() },
                    {
                      label: "Avg. rating",
                      value: hasProducts ? `${averageRating.toFixed(1)} ★` : "—",
                    },
                  ].map((stat, i) => (
                    <Box
                      key={stat.label}
                      sx={{
                        p: 2.5,
                        borderTop: "1px solid",
                        borderRight: i % 2 === 0 ? "1px solid" : "none",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="h4" fontWeight={900} lineHeight={1}>
                        {stat.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {stat.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </motion.div>
          </Box>
        </Container>
      </Box>

      {/* ── TRUST PILLARS ─────────────────────────────────────────── */}
      <Box
        sx={{
          py: { xs: 5, md: 7 },
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(4, 1fr)",
              },
              gap: { xs: 3, md: 4 },
            }}
          >
            {trustPillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.06 * i, ease }}
              >
                <Stack gap={1.5} sx={{
                      alignItems: "center",
                      alignContent: "center",
                      justifyContent: "center",}}>
                  <Box
                    sx={(theme) => ({
                      width: 48,
                      height: 48,
                      borderRadius: 2.5,
                      display: "flex",
                      alignItems: "center",
                      alignContent: "center",
                      justifyContent: "center",
                      bgcolor: alpha(theme.palette[pillar.color].main, 0.12),
                      color: `${pillar.color}.main`,
                      "& svg": { fontSize: 24 },
                    })}
                  >
                    {pillar.icon}
                  </Box>
                  <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                    {pillar.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.6} textAlign="center">
                    {pillar.desc}
                  </Typography>
                </Stack>
              </motion.div>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── CATEGORIES ────────────────────────────────────────────── */}
      {homeFeed.categories.length > 0 && (
        <Box sx={{ py: { xs: 6, md: 8 } }}>
          <Container maxWidth="lg">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-end"
                mb={3.5}
              >
                <Box>
                  <Typography
                    variant="overline"
                    color="primary.main"
                    fontWeight={700}
                    letterSpacing={2}
                  >
                    Browse
                  </Typography>
                  <Typography variant="h3" fontWeight={900} lineHeight={1}>
                    Shop by category
                  </Typography>
                </Box>
                <Button
                  component={Link}
                  href="/products"
                  endIcon={<ArrowForwardRounded />}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  All products
                </Button>
              </Stack>
            </motion.div>

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(3, 1fr)",
                  md: "repeat(4, 1fr)",
                  lg: "repeat(auto-fill, minmax(148px, 1fr))",
                },
              }}
            >
              {homeFeed.categories.map((category, i) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: 0.04 * Math.min(i, 6), ease }}
                >
                  <Paper
                    component={Link}
                    href={`/products?category=${encodeURIComponent(category.name)}`}
                    elevation={0}
                    sx={(theme) => ({
                      p: 2,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.5,
                      color: "text.primary",
                      textDecoration: "none",
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      transition:
                        "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        borderColor: "primary.main",
                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.14)}`,
                      },
                    })}
                  >
                    <Box sx={{ position: "relative", width: 56, height: 56 }}>
                      <Image
                        src={category.image}
                        alt={category.name}
                        fill
                        sizes="56px"
                        style={{ objectFit: "contain" }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      textAlign="center"
                      lineHeight={1.3}
                    >
                      {category.name}
                    </Typography>
                    <Chip
                      label={`${category.itemCount}`}
                      size="small"
                      sx={{ height: 20, fontSize: "0.7rem" }}
                    />
                  </Paper>
                </motion.div>
              ))}
            </Box>
          </Container>
        </Box>
      )}

      {/* ── FEATURED PRODUCTS ─────────────────────────────────────── */}
      <Box
        sx={{
          py: { xs: 6, md: 8 },
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-end"
            mb={3.5}
          >
            <Box>
              <Typography
                variant="overline"
                color="primary.main"
                fontWeight={700}
                letterSpacing={2}
              >
                Handpicked
              </Typography>
              <Typography variant="h3" fontWeight={900} lineHeight={1} color="text.primary">
                Featured now
              </Typography>
            </Box>
            <Button
              component={Link}
              href="/products"
              endIcon={<ArrowForwardRounded />}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              See all
            </Button>
          </Stack>

          {featuredProducts.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
              }}
            >
              {featuredProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 * Math.min(i, 5), ease }}
                >
                  <ProductCard product={product} size="compact" />
                </motion.div>
              ))}
            </Box>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                textAlign: "center",
              }}
            >
              <Typography variant="h6" fontWeight={700} mb={1}>
                Coming soon
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Featured products will appear here as sellers list their items.
              </Typography>
            </Paper>
          )}
        </Container>
      </Box>

      {/* ── WHY SPREE ─────────────────────────────────────────────── */}
      <Box sx={{ py: { xs: 6, md: 9 }, bgcolor: "background.paper" }}>
        <Container maxWidth="lg">
          <Box  sx={{ textAlign: "center", mb: 5 }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
            >
              <Typography
                variant="overline"
                color="primary.main"
                fontWeight={700}
                letterSpacing={2}
              >
                Why Spree
              </Typography>
              <Typography variant="h3" fontWeight={900} lineHeight={1.1} mt={0.5} color="text.primary">
                Built for Ghana. Built for trust.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                mt={1.5}
                sx={{ maxWidth: 560, mx: "auto", lineHeight: 1.65 }}
              >
                Online shopping in Ghana comes with uncertainty. Spree eliminates that — with
                escrow payments, verified seller identities, and full order tracking from day one.
              </Typography>
            </motion.div>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: 2.5,
            }}
          >
            {escrowSteps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 * i, ease }}
              >
                <Paper sx={{ bgcolor: "white", borderRadius: 3, border: 0 }}>
                  <Paper
                    elevation={0}
                    sx={(theme) => ({
                      p: 3.5,
                      height: "100%",
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      background: `linear-gradient(145deg, ${alpha(theme.palette[item.color].main, theme.palette.mode === "dark" ? 0.1 : 0.1)}, white)`,
                    })}
                  >
                    <Typography
                      variant="h2"
                      fontWeight={900}
                      sx={(theme) => ({
                        color: alpha(theme.palette[item.color].main, theme.palette.mode === "dark" ? 0.4 : 0.2),
                        lineHeight: 1,
                        mb: 2.5,
                        fontSize: "3.5rem",
                      })}
                    >
                      {item.step}
                    </Typography>
                    <Typography variant="h6" fontWeight={800} mb={1.25} color="black">
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                      {item.body}
                    </Typography>
                  </Paper>
                </Paper>
              </motion.div>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── NEW ARRIVALS ──────────────────────────────────────────── */}
      {newArrivals.length > 0 && (
        <Box
          sx={(theme) => ({
            py: { xs: 6, md: 8 },
            borderTop: "1px solid",
            borderColor: "divider",
            background: `radial-gradient(ellipse 60% 50% at 50% 100%, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.1 : 0.06)}, transparent), ${theme.palette.background.paper}`,
          })}
        >
          <Container maxWidth="lg">
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-end"
              mb={3.5}
            >
              <Box>
                <Typography
                  variant="overline"
                  color="primary.main"
                  fontWeight={700}
                  letterSpacing={2}
                >
                  Just in
                </Typography>
                <Typography variant="h3" fontWeight={900} lineHeight={1}>
                  Fresh arrivals
                </Typography>
              </Box>
              <Button
                component={Link}
                href="/products?sort=newest"
                endIcon={<ArrowForwardRounded />}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                All new
              </Button>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                },
              }}
            >
              {newArrivals.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 * Math.min(i, 4), ease }}
                >
                  <Paper
                    component={Link}
                    href={`/products/${product.slug}`}
                    elevation={0}
                    sx={(theme) => ({
                      display: "flex",
                      gap: 2,
                      p: 2,
                      alignItems: "center",
                      color: "text.primary",
                      textDecoration: "none",
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      transition:
                        "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-3px)",
                        borderColor: "primary.main",
                        boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.12)}`,
                      },
                    })}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        width: 88,
                        height: 88,
                        borderRadius: 2,
                        overflow: "hidden",
                        flexShrink: 0,
                        bgcolor: "action.hover",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="88px"
                        style={{ objectFit: "contain", padding: 8 }}
                      />
                    </Box>
                    <Stack gap={0.25} minWidth={0}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                        letterSpacing={0.8}
                      >
                        {product.brand.toUpperCase()}
                      </Typography>
                      <Typography variant="body1" fontWeight={700} lineHeight={1.25} noWrap>
                        {product.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {product.description}
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={900}
                        mt={0.5}
                        color="primary.main"
                      >
                        {formatPrice(product.price)}
                      </Typography>
                    </Stack>
                  </Paper>
                </motion.div>
              ))}
            </Box>
          </Container>
        </Box>
      )}

      {/* ── COLLECTIONS ───────────────────────────────────────────── */}
      {homeFeed.collections.length > 0 && (
        <Box
          sx={{ py: { xs: 6, md: 8 }, borderTop: "1px solid", borderColor: "divider" }}
        >
          <Container maxWidth="lg">
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-end"
              mb={3.5}
            >
              <Box>
                <Typography
                  variant="overline"
                  color="primary.main"
                  fontWeight={700}
                  letterSpacing={2}
                >
                  Curated
                </Typography>
                <Typography variant="h3" fontWeight={900} lineHeight={1}>
                  Collections
                </Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                },
              }}
            >
              {homeFeed.collections.map((collection, i) => (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: 0.05 * Math.min(i, 4), ease }}
                >
                  <Paper
                    component={Link}
                    href="/products"
                    elevation={0}
                    sx={(theme) => ({
                      p: 3,
                      display: "block",
                      color: "text.primary",
                      textDecoration: "none",
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      transition: "transform 0.2s ease, border-color 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        borderColor: "primary.main",
                      },
                      background: `linear-gradient(150deg, ${alpha(
                        [
                          theme.palette.primary.main,
                          theme.palette.info.main,
                          theme.palette.secondary.main,
                        ][i % 3],
                        theme.palette.mode === "dark" ? 0.18 : 0.08
                      )}, ${theme.palette.background.paper} 70%)`,
                    })}
                  >
                    <Stack gap={2}>
                      <Box sx={{ position: "relative", width: 56, height: 56 }}>
                        <Image
                          src={collection.image}
                          alt={collection.name}
                          fill
                          sizes="56px"
                          style={{ objectFit: "contain" }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight={800}>
                          {collection.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          mt={0.5}
                          lineHeight={1.6}
                        >
                          {collection.description}
                        </Typography>
                      </Box>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {collection.productCount} products
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          Browse →
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                </motion.div>
              ))}
            </Box>
          </Container>
        </Box>
      )}

      {/* ── SELL ON SPREE ─────────────────────────────────────────── */}
      <Box
        sx={(theme) => ({
          py: { xs: 7, md: 9 },
          borderTop: "1px solid",
          borderColor: "divider",
          background: `linear-gradient(135deg,
            ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.09)},
            ${alpha(theme.palette.secondary.main, theme.palette.mode === "dark" ? 0.12 : 0.06)}),
            ${theme.palette.background.paper}`,
        })}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
              gap: { xs: 4, md: 6 },
              alignItems: "center",
            }}
          >
            <Box>
              <Typography
                variant="overline"
                color="primary.main"
                fontWeight={700}
                letterSpacing={2}
              >
                For sellers
              </Typography>
              <Typography
                variant="h3"
                fontWeight={900}
                lineHeight={1.05}
                mt={0.5}
                color="text.primary"
              >
                Sell across Ghana.
                <br />
                Get paid instantly.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                mt={1.5}
                lineHeight={1.65}
                sx={{ maxWidth: 520 }}
              >
                List your products, reach buyers nationwide, and receive your payout via Mobile
                Money the moment delivery is confirmed — no delays, no middlemen, no stress.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} mt={3}>
                <Button
                  component={Link}
                  href="/profile"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRounded />}
                  sx={{
                    borderRadius: 999,
                    px: 3.5,
                    textTransform: "none",
                    fontWeight: 800,
                  }}
                >
                  Start selling
                </Button>
                <Button
                  component={Link}
                  href="/products"
                  variant="outlined"
                  size="large"
                  sx={{
                    borderRadius: 999,
                    px: 3.5,
                    textTransform: "none",
                    fontWeight: 800,
                  }}
                >
                  Browse marketplace
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1.5,
                flexShrink: 0,
              }}
            >
              {[
                { icon: <SecurityRounded />, label: "Escrow payout", color: "primary" as const },
                { icon: <VerifiedRounded />, label: "ID verified", color: "success" as const },
                { icon: <PhoneAndroidRounded />, label: "Mobile money", color: "info" as const },
                {
                  icon: <LocalShippingRounded />,
                  label: "Fast delivery",
                  color: "warning" as const,
                },
              ].map((item) => (
                <Paper
                  key={item.label}
                  elevation={0}
                  sx={(theme) => ({
                    p: 2,
                    borderRadius: 2.5,
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                    bgcolor: "background.paper",
                    minWidth: 110,
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      color: `${item.color}.main`,
                      "& svg": { fontSize: 28 },
                    })}
                  >
                    {item.icon}
                  </Box>
                  <Typography variant="caption" fontWeight={700} textAlign="center">
                    {item.label}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── FINAL CTA ─────────────────────────────────────────────── */}
      <Box
        sx={{
          py: { xs: 7, md: 9 },
          borderTop: "1px solid",
          borderColor: "divider",
          textAlign: "center",
        }}
      >
        <Container maxWidth="sm">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <Typography variant="h3" fontWeight={900} lineHeight={1.05} mb={1.5}>
              {hasProducts ? "Ready to start shopping?" : "Coming soon to Ghana."}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              mb={3.5}
              lineHeight={1.65}
            >
              {hasProducts
                ? `${totalProducts.toLocaleString()} products from verified Ghanaian sellers — with escrow protection on every single order.`
                : "We're setting up the store. Check back soon for the first arrivals."}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              gap={1.5}
              justifyContent="center"
            >
              <Button
                component={Link}
                href="/products"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRounded />}
                sx={{
                  borderRadius: 999,
                  px: 4,
                  py: 1.5,
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: "1rem",
                }}
              >
                Shop now
              </Button>
              <Button
                component={Link}
                href="/cart"
                variant="outlined"
                size="large"
                sx={{
                  borderRadius: 999,
                  px: 4,
                  py: 1.5,
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: "1rem",
                }}
              >
                View cart
              </Button>
            </Stack>
          </motion.div>
        </Container>
      </Box>
    </Box>
  );
}
