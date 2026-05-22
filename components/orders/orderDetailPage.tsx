'use client';

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowBackRounded,
  CancelOutlined,
  CheckCircleOutlined,
  LocalShippingOutlined,
  LockOutlined,
  PaymentOutlined,
  TrackChangesRounded,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { OrderDetail, OrderStatus } from "@/types/types";

const ease = [0.22, 1, 0.36, 1] as const;

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.07, ease },
  }),
};

const statusMeta: Record<
  OrderStatus,
  { label: string; color: "warning" | "info" | "success" | "error"; icon: React.ReactElement }
> = {
  paid: {
    label: "Payment confirmed",
    color: "warning",
    icon: <PaymentOutlined sx={{ fontSize: 16 }} />,
  },
  shipped: {
    label: "Shipped",
    color: "info",
    icon: <LocalShippingOutlined sx={{ fontSize: 16 }} />,
  },
  completed: {
    label: "Delivered",
    color: "success",
    icon: <CheckCircleOutlined sx={{ fontSize: 16 }} />,
  },
  cancelled: {
    label: "Cancelled",
    color: "error",
    icon: <CancelOutlined sx={{ fontSize: 16 }} />,
  },
};

const statusSteps: { key: OrderStatus; label: string }[] = [
  { key: "paid", label: "Order placed" },
  { key: "shipped", label: "Shipped" },
  { key: "completed", label: "Delivered" },
];

const stepOrder: Record<OrderStatus, number> = {
  paid: 0,
  shipped: 1,
  completed: 2,
  cancelled: -1,
};

const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function StatusTimeline({ status }: { status: OrderStatus }) {
  const current = stepOrder[status];
  if (status === "cancelled") {
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <CancelOutlined color="error" />
        <Typography variant="body2" color="error" fontWeight={600}>
          Order cancelled
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" gap={0}>
      {statusSteps.map((step, i) => {
        const done = current >= i;
        const active = current === i;
        return (
          <React.Fragment key={step.key}>
            <Stack alignItems="center" gap={0.5} minWidth={80}>
              <Box
                sx={(theme) => ({
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: done
                    ? active
                      ? theme.palette.primary.main
                      : theme.palette.success.main
                    : alpha(theme.palette.text.secondary, 0.15),
                  color: done ? "white" : "text.disabled",
                  fontSize: 13,
                  fontWeight: 700,
                  transition: "background-color 0.3s",
                })}
              >
                {done && !active ? <CheckCircleOutlined sx={{ fontSize: 16 }} /> : i + 1}
              </Box>
              <Typography
                variant="caption"
                fontWeight={done ? 600 : 400}
                color={done ? "text.primary" : "text.disabled"}
                textAlign="center"
              >
                {step.label}
              </Typography>
            </Stack>
            {i < statusSteps.length - 1 && (
              <Box
                sx={(theme) => ({
                  flex: 1,
                  height: 2,
                  bgcolor: current > i
                    ? theme.palette.success.main
                    : alpha(theme.palette.text.secondary, 0.15),
                  mt: -2.5,
                  transition: "background-color 0.3s",
                })}
              />
            )}
          </React.Fragment>
        );
      })}
    </Stack>
  );
}

export function OrderDetailPage({
  order,
  sessionUserId,
}: {
  order: OrderDetail;
  sessionUserId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [tracking, setTracking] = React.useState(false);
  const [trackingNumber, setTrackingNumber] = React.useState("");
  const [carrier, setCarrier] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const isBuyer = order.userId === sessionUserId;
  const isSeller = order.items.some((item) => item.sellerId === sessionUserId);
  const canConfirm = isBuyer && order.status === "shipped";
  const canCancel = isBuyer && order.status === "paid";
  const canAddTracking = isSeller && order.status === "paid";

  const handleConfirmDelivery = async () => {
    setError(null);
    setConfirming(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/confirm-delivery`, { method: "PUT" });
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string };
        setError(data.detail ?? "Failed to confirm delivery.");
      } else {
        setSuccessMsg("Delivery confirmed! Payment has been released to the seller.");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    setError(null);
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: "PUT" });
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string };
        setError(data.detail ?? "Failed to cancel order.");
      } else {
        setSuccessMsg("Order has been cancelled.");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleAddTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;
    setError(null);
    setTracking(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/track`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: trackingNumber.trim(), carrier: carrier.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string };
        setError(data.detail ?? "Failed to add tracking.");
      } else {
        setSuccessMsg("Tracking information saved. The buyer has been notified.");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTracking(false);
    }
  };

  const meta = statusMeta[order.status];

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        background: `radial-gradient(ellipse 80% 40% at 20% 0%, ${alpha(theme.palette.primary.main, 0.07)} 0%, transparent 60%)`,
        pt: { xs: 10, md: 12 },
        pb: 8,
      })}
    >
      <Container maxWidth="md">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          <Button
            startIcon={<ArrowBackRounded />}
            onClick={() => router.push("/orders")}
            sx={{ mb: 3, pl: 0 }}
            color="inherit"
          >
            My Orders
          </Button>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ marginBottom: 16 }}
            >
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ marginBottom: 16 }}
            >
              <Alert severity="success" onClose={() => setSuccessMsg(null)}>
                {successMsg}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <Stack gap={3}>
          {/* Header */}
          <motion.div custom={0} initial="hidden" animate="visible" variants={sectionVariants}>
            <Paper
              elevation={0}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 3 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                gap={2}
                mb={3}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                    ORDER #{order.id.slice(0, 8).toUpperCase()}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} mt={0.5}>
                    Order Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Placed {formatDate(order.createdAt)}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    icon={meta.icon}
                    label={meta.label}
                    color={meta.color}
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: 13 }}
                  />
                  {(order.status === "shipped" || order.status === "completed") && (
                    <Button
                      component={Link}
                      href={`/orders/${order.id}/tracking`}
                      size="small"
                      startIcon={<TrackChangesRounded />}
                      variant="outlined"
                      sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: "none" }}
                    >
                      Track delivery
                    </Button>
                  )}
                </Stack>
              </Stack>

              <StatusTimeline status={order.status} />

              {order.trackingNumber && (
                <Box
                  mt={2}
                  sx={(theme) => ({
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.info.main, 0.08),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  })}
                >
                  <Stack direction="row" alignItems="center" gap={1}>
                    <LocalShippingOutlined color="info" sx={{ fontSize: 18 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Tracking number
                      </Typography>
                      <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                        {order.trackingNumber}
                        {order.trackingCarrier ? ` · ${order.trackingCarrier}` : ""}
                      </Typography>
                      {order.shippedAt && (
                        <Typography variant="caption" color="text.secondary">
                          Shipped {formatDate(order.shippedAt)}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              )}

              {canAddTracking && (
                <Box
                  component="form"
                  onSubmit={handleAddTracking}
                  mt={3}
                  sx={(theme) => ({
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.warning.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                  })}
                >
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <LocalShippingOutlined color="warning" sx={{ fontSize: 18 }} />
                    <Typography variant="subtitle2" fontWeight={700} color="warning.main">
                      Mark as shipped — add tracking info
                    </Typography>
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
                    <TextField
                      label="Tracking number"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      required
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Carrier (optional)"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="warning"
                        disabled={tracking || !trackingNumber.trim()}
                        startIcon={
                          tracking ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <LocalShippingOutlined />
                          )
                        }
                        sx={{ fontWeight: 700, borderRadius: 2.5, whiteSpace: "nowrap", height: 40 }}
                      >
                        Mark shipped
                      </Button>
                    </motion.div>
                  </Stack>
                </Box>
              )}

              {(canConfirm || canCancel) && (
                <Stack direction="row" gap={2} mt={3} flexWrap="wrap">
                  {canConfirm && (
                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={
                          confirming ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <CheckCircleOutlined />
                          )
                        }
                        onClick={handleConfirmDelivery}
                        disabled={confirming}
                        sx={{ fontWeight: 700, borderRadius: 2.5 }}
                      >
                        Confirm Delivery
                      </Button>
                    </motion.div>
                  )}
                  {canCancel && (
                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={
                          cancelling ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <CancelOutlined />
                          )
                        }
                        onClick={handleCancel}
                        disabled={cancelling}
                        sx={{ fontWeight: 700, borderRadius: 2.5 }}
                      >
                        Cancel Order
                      </Button>
                    </motion.div>
                  )}
                </Stack>
              )}
            </Paper>
          </motion.div>

          {/* Items */}
          <motion.div custom={1} initial="hidden" animate="visible" variants={sectionVariants}>
            <Paper
              elevation={0}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}
            >
              <Box
                sx={(theme) => ({
                  px: 3,
                  py: 2,
                  background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.04)})`,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                })}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  Items ({order.items.length})
                </Typography>
              </Box>
              <Stack divider={<Divider />}>
                {order.items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 + i * 0.06, ease }}
                  >
                    <Stack direction="row" gap={2} p={2.5} alignItems="center">
                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 2,
                          overflow: "hidden",
                          flexShrink: 0,
                          position: "relative",
                          bgcolor: "action.hover",
                        }}
                      >
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          style={{ objectFit: "cover" }}
                        />
                      </Box>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {item.name}
                        </Typography>
                        {(item.color || item.size) && (
                          <Typography variant="caption" color="text.secondary">
                            {[item.color, item.size].filter(Boolean).join(" · ")}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" display="block">
                          Qty: {item.quantity}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700}>
                        {formatPrice(item.price * item.quantity)}
                      </Typography>
                    </Stack>
                  </motion.div>
                ))}
              </Stack>
            </Paper>
          </motion.div>

          {/* Summary + Shipping */}
          <Stack direction={{ xs: "column", md: "row" }} gap={3}>
            {/* Totals */}
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              style={{ flex: 1 }}
            >
              <Paper
                elevation={0}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 3, height: "100%" }}
              >
                <Typography variant="subtitle1" fontWeight={700} mb={2}>
                  Payment summary
                </Typography>
                <Stack gap={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Subtotal
                    </Typography>
                    <Typography variant="body2">{formatPrice(order.subtotal)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Shipping ({order.shippingMethod})
                    </Typography>
                    <Typography variant="body2">
                      {order.shippingCost === 0 ? "Free" : formatPrice(order.shippingCost)}
                    </Typography>
                  </Stack>
                  {order.tax > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Tax
                      </Typography>
                      <Typography variant="body2">{formatPrice(order.tax)}</Typography>
                    </Stack>
                  )}
                  <Divider sx={{ my: 0.5 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body1" fontWeight={700}>
                      Total
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>
                      {formatPrice(order.total)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Payment method
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {order.paymentMethod}
                    </Typography>
                  </Stack>
                </Stack>

                <Box
                  mt={2.5}
                  sx={(theme) => ({
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  })}
                >
                  <LockOutlined color="success" sx={{ fontSize: 16 }} />
                  <Typography variant="caption" color="success.main" fontWeight={600}>
                    {order.status === "completed"
                      ? "Payment released to seller"
                      : order.status === "cancelled"
                      ? "Order cancelled"
                      : "Payment held securely by Spree"}
                  </Typography>
                </Box>
              </Paper>
            </motion.div>

            {/* Shipping address */}
            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              style={{ flex: 1 }}
            >
              <Paper
                elevation={0}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 3, height: "100%" }}
              >
                <Typography variant="subtitle1" fontWeight={700} mb={2}>
                  Shipping address
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {order.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order.addressLine1}
                  {order.addressLine2 ? `, ${order.addressLine2}` : ""}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order.city}, {order.state} {order.postalCode}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order.country}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  {order.email}
                </Typography>
                {order.phone && (
                  <Typography variant="body2" color="text.secondary">
                    {order.phone}
                  </Typography>
                )}
              </Paper>
            </motion.div>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
