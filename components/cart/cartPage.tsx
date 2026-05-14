'use client';

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AddRounded,
  ArrowForwardRounded,
  DeleteOutlineRounded,
  RemoveRounded,
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
import { useCart } from "@/components/providers/cartProvider";
import { ProductCard } from "@/components/product/productCard";
import { Product } from "@/types/types";

interface CartPageProps {
  recommendations: Product[];
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

export function CartPage({ recommendations }: CartPageProps) {
  const { cart, itemCount, updateQuantity, removeItem } = useCart();
  const { items, shipping, subtotal, tax, total } = cart;

  return (
    <Box
      sx={(theme) => ({
        minHeight: "1500px",
        px: { xs: 1.5, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.16 : 0.08
        )}, transparent 24%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={4}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Chip
                icon={<ShoppingBagOutlined />}
                label="Cart"
                color="primary"
                sx={{ mb: 1.5, borderRadius: 999 }}
              />
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
                Your cart is ready.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Review your items, adjust quantities, and move into checkout when you’re ready.
              </Typography>
            </Box>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                minWidth: { md: 220 },
                width: { xs: "100%", md: "auto" },
                borderRadius: 3,
                backgroundColor: "action.hover",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Current selection
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                {itemCount}
              </Typography>
              <Typography variant="body2">{itemCount === 1 ? "item" : "items"} in cart</Typography>
            </Paper>
          </Stack>
        </Paper>

        {items.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              textAlign: "center",
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
              Your cart is empty
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Take a look around and add anything you love.
            </Typography>
            <Button
              component={Link}
              href="/products"
              variant="contained"
              endIcon={<ArrowForwardRounded />}
              sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 800 }}
            >
              Browse products
            </Button>
          </Paper>
        ) : (
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 360px" },
              alignItems: "start",
            }}
          >
            <Stack spacing={2}>
              {items.map((item) => (
                <Paper
                  key={item.id}
                  elevation={0}
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
                    <Box
                      sx={{
                        position: "relative",
                        width: { xs: "100%", sm: 140 },
                        height: { xs: 180, sm: 140 },
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor: "divider",
                        backgroundColor: "action.hover",
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(max-width: 600px) 100vw, 140px"
                        style={{
                          objectFit: "contain",
                          padding: "12px",
                        }}
                      />
                    </Box>

                    <Stack spacing={1.25} sx={{ flex: 1 }}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            {item.name}
                          </Typography>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                            {item.isPreorder ? <Chip label="Preorder" size="small" color="warning" /> : null}
                            {item.color ? <Chip label={item.color} size="small" variant="outlined" /> : null}
                            {item.size ? <Chip label={item.size} size="small" variant="outlined" /> : null}
                          </Stack>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                          {formatPrice(item.price * item.quantity)}
                        </Typography>
                      </Stack>

                      <Typography variant="body2" color="text.secondary">
                        Unit price {formatPrice(item.price)}
                      </Typography>

                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <IconButton
                            onClick={() => updateQuantity(item.id, -1)}
                            aria-label={`Decrease quantity for ${item.name}`}
                            size="small"
                          >
                            <RemoveRounded fontSize="small" />
                          </IconButton>
                          <Chip label={`Qty ${item.quantity}`} />
                          <IconButton
                            onClick={() => updateQuantity(item.id, 1)}
                            aria-label={`Increase quantity for ${item.name}`}
                            size="small"
                          >
                            <AddRounded fontSize="small" />
                          </IconButton>
                        </Stack>

                        <Button
                          onClick={() => removeItem(item.id)}
                          startIcon={<DeleteOutlineRounded />}
                          color="inherit"
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          Remove
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                position: { xl: "sticky" },
                top: { xl: 96 },
              }}
            >
              <Stack spacing={2}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  Order summary
                </Typography>

                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Subtotal</Typography>
                    <Typography fontWeight={700}>{formatPrice(subtotal)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Shipping</Typography>
                    <Typography fontWeight={700}>
                      {shipping === 0 ? "Free" : formatPrice(shipping)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Estimated tax</Typography>
                    <Typography fontWeight={700}>{formatPrice(tax)}</Typography>
                  </Stack>
                </Stack>

                <Divider />

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Total
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {formatPrice(total)}
                  </Typography>
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  Spend {formatPrice(Math.max(0, 200 - subtotal))} more to unlock free shipping.
                </Typography>

                <Button
                  component={Link}
                  href="/checkout"
                  variant="contained"
                  endIcon={<ArrowForwardRounded />}
                  sx={{ borderRadius: 999, py: 1.4, textTransform: "none", fontWeight: 800 }}
                >
                  Proceed to checkout
                </Button>
                <Button
                  component={Link}
                  href="/products"
                  variant="outlined"
                  sx={{ borderRadius: 999, py: 1.2, textTransform: "none", fontWeight: 800 }}
                >
                  Continue shopping
                </Button>
              </Stack>
            </Paper>
          </Box>
        )}

        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: "text.primary" }}>
            You might want these too
          </Typography>
          {recommendations.length ? (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
              }}
            >
              {recommendations.map((product) => (
                <ProductCard key={product.id} product={product} size="compact" />
              ))}
            </Box>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: "action.hover",
              }}
            >
              <Typography variant="body1" color="text.secondary">
                More suggestions will appear here soon.
              </Typography>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
