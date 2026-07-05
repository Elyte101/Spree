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
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { OrderListItem, OrderStatus } from "@/types/types";
import { formatPrice } from "@/lib/ghana";

const ease = [0.22, 1, 0.36, 1] as const;

const rowVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease },
  }),
};

const DEFAULT_STATUS_META = {
  label: "Unknown",
  color: "default" as const,
  icon: <ReceiptLongOutlined sx={{ fontSize: 14 }} />,
};

const statusMeta: Record<
  string,
  { label: string; color: "warning" | "info" | "success" | "error" | "default"; icon: React.ReactElement }
> = {
  pending: {
    label: "Pending payment",
    color: "warning",
    icon: <PaymentOutlined sx={{ fontSize: 14 }} />,
  },
  pending_payment: {
    label: "Pending payment",
    color: "warning",
    icon: <PaymentOutlined sx={{ fontSize: 14 }} />,
  },
  paid: {
    label: "Awaiting shipment",
    color: "warning",
    icon: <PaymentOutlined sx={{ fontSize: 14 }} />,
  },
  in_transit: {
    label: "In transit",
    color: "info",
    icon: <LocalShippingOutlined sx={{ fontSize: 14 }} />,
  },
  delivered: {
    label: "Delivered",
    color: "success",
    icon: <CheckCircleOutlined sx={{ fontSize: 14 }} />,
  },
  confirmed: {
    label: "Delivery confirmed",
    color: "success",
    icon: <CheckCircleOutlined sx={{ fontSize: 14 }} />,
  },
  paid_out: {
    label: "Payout released",
    color: "success",
    icon: <CheckCircleOutlined sx={{ fontSize: 14 }} />,
  },
  cancelled: {
    label: "Cancelled",
    color: "error",
    icon: <CancelOutlined sx={{ fontSize: 14 }} />,
  },
  refunded: {
    label: "Refunded",
    color: "error",
    icon: <CancelOutlined sx={{ fontSize: 14 }} />,
  },
  // Legacy statuses in DB from before the spec-aligned state machine
  shipped: {
    label: "Shipped",
    color: "info",
    icon: <LocalShippingOutlined sx={{ fontSize: 14 }} />,
  },
  completed: {
    label: "Completed",
    color: "success",
    icon: <CheckCircleOutlined sx={{ fontSize: 14 }} />,
  },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function OrderRow({ order, index }: { order: OrderListItem; index: number }) {
  const meta = statusMeta[order.status] ?? DEFAULT_STATUS_META;

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
          borderRadius: 2.5,
          p: 2.5,
          transition: "border-color 0.2s, box-shadow 0.2s",
          "&:hover": {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.2)}`,
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
            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
              #{order.id.slice(0, 8).toUpperCase()}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {order.fullName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} · {formatDate(order.createdAt)}
            </Typography>
            {order.status === "paid" && (
              <Typography variant="caption" color="warning.main" fontWeight={600}>
                Action needed: ship this order
              </Typography>
            )}
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
              icon={meta.icon}
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

export function VendorOrdersPage({ orders }: { orders: OrderListItem[] }) {
  const pending = orders.filter((o) => o.status === "paid");
  const other = orders.filter((o) => o.status !== "paid");

  return (
    <Stack spacing={3}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          <ReceiptLongOutlined color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Orders
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {orders.length} order{orders.length !== 1 ? "s" : ""} containing your products
            </Typography>
          </Box>
        </Stack>
      </motion.div>

      {orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease }}
        >
          <Paper
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 5,
              textAlign: "center",
            }}
          >
            <ReceiptLongOutlined sx={{ fontSize: 48, color: "text.disabled", mb: 1.5 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>
              No orders yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Orders containing your products will appear here.
            </Typography>
          </Paper>
        </motion.div>
      ) : (
        <Stack gap={3}>
          {pending.length > 0 && (
            <Stack gap={2}>
              <Box
                sx={(theme) => ({
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                })}
              >
                <Typography variant="subtitle2" color="warning.main" fontWeight={700}>
                  Action required — {pending.length} order{pending.length !== 1 ? "s" : ""} awaiting shipment
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Go to the order detail page to add tracking information.
                </Typography>
              </Box>
              {pending.map((order, i) => (
                <OrderRow key={order.id} order={order} index={i} />
              ))}
            </Stack>
          )}

          {other.length > 0 && (
            <Stack gap={2}>
              {pending.length > 0 && (
                <Divider>
                  <Typography variant="caption" color="text.secondary">
                    All other orders
                  </Typography>
                </Divider>
              )}
              {other.map((order, i) => (
                <OrderRow key={order.id} order={order} index={pending.length + i} />
              ))}
            </Stack>
          )}
        </Stack>
      )}

      <Divider />
      <Typography variant="caption" color="text.disabled" textAlign="center" display="block">
        Spree holds buyer payments securely. Your payout (original price) is released when the buyer confirms delivery.
      </Typography>
    </Stack>
  );
}
