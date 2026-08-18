'use client';

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  CancelOutlined,
  CheckCircleOutlined,
  LocalShippingOutlined,
  PaymentOutlined,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import {
  alpha,
  Box,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { OrderListItem } from "@/types/types";
import { formatOrderNumber } from "@/lib/orderNumber";
import { getOrderStatusMeta, type OrderStatusColor } from "@/lib/orderStatus";

const ease = [0.22, 1, 0.36, 1] as const;

const rowVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease },
  }),
};

function statusIcon(color: OrderStatusColor) {
  const sx = { fontSize: 14 };
  switch (color) {
    case "info":
      return <LocalShippingOutlined sx={sx} />;
    case "success":
      return <CheckCircleOutlined sx={sx} />;
    case "error":
      return <CancelOutlined sx={sx} />;
    case "warning":
    default:
      return <PaymentOutlined sx={sx} />;
  }
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function OrderRow({ order, index }: { order: OrderListItem; index: number }) {
  const meta = getOrderStatusMeta(order.status, "buyer");

  return (
    <motion.div custom={index} initial="hidden" animate="visible" variants={rowVariants}>
      <Paper
        component={Link}
        href={`/orders/${order.id}`}
        elevation={0}
        sx={(theme) => ({
          display: "block",
          textDecoration: "none",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          p: 2.5,
          transition: "border-color 0.2s, box-shadow 0.2s",
          "&:hover": {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.25)}`,
          },
        })}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          gap={1.5}
        >
          <Stack gap={0.5}>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {formatOrderNumber(order.id)}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {order.fullName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} ·{" "}
              {order.shippingMethod} · {formatDate(order.createdAt)}
            </Typography>
            {order.trackingNumber && (
              <Typography variant="caption" color="text.secondary">
                Tracking: {order.trackingNumber}
              </Typography>
            )}
          </Stack>

          <Stack alignItems={{ xs: "flex-start", sm: "flex-end" }} gap={1}>
            <Typography variant="h6" fontWeight={700}>
              {formatPrice(order.total)}
            </Typography>
            <Chip
              size="small"
              icon={statusIcon(meta.color)}
              label={meta.label}
              color={meta.color}
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          </Stack>
        </Stack>
      </Paper>
    </motion.div>
  );
}

export function OrderHistoryPage({ orders }: { orders: OrderListItem[] }) {
  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        background: `radial-gradient(ellipse 80% 40% at 20% 0%, ${alpha(theme.palette.primary.main, 0.07)} 0%, transparent 60%),
          radial-gradient(ellipse 60% 30% at 80% 100%, ${alpha(theme.palette.secondary.main, 0.05)} 0%, transparent 50%)`,
        pt: { xs: 10, md: 12 },
        pb: 8,
      })}
    >
      <Container maxWidth="md">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <Stack direction="row" alignItems="center" gap={1.5} mb={4}>
            <ReceiptLongOutlined color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h4" fontWeight={800} color="text.primary">
                My Orders
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {orders.length} order{orders.length !== 1 ? "s" : ""}
              </Typography>
            </Box>
          </Stack>
        </motion.div>

        {orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease }}
          >
            <Paper
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 4,
                p: 6,
                textAlign: "center",
              }}
            >
              <ReceiptLongOutlined sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom>
                No orders yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Once you place an order, it will appear here.
              </Typography>
            </Paper>
          </motion.div>
        ) : (
          <Stack gap={2}>
            {orders.map((order, i) => (
              <OrderRow key={order.id} order={order} index={i} />
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 4 }} />
        <Typography variant="caption" color="text.disabled" textAlign="center" display="block">
          Payments are held securely by Spree until delivery is confirmed.
        </Typography>
      </Container>
    </Box>
  );
}
