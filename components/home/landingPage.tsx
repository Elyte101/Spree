'use client';

import Link from "next/link";
import { ProductImage } from "@/components/ui/productImage";
import { SpreeIcon } from "@/components/ui/spreeIcon";
import { motion } from "motion/react";
import {
  ArrowForwardRounded,
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
import { formatPrice } from "@/lib/ghana";

const ease = [0.22, 1, 0.36, 1] as const;

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};
const scaleItem = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.36, ease } },
};
const sectionHeader = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

interface LandingPageProps {
  homeFeed: HomeFeed;
  featuredProducts: Product[];
  newArrivals: Product[];
  totalProducts: number;
  averageRating: number;
}

const trustPillars = [
  {
    icon: <SecurityRounded sx={{ fontSize: 22 }} />,
    title: "Escrow Protection",
    desc: "Your payment is held safely until you confirm delivery.",
    color: "#655AFF",
    bg: "rgba(101,90,255,0.1)",
  },
  {
    icon: <VerifiedRounded sx={{ fontSize: 22 }} />,
    title: "Verified Sellers",
    desc: "Every seller submits a Ghana Card and selfie before listing.",
    color: "#22C55E",
    bg: "rgba(34,197,94,0.1)",
  },
  {
    icon: <PhoneAndroidRounded sx={{ fontSize: 22 }} />,
    title: "Mobile Money",
    desc: "Pay via MTN MoMo, Vodafone Cash, AirtelTigo, or card.",
    color: "#0EA5E9",
    bg: "rgba(14,165,233,0.1)",
  },
  {
    icon: <LocalShippingRounded sx={{ fontSize: 22 }} />,
    title: "Live Tracking",
    desc: "Real-time updates from dispatch to your door.",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
  },
];

const escrowSteps = [
  {
    step: "01",
    title: "You pay into escrow",
    body: "Place your order and pay via MoMo, card, or Vodafone Cash. Your money is held safely — the seller receives nothing yet.",
    accent: "#655AFF",
    icon: <SecurityRounded sx={{ fontSize: 22 }} />,
  },
  {
    step: "02",
    title: "Seller dispatches",
    body: "The verified seller packs and ships your item, uploads a tracking number, and you receive live delivery updates.",
    accent: "#0EA5E9",
    icon: <LocalShippingRounded sx={{ fontSize: 22 }} />,
  },
  {
    step: "03",
    title: "You confirm — seller gets paid",
    body: "Once you confirm delivery, Spree releases payment instantly to the seller's MoMo or bank. No delivery = no payment.",
    accent: "#22C55E",
    icon: <VerifiedRounded sx={{ fontSize: 22 }} />,
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

  // Stats — don't surface bare "1/1/1/0.0" when the catalog is just seeding.
  // Show the real number only once it crosses a meaningful threshold.
  const productStat = totalProducts >= 5 ? totalProducts.toLocaleString() : (totalProducts > 0 ? "New" : "—");
  const productLabel = totalProducts >= 5 ? "Products" : "Marketplace";
  const categoryStat = homeFeed.categories.length >= 3 ? homeFeed.categories.length.toString() : "Curated";
  const categoryLabel = "Categories";
  const collectionStat = homeFeed.collections.length >= 2 ? homeFeed.collections.length.toString() : "Handpicked";
  const collectionLabel = homeFeed.collections.length >= 2 ? "Collections" : "Selection";
  const ratingStat = (hasProducts && averageRating >= 0.1) ? `${averageRating.toFixed(1)} ★` : "New";
  const ratingLabel = "Avg rating";

  return (
    <Box component="main" sx={{ minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── HERO ─────────────────────────────────────── */}
      <Box
        sx={(theme) => ({
          position: "relative",
          pt: { xs: 6, md: 7 },
          pb: { xs: 4, md: 5 },
          overflow: "hidden",
          background:
            theme.palette.mode === "dark"
              ? `radial-gradient(ellipse 80% 60% at 50% -5%, ${alpha(theme.palette.primary.main, 0.3)} 0%, transparent 65%), ${theme.palette.background.default}`
              : `radial-gradient(ellipse 80% 60% at 50% -5%, ${alpha(theme.palette.primary.main, 0.14)} 0%, transparent 65%), #F5F4FF`,
        })}
      >
        {/* Decorative blobs */}
        <Box
          aria-hidden
          sx={(theme) => ({
            position: "absolute",
            right: -120,
            top: -60,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, theme.palette.mode === "dark" ? 0.18 : 0.1)} 0%, transparent 70%)`,
            pointerEvents: "none",
          })}
        />

        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 380px" },
              gap: { xs: 5, lg: 8 },
              alignItems: "center",
            }}
          >
            {/* Left — copy */}
            <Stack gap={3}>
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
                <Chip
                  icon={<VerifiedRounded sx={{ fontSize: "16px !important" }} />}
                  label="Ghana's trusted marketplace"
                  sx={(theme) => ({
                    width: "fit-content",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    height: 30,
                    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.1),
                    color: "primary.main",
                    border: "1px solid",
                    borderColor: alpha(theme.palette.primary.main, 0.25),
                    "& .MuiChip-icon": { color: "primary.main" },
                  })}
                />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.06, ease }}>
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 900,
                    // 1.1 gives ascenders enough room — 0.93 clipped Rubik 900 glyphs
                    lineHeight: 1.1,
                    fontSize: { xs: "1.75rem", sm: "2.125rem", md: "2.5rem" },
                    letterSpacing: "-0.03em",
                    color: "text.primary",
                  }}
                >
                  {hero?.title ?? (
                    <>
                      Shop safe.{" "}
                      <Box component="span" sx={{ color: "primary.main" }}>Pay smart.</Box>
                      {" "}Delivered.
                    </>
                  )}
                </Typography>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12, ease }}>
                <Typography
                  variant="body1"
                  sx={(theme) => ({
                    maxWidth: 520,
                    fontSize: { xs: "1rem", md: "1.1rem" },
                    color: alpha(theme.palette.text.primary, 0.68),
                    lineHeight: 1.7,
                  })}
                >
                  {hero?.subtitle ??
                    "Buy from verified Ghanaian sellers with full escrow protection. Pay with Mobile Money or card — your money stays safe until your order arrives."}
                </Typography>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17, ease }}>
                <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
                  <Button
                    component={Link}
                    href={hero?.ctaHref ?? "/products"}
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardRounded />}
                    sx={{ fontWeight: 800, fontSize: "0.95rem" }}
                  >
                    {hero?.ctaLabel ?? (hasProducts ? "Shop now" : "Browse the shop")}
                  </Button>
                  <Button
                    component={Link}
                    href="/auth/sign-in?callbackUrl=%2Fprofile"
                    variant="outlined"
                    size="large"
                    startIcon={<StorefrontOutlined />}
                    sx={{ fontWeight: 700, fontSize: "0.95rem" }}
                  >
                    Sell on Spree
                  </Button>
                </Stack>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.25, ease }}>
                <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Pay with:
                  </Typography>
                  {["MTN MoMo", "Vodafone Cash", "AirtelTigo", "Card"].map((m) => (
                    <Chip
                      key={m}
                      label={m}
                      size="small"
                      variant="outlined"
                      sx={(theme) => ({
                        borderRadius: 999,
                        fontWeight: 600,
                        fontSize: "0.7rem",
                        height: 22,
                        borderColor: theme.palette.divider,
                        "& .MuiChip-label": { px: 1 },
                      })}
                    />
                  ))}
                </Stack>
              </motion.div>
            </Stack>

            {/* Right — stats card */}
            <motion.div
              initial={{ opacity: 0, x: 28, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.1, ease }}
            >
              <Paper
                sx={(theme) => ({
                  border: "1.5px solid",
                  borderColor: theme.palette.divider,
                  borderRadius: 4,
                  overflow: "hidden",
                  background:
                    theme.palette.mode === "dark"
                      ? `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.14)}, ${theme.palette.background.paper})`
                      : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.06)}, ${theme.palette.background.paper})`,
                })}
              >
                {/* Logo showcase area */}
                <Box
                  sx={(theme) => ({
                    position: "relative",
                    p: 3.5,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1.5,
                    background:
                      theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)}, ${alpha(theme.palette.secondary.main, 0.1)})`
                        : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
                  })}
                >
                  <Box sx={{ borderRadius: 2, overflow: "hidden", lineHeight: 0 }}>
                    <SpreeIcon size={110} />
                  </Box>
                  <Chip
                    icon={<SecurityRounded sx={{ fontSize: "14px !important", color: "#22C55E !important" }} />}
                    label="Escrow protected"
                    size="small"
                    sx={{
                      borderRadius: 999,
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      height: 24,
                      backgroundColor: alpha("#22C55E", 0.12),
                      color: "#16A34A",
                      border: "1px solid",
                      borderColor: alpha("#22C55E", 0.25),
                      "& .MuiChip-label": { px: 0.75 },
                    }}
                  />
                </Box>

                {/* Stats grid — smart labels hide bare "1/1/0.0" values */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {[
                    { label: productLabel, value: productStat },
                    { label: categoryLabel, value: categoryStat },
                    { label: collectionLabel, value: collectionStat },
                    { label: ratingLabel, value: ratingStat },
                  ].map((stat, i) => (
                    <Box
                      key={stat.label}
                      sx={{
                        p: 2,
                        borderTop: "1px solid",
                        borderRight: i % 2 === 0 ? "1px solid" : "none",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="h5" fontWeight={800} lineHeight={1} color="primary.main">
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

      {/* ── TRUST PILLARS ────────────────────────────── */}
      <Box
        sx={{
          py: { xs: 2, md: 2.5 },
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          overflow: "hidden",
        }}
      >
        <Container maxWidth="lg">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              }}
            >
              {trustPillars.map((pillar, i) => (
                <motion.div key={pillar.title} variants={staggerItem}>
                  <Box
                    sx={(theme) => ({
                      px: { xs: 2, md: 3 },
                      py: { xs: 2.5, md: 3 },
                      display: "flex",
                      alignItems: "center",
                      gap: 1.75,
                      height: "100%",
                      borderRight: {
                        xs: i % 2 === 0 ? "1px solid" : "none",
                        md: i < 3 ? "1px solid" : "none",
                      },
                      borderBottom: { xs: i < 2 ? "1px solid" : "none", md: "none" },
                      borderColor: theme.palette.divider,
                    })}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 2,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: alpha(pillar.color, 0.12),
                        color: pillar.color,
                      }}
                    >
                      {pillar.icon}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700} color="text.primary" lineHeight={1.3}>
                        {pillar.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.5} sx={{ display: "block", mt: 0.25 }}>
                        {pillar.desc}
                      </Typography>
                    </Box>
                  </Box>
                </motion.div>
              ))}
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* ── CATEGORIES ───────────────────────────────── */}
      {homeFeed.categories.length > 0 && (
        <Box sx={{ py: { xs: 4, md: 6 } }}>
          <Container maxWidth="lg">
            <motion.div variants={sectionHeader} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={2.5}>
                <Box>
                  <Typography variant="overline" color="primary.main" fontWeight={700}>Browse</Typography>
                  <Typography variant="h3" fontWeight={800} lineHeight={1} color="text.primary">Shop by category</Typography>
                </Box>
                <Button component={Link} href="/products" endIcon={<ArrowForwardRounded />} sx={{ fontWeight: 700 }}>
                  All products
                </Button>
              </Stack>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(3, 1fr)",
                  md: "repeat(4, 1fr)",
                  lg: "repeat(auto-fill, minmax(140px, 1fr))",
                },
              }}
            >
              {homeFeed.categories.map((category) => (
                <motion.div key={category.id} variants={scaleItem}>
                  <Paper
                    component={Link}
                    href={`/products?category=${encodeURIComponent(category.name)}`}
                    sx={(theme) => ({
                      p: 2,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.25,
                      color: "text.primary",
                      textDecoration: "none",
                      borderRadius: 3,
                      border: "1.5px solid",
                      borderColor: theme.palette.divider,
                      transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        borderColor: "primary.main",
                        boxShadow: `0 10px 28px ${alpha(theme.palette.primary.main, 0.14)}`,
                      },
                    })}
                  >
                    <Box sx={{ position: "relative", width: 52, height: 52 }}>
                      <ProductImage src={category.image} alt={category.name} sizes="52px" />
                    </Box>
                    <Typography variant="body2" fontWeight={700} textAlign="center" lineHeight={1.3} fontSize="0.8rem">
                      {category.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {category.itemCount} items
                    </Typography>
                  </Paper>
                </motion.div>
              ))}
            </Box>
            </motion.div>
          </Container>
        </Box>
      )}

      {/* ── FEATURED PRODUCTS ────────────────────────── */}
      <Box
        sx={{
          py: { xs: 4, md: 6 },
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <motion.div variants={sectionHeader} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={2.5}>
              <Box>
                <Typography variant="overline" color="primary.main" fontWeight={700}>Handpicked</Typography>
                <Typography variant="h3" fontWeight={800} lineHeight={1} color="text.primary">Featured now</Typography>
              </Box>
              <Button component={Link} href="/products" endIcon={<ArrowForwardRounded />} sx={{ fontWeight: 700 }}>
                See all
              </Button>
            </Stack>
          </motion.div>

          {featuredProducts.length > 0 ? (
            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 210px), 1fr))",
              }}
            >
              {featuredProducts.map((product) => (
                <motion.div key={product.id} variants={staggerItem}>
                  <ProductCard product={product} size="compact" />
                </motion.div>
              ))}
            </Box>
            </motion.div>
          ) : (
            <Paper
              sx={{
                p: 4,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                textAlign: "center",
              }}
            >
              <Typography variant="h6" fontWeight={700} mb={0.5} color="text.primary">Coming soon</Typography>
              <Typography variant="body2" color="text.secondary">
                Featured products will appear here as sellers list items.
              </Typography>
            </Paper>
          )}
        </Container>
      </Box>

      {/* ── WHY SPREE / HOW IT WORKS ─────────────────── */}
      <Box
        sx={(theme) => ({
          py: { xs: 4.5, md: 7 },
          position: "relative",
          overflow: "hidden",
          background:
            theme.palette.mode === "dark"
              ? "linear-gradient(160deg, #1c1535 0%, #0e0d1a 45%, #091018 100%)"
              : `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.07)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 55%, ${alpha(theme.palette.info.main, 0.04)} 100%), ${theme.palette.background.default}`,
        })}
      >
        {/* Decorative glow blobs */}
        <Box sx={(theme) => ({ position: "absolute", top: -100, right: -60, width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${alpha("#655AFF", theme.palette.mode === "dark" ? 0.18 : 0.1)} 0%, transparent 65%)`, pointerEvents: "none" })} />
        <Box sx={(theme) => ({ position: "absolute", bottom: -80, left: "15%", width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${alpha("#22C55E", theme.palette.mode === "dark" ? 0.11 : 0.07)} 0%, transparent 65%)`, pointerEvents: "none" })} />
        <Box sx={(theme) => ({ position: "absolute", top: "45%", left: -80, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${alpha("#0EA5E9", theme.palette.mode === "dark" ? 0.09 : 0.05)} 0%, transparent 65%)`, pointerEvents: "none" })} />

        <Container maxWidth="lg" sx={{ position: "relative" }}>

          {/* Section header */}
          <motion.div variants={sectionHeader} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
          <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
            <Chip
              label="Why Spree"
              size="small"
              sx={(theme) => ({
                borderRadius: 999,
                fontWeight: 700,
                fontSize: "0.72rem",
                height: 26,
                background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.1),
                color: theme.palette.mode === "dark" ? "#a89fff" : theme.palette.primary.main,
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.38 : 0.25),
                "& .MuiChip-label": { px: 1.25 },
                mb: 2.5,
              })}
            />
            <Typography variant="h3" fontWeight={800} lineHeight={1.1} color="text.primary">
              Built for Ghana.<br />Built for trust.
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              mt={1.75}
              sx={{ maxWidth: 500, mx: "auto", lineHeight: 1.75 }}
            >
              Online shopping in Ghana comes with uncertainty. Spree eliminates that —
              with escrow payments, verified sellers, and real-time tracking.
            </Typography>
          </Box>
          </motion.div>

          {/* Step cards */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: { xs: 2, md: 2.5 },
            }}
          >
            {escrowSteps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: 0.1 * i, ease }}
                style={{ height: "100%" }}
              >
                <Box
                  sx={(theme) => ({
                    p: { xs: 3, md: 3.5 },
                    height: "100%",
                    borderRadius: 3,
                    position: "relative",
                    overflow: "hidden",
                    background:
                      theme.palette.mode === "dark"
                        ? alpha("#fff", 0.04)
                        : theme.palette.background.paper,
                    backdropFilter: theme.palette.mode === "dark" ? "blur(12px)" : "none",
                    border: "1px solid",
                    borderColor:
                      theme.palette.mode === "dark"
                        ? alpha("#fff", 0.08)
                        : theme.palette.divider,
                    borderTop: `2.5px solid ${item.accent}`,
                    boxShadow:
                      theme.palette.mode === "light"
                        ? `0 2px 16px ${alpha(theme.palette.primary.main, 0.06)}`
                        : "none",
                    transition: "background 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease",
                    "&:hover": {
                      background:
                        theme.palette.mode === "dark"
                          ? alpha("#fff", 0.075)
                          : alpha(item.accent, 0.03),
                      transform: "translateY(-5px)",
                      boxShadow: `0 24px 52px ${alpha(item.accent, theme.palette.mode === "dark" ? 0.22 : 0.14)}`,
                    },
                  })}
                >
                  {/* Ghost step number */}
                  <Typography
                    sx={(theme) => ({
                      position: "absolute",
                      top: -10,
                      right: 14,
                      fontSize: "7.5rem",
                      fontWeight: 900,
                      color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.04 : 0.06),
                      lineHeight: 1,
                      userSelect: "none",
                      fontFamily: '"Rubik", sans-serif',
                      letterSpacing: "-0.04em",
                    })}
                  >
                    {item.step}
                  </Typography>

                  {/* Icon */}
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: alpha(item.accent, 0.14),
                      border: "1px solid",
                      borderColor: alpha(item.accent, 0.28),
                      color: item.accent,
                      mb: 2.5,
                      boxShadow: `0 0 18px ${alpha(item.accent, 0.24)}`,
                    }}
                  >
                    {item.icon}
                  </Box>

                  {/* Step label */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: item.accent,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontSize: "0.65rem",
                      display: "block",
                      mb: 0.75,
                    }}
                  >
                    Step {item.step}
                  </Typography>

                  <Typography variant="h6" fontWeight={700} mb={1.25} color="text.primary" sx={{ lineHeight: 1.3 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                    {item.body}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── NEW ARRIVALS ─────────────────────────────── */}
      {newArrivals.length > 0 && (
        <Box
          sx={{
            py: { xs: 4, md: 6 },
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Container maxWidth="lg">
            <motion.div variants={sectionHeader} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={2.5}>
                <Box>
                  <Typography variant="overline" color="primary.main" fontWeight={700}>Just in</Typography>
                  <Typography variant="h3" fontWeight={800} lineHeight={1} color="text.primary">Fresh arrivals</Typography>
                </Box>
                <Button component={Link} href="/products?sort=newest" endIcon={<ArrowForwardRounded />} sx={{ fontWeight: 700 }}>
                  All new
                </Button>
              </Stack>
            </motion.div>

            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              }}
            >
              {newArrivals.map((product) => (
                <motion.div
                  key={product.id}
                  variants={staggerItem}
                >
                  <Paper
                    component={Link}
                    href={`/products/${product.slug}`}
                    sx={(theme) => ({
                      display: "flex",
                      gap: 2,
                      p: 2,
                      alignItems: "center",
                      color: "text.primary",
                      textDecoration: "none",
                      borderRadius: 3,
                      border: "1.5px solid",
                      borderColor: theme.palette.divider,
                      transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-3px)",
                        borderColor: "primary.main",
                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
                      },
                    })}
                  >
                    <Box
                      sx={(theme) => ({
                        position: "relative",
                        width: 80,
                        height: 80,
                        borderRadius: 2,
                        overflow: "hidden",
                        flexShrink: 0,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        border: "1px solid",
                        borderColor: "divider",
                      })}
                    >
                      <ProductImage src={product.image} alt={product.name} sizes="80px" />
                    </Box>
                    <Stack gap={0.3} minWidth={0}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.62rem" }}>
                        {product.brand}
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={700} lineHeight={1.25} noWrap>
                        {product.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {product.description}
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={800} mt={0.5} color="primary.main">
                        {formatPrice(product.price)}
                      </Typography>
                    </Stack>
                  </Paper>
                </motion.div>
              ))}
            </Box>
            </motion.div>
          </Container>
        </Box>
      )}

      {/* ── COLLECTIONS ──────────────────────────────── */}
      {homeFeed.collections.length > 0 && (
        <Box sx={{ py: { xs: 4, md: 6 }, borderTop: "1px solid", borderColor: "divider" }}>
          <Container maxWidth="lg">
            <motion.div variants={sectionHeader} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={2.5}>
                <Box>
                  <Typography variant="overline" color="primary.main" fontWeight={700}>Curated</Typography>
                  <Typography variant="h3" fontWeight={800} lineHeight={1} color="text.primary">Collections</Typography>
                </Box>
              </Stack>
            </motion.div>

            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              }}
            >
              {homeFeed.collections.map((collection, i) => (
                <motion.div key={collection.id} variants={scaleItem}>
                  <Paper
                    component={Link}
                    href="/products"
                    sx={(theme) => ({
                      p: 3,
                      display: "block",
                      color: "text.primary",
                      textDecoration: "none",
                      borderRadius: 3,
                      border: "1.5px solid",
                      borderColor: theme.palette.divider,
                      transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        borderColor: "primary.main",
                        boxShadow: `0 10px 28px ${alpha(theme.palette.primary.main, 0.12)}`,
                      },
                      background:
                        theme.palette.mode === "dark"
                          ? `linear-gradient(150deg, ${alpha([theme.palette.primary.main, theme.palette.info.main, theme.palette.secondary.main][i % 3], 0.16)}, ${theme.palette.background.paper} 70%)`
                          : `linear-gradient(150deg, ${alpha([theme.palette.primary.main, theme.palette.info.main, theme.palette.secondary.main][i % 3], 0.07)}, ${theme.palette.background.paper} 70%)`,
                    })}
                  >
                    <Stack gap={2}>
                      <Box sx={{ position: "relative", width: 52, height: 52 }}>
                        <ProductImage src={collection.image} alt={collection.name} sizes="52px" />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight={700} color="text.primary">{collection.name}</Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.5} lineHeight={1.6}>
                          {collection.description}
                        </Typography>
                      </Box>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {collection.productCount} products
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="primary.main">Browse →</Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                </motion.div>
              ))}
            </Box>
            </motion.div>
          </Container>
        </Box>
      )}

      {/* ── SELL ON SPREE ────────────────────────────── */}
      <Box
        sx={(theme) => ({
          py: { xs: 4.5, md: 6 },
          borderTop: "1px solid",
          borderColor: "divider",
          background:
            theme.palette.mode === "dark"
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)}, ${alpha(theme.palette.secondary.main, 0.1)}), ${theme.palette.background.paper}`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.07)}, ${alpha(theme.palette.secondary.main, 0.05)}), ${theme.palette.background.paper}`,
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
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease }}
            >
              <Typography variant="overline" color="primary.main" fontWeight={700}>For sellers</Typography>
              <Typography variant="h3" fontWeight={800} lineHeight={1.05} mt={0.5} color="text.primary">
                Sell across Ghana.<br />Get paid instantly.
              </Typography>
              <Typography variant="body1" color="text.secondary" mt={1.5} lineHeight={1.7} sx={{ maxWidth: 480 }}>
                List your products, reach buyers nationwide, and receive your payout via Mobile Money the
                moment delivery is confirmed — no delays, no middlemen.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} mt={3}>
                <Button component={Link} href="/profile" variant="contained" size="large" endIcon={<ArrowForwardRounded />} sx={{ fontWeight: 800 }}>
                  Start selling
                </Button>
                <Button component={Link} href="/products" variant="outlined" size="large" sx={{ fontWeight: 700 }}>
                  Browse marketplace
                </Button>
              </Stack>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, flexShrink: 0 }}>
                {[
                  { icon: <SecurityRounded />, label: "Escrow payout", color: "#655AFF" },
                  { icon: <VerifiedRounded />, label: "ID verified", color: "#22C55E" },
                  { icon: <PhoneAndroidRounded />, label: "Mobile money", color: "#0EA5E9" },
                  { icon: <LocalShippingRounded />, label: "Fast delivery", color: "#F59E0B" },
                ].map((item) => (
                  <motion.div key={item.label} variants={scaleItem}>
                    <Paper
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: "1.5px solid",
                        borderColor: "divider",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                        bgcolor: "background.paper",
                        minWidth: 110,
                      }}
                    >
                      <Box sx={{ color: item.color, bgcolor: alpha(item.color, 0.1), borderRadius: 2, p: 0.75, "& svg": { fontSize: 22 } }}>
                        {item.icon}
                      </Box>
                      <Typography variant="caption" fontWeight={700} textAlign="center" color="text.primary">
                        {item.label}
                      </Typography>
                    </Paper>
                  </motion.div>
                ))}
              </Box>
            </motion.div>
          </Box>
        </Container>
      </Box>

      {/* ── FINAL CTA ────────────────────────────────── */}
      <Box
        sx={(theme) => ({
          py: { xs: 5, md: 7.5 },
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
          background:
            theme.palette.mode === "dark"
              ? "linear-gradient(160deg, #1c1535 0%, #0e0d1a 50%, #091018 100%)"
              : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, #7c3aed 55%, #4f46e5 100%)`,
        })}
      >
        {/* Decorative glows */}
        <Box sx={(theme) => ({ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 560, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${alpha("#a78bfa", theme.palette.mode === "dark" ? 0.22 : 0.3)} 0%, transparent 65%)`, pointerEvents: "none" })} />
        <Box sx={(theme) => ({ position: "absolute", bottom: -80, right: -40, width: 340, height: 340, borderRadius: "50%", background: `radial-gradient(circle, ${alpha("#F97316", theme.palette.mode === "dark" ? 0.13 : 0.2)} 0%, transparent 65%)`, pointerEvents: "none" })} />
        <Box sx={(theme) => ({ position: "absolute", bottom: -60, left: -40, width: 280, height: 280, borderRadius: "50%", background: `radial-gradient(circle, ${alpha("#22C55E", theme.palette.mode === "dark" ? 0.1 : 0.15)} 0%, transparent 65%)`, pointerEvents: "none" })} />

        <Container maxWidth="sm" sx={{ position: "relative" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.45, ease }}>

            {/* Logo icon */}
            <Box
              sx={{
                borderRadius: 2.5,
                overflow: "hidden",
                lineHeight: 0,
                mx: "auto",
                mb: 3.5,
                width: "fit-content",
                boxShadow: `0 0 0 1.5px ${alpha("#fff", 0.2)}`,
              }}
            >
              <SpreeIcon size={64} />
            </Box>

            <Typography variant="h2" fontWeight={800} lineHeight={1.08} mb={2} sx={{ color: "#fff", fontSize: { xs: "1.5rem", md: "1.875rem" } }}>
              {hasProducts ? "Ready to start shopping?" : "Coming soon to Ghana."}
            </Typography>
            <Typography
              variant="body1"
              mb={4.5}
              lineHeight={1.75}
              sx={{ color: alpha("#fff", 0.72), maxWidth: 440, mx: "auto" }}
            >
              {hasProducts
                ? `${totalProducts.toLocaleString()} products from verified Ghanaian sellers — escrow protection on every order.`
                : "We're setting up the store. Check back soon for the first arrivals."}
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} justifyContent="center" mb={4.5}>
              <Button
                component={Link}
                href="/products"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRounded />}
                sx={(theme) => ({
                  fontWeight: 800,
                  background: "#fff",
                  color: theme.palette.primary.main,
                  borderRadius: 999,
                  px: 3.5,
                  "&:hover": { background: alpha("#fff", 0.9) },
                })}
              >
                Shop now
              </Button>
              <Button
                component={Link}
                href="/cart"
                variant="outlined"
                size="large"
                sx={{
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3,
                  borderColor: alpha("#fff", 0.4),
                  color: "#fff",
                  "&:hover": {
                    borderColor: "#fff",
                    background: alpha("#fff", 0.1),
                  },
                }}
              >
                View cart
              </Button>
            </Stack>

            {/* Trust signals */}
            <Stack direction="row" gap={{ xs: 2, sm: 3.5 }} justifyContent="center" flexWrap="wrap">
              {[
                { icon: <SecurityRounded sx={{ fontSize: 14 }} />, label: "Escrow protected" },
                { icon: <VerifiedRounded sx={{ fontSize: 14 }} />, label: "Verified sellers" },
                { icon: <PhoneAndroidRounded sx={{ fontSize: 14 }} />, label: "Mobile Money" },
              ].map((item) => (
                <Stack key={item.label} direction="row" alignItems="center" gap={0.7}>
                  <Box sx={{ color: alpha("#fff", 0.65), display: "flex" }}>{item.icon}</Box>
                  <Typography variant="caption" sx={{ color: alpha("#fff", 0.65), fontWeight: 600, fontSize: "0.72rem" }}>
                    {item.label}
                  </Typography>
                </Stack>
              ))}
            </Stack>

          </motion.div>
        </Container>
      </Box>
    </Box>
  );
}
