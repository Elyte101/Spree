'use client';

import Link from "next/link";
import Image from "next/image";
import {
  AddRounded,
  ArrowForwardRounded,
  DeleteOutlineRounded,
  RemoveRounded,
  SecurityRounded,
  ShoppingBagOutlined,
} from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,

  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { motion } from "motion/react";

import { useCart } from "@/components/providers/cartProvider";
import { ProductCard } from "@/components/product/productCard";
import { PROCESSING_FEE_RATE } from "@/lib/pricing";
import { Product } from "@/types/types";

interface CartPageProps {
  recommendations: Product[];
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(price);

const ease = [0.22, 1, 0.36, 1] as const;

export function CartPage({ recommendations }: CartPageProps) {
  const { cart, itemCount, updateQuantity, removeItem } = useCart();
  const { items, shipping, subtotal, tax, total } = cart;

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        background:
          theme.palette.mode === "dark"
            ? `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.14)}, transparent 28%), ${theme.palette.background.default}`
            : `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.07)}, transparent 28%), #F5F4FF`,
      })}
    >
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack spacing={3.5}>

        {/* ── Page header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
          <Paper
            sx={(theme) => ({
              p: { xs: 1.5, md: 2 },
              borderRadius: 3,
              border: "1.5px solid",
              borderColor: theme.palette.divider,
            })}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Stack direction="row" alignItems="center" gap={1.5} mb={0.75}>
                  <Box
                    sx={(theme) => ({
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: "primary.main",
                    })}
                  >
                    <ShoppingBagOutlined sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography variant="h4" fontWeight={800} lineHeight={1}>
                    Your cart
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Review your items, adjust quantities, and proceed to checkout.
                </Typography>
              </Box>

              <Paper
                sx={(theme) => ({
                  px: 2.5,
                  py: 1.5,
                  borderRadius: 2.5,
                  border: "1.5px solid",
                  borderColor: theme.palette.divider,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  textAlign: "center",
                  minWidth: 120,
                })}
              >
                <Typography variant="h4" fontWeight={800} color="primary.main" lineHeight={1}>
                  {itemCount}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {itemCount === 1 ? "item" : "items"}
                </Typography>
              </Paper>
            </Stack>
          </Paper>
        </motion.div>

        {/* ── Empty state ── */}
        {items.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
            <Paper
              sx={{
                p: { xs: 5, md: 8 },
                borderRadius: 3,
                border: "1.5px solid",
                borderColor: "divider",
                textAlign: "center",
              }}
            >
              <Box
                sx={(theme) => ({
                  width: 72,
                  height: 72,
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: "primary.main",
                  mx: "auto",
                  mb: 2.5,
                })}
              >
                <ShoppingBagOutlined sx={{ fontSize: 34 }} />
              </Box>
              <Typography variant="h5" fontWeight={700} mb={0.75}>
                Your cart is empty
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={3.5}>
                Take a look around and add anything you love.
              </Typography>
              <Button
                component={Link}
                href="/products"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRounded />}
                sx={{ fontWeight: 800 }}
              >
                Browse products
              </Button>
            </Paper>
          </motion.div>
        ) : (
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 360px" },
              alignItems: "start",
            }}
          >
            {/* ── Cart items ── */}
            <Stack spacing={1.75}>
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: 0.05 * Math.min(i, 5), ease }}
                >
                  <Paper
                    sx={(theme) => ({
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: 3,
                      border: "1.5px solid",
                      borderColor: theme.palette.divider,
                      transition: "border-color 0.2s ease",
                      "&:hover": { borderColor: alpha(theme.palette.primary.main, 0.4) },
                    })}
                  >
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
                      {/* Product image */}
                      <Box
                        component={Link}
                        href={`/products/${item.productId ?? item.id}`}
                        sx={{
                          position: "relative",
                          width: { xs: "100%", sm: 128 },
                          height: { xs: 160, sm: 128 },
                          borderRadius: 2.5,
                          overflow: "hidden",
                          flexShrink: 0,
                          bgcolor: "action.hover",
                          border: "1px solid",
                          borderColor: "divider",
                          display: "block",
                          textDecoration: "none",
                        }}
                      >
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="(max-width: 600px) 100vw, 128px"
                          style={{ objectFit: "contain", padding: "12px" }}
                        />
                      </Box>

                      {/* Product info */}
                      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={0.75}>
                          <Box minWidth={0}>
                            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3} noWrap>
                              {item.name}
                            </Typography>
                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" mt={0.75}>
                              {item.isPreorder && <Chip label="Preorder" size="small" color="warning" sx={{ height: 20, fontSize: "0.68rem" }} />}
                              {item.color && <Chip label={item.color} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.68rem" }} />}
                              {item.size && <Chip label={item.size} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.68rem" }} />}
                            </Stack>
                          </Box>
                          <Typography variant="h6" fontWeight={800} color="primary.main" sx={{ flexShrink: 0 }}>
                            {formatPrice(item.price * item.quantity)}
                          </Typography>
                        </Stack>

                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Unit price: {formatPrice(item.price)}
                        </Typography>

                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.5}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          mt={0.5}
                        >
                          {/* Quantity stepper */}
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0}
                            sx={(theme) => ({
                              border: "1.5px solid",
                              borderColor: theme.palette.divider,
                              borderRadius: 999,
                              overflow: "hidden",
                              width: "fit-content",
                            })}
                          >
                            <IconButton
                              onClick={() => updateQuantity(item.id, -1)}
                              aria-label={`Decrease quantity for ${item.name}`}
                              size="small"
                              sx={{ borderRadius: 0, width: 32, height: 32 }}
                            >
                              <RemoveRounded sx={{ fontSize: 16 }} />
                            </IconButton>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{ minWidth: 32, textAlign: "center", px: 0.5 }}
                            >
                              {item.quantity}
                            </Typography>
                            <IconButton
                              onClick={() => updateQuantity(item.id, 1)}
                              aria-label={`Increase quantity for ${item.name}`}
                              size="small"
                              sx={{ borderRadius: 0, width: 32, height: 32 }}
                            >
                              <AddRounded sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Stack>

                          <Button
                            onClick={() => removeItem(item.id)}
                            startIcon={<DeleteOutlineRounded sx={{ fontSize: "16px !important" }} />}
                            size="small"
                            color="error"
                            variant="text"
                            sx={{ fontWeight: 600, fontSize: "0.8rem", textTransform: "none" }}
                          >
                            Remove
                          </Button>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                </motion.div>
              ))}
            </Stack>

            {/* ── Order summary ── */}
            <Paper
              elevation={0}
              sx={{
                position: { xl: "sticky" },
                top: { xl: 96 },
                borderRadius: 3,
                border: "1.5px solid",
                borderColor: "divider",
                p: { xs: 2, sm: 2.5 },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>Order summary</Typography>
                <Chip
                  label={formatPrice(total)}
                  size="small"
                  color="primary"
                  sx={{ borderRadius: 999, fontWeight: 700 }}
                />
              </Stack>
              <Stack spacing={2.5}>

                {/* Line items */}
                <Stack spacing={1.25}>
                  {[
                    { label: "Subtotal", value: formatPrice(subtotal) },
                    { label: "Delivery", value: formatPrice(shipping) },
                    { label: `Processing fee (${(PROCESSING_FEE_RATE * 100).toFixed(1)}%)`, value: formatPrice(tax) },
                  ].map(({ label, value }) => (
                    <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                <Divider />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={800} color="#22C55E">Total</Typography>
                  <Typography variant="h6" fontWeight={800} color="#22C55E
                  ">
                    {formatPrice(total)}
                  </Typography>
                </Stack>

                {/* Checkout CTA */}
                <Button
                  component={Link}
                  href="/checkout"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRounded />}
                  fullWidth
                  sx={{ fontWeight: 800, fontSize: "1rem", py: 1.5 }}
                >
                  Proceed to checkout
                </Button>

                <Button
                  component={Link}
                  href="/products"
                  variant="outlined"
                  size="medium"
                  fullWidth
                  sx={{ fontWeight: 700 }}
                >
                  Continue shopping
                </Button>

                {/* Trust signal */}
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                  <SecurityRounded sx={{ fontSize: 15, color: "#22C55E" }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Secured by Spree escrow — pay safely
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        )}

        {/* ── Recommendations ── */}
        {recommendations.length > 0 && (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={700}>Suggested</Typography>
              <Typography variant="h5" fontWeight={700} color="text.primary">You might also like</Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gap: 1.75,
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 210px), 1fr))",
              }}
            >
              {recommendations.map((product) => (
                <ProductCard key={product.id} product={product} size="compact" />
              ))}
            </Box>
          </Stack>
        )}
      </Stack>
    </Box>
    </Box>
  );
}
