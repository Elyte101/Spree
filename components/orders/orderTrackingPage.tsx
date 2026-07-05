'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowBackRounded,
  CancelOutlined,
  CheckCircleOutlined,
  LocalShippingOutlined,
  PaymentOutlined,
  StorefrontOutlined,
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

import type { OrderDetail, OrderStatus } from "@/types/types";

const ease = [0.22, 1, 0.36, 1] as const;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateShort = (iso: string | null | undefined) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function daysRemaining(estimatedDate: string | null | undefined): number | null {
  if (!estimatedDate) return null;
  const now = Date.now();
  const eta = new Date(estimatedDate).getTime();
  const diff = Math.ceil((eta - now) / (1000 * 60 * 60 * 24));
  return diff;
}

interface TrackStep {
  key: OrderStatus | "ordered";
  label: string;
  sublabel: string | null;
  done: boolean;
  active: boolean;
  icon: React.ReactElement;
  timestamp: string | null | undefined;
}

// G8/G9: updated step order to match spec state machine.
const STEP_STATES = ["ordered", "paid", "in_transit", "delivered", "confirmed"] as const;
type StepState = typeof STEP_STATES[number];

function statusToStep(status: string): StepState {
  if (["confirmed", "paid_out"].includes(status)) return "confirmed";
  if (status === "delivered") return "delivered";
  if (["in_transit", "shipped"].includes(status)) return "in_transit";
  if (status === "paid") return "paid";
  return "ordered";
}

function buildSteps(order: OrderDetail): TrackStep[] {
  const currentStep = order.status === "cancelled" || order.status === "refunded"
    ? null
    : statusToStep(order.status);
  const currentIdx = currentStep ? STEP_STATES.indexOf(currentStep) : -1;

  return [
    {
      key: "ordered",
      label: "Order placed",
      sublabel: formatDate(order.createdAt),
      done: true,
      active: currentStep === "ordered",
      icon: <StorefrontOutlined />,
      timestamp: order.createdAt,
    },
    {
      key: "paid",
      label: "Payment confirmed",
      sublabel: order.paidAt ? formatDate(order.paidAt) : null,
      done: currentIdx >= 1,
      active: currentStep === "paid",
      icon: <PaymentOutlined />,
      timestamp: order.paidAt,
    },
    {
      key: "in_transit",
      label: "Shipped",
      sublabel: order.shippedAt ? formatDate(order.shippedAt) : "Awaiting dispatch from vendor",
      done: currentIdx >= 2,
      active: currentStep === "in_transit",
      icon: <LocalShippingOutlined />,
      timestamp: order.shippedAt,
    },
    {
      key: "delivered",
      label: "Delivered",
      sublabel: order.deliveredAt
        ? formatDate(order.deliveredAt)
        : order.estimatedDeliveryDate
        ? `Expected ${formatDateShort(order.estimatedDeliveryDate)}`
        : null,
      done: currentIdx >= 3,
      active: currentStep === "delivered",
      icon: <CheckCircleOutlined />,
      timestamp: order.deliveredAt,
    },
    {
      key: "confirmed",
      label: "Delivery confirmed",
      sublabel: order.payoutReleasedAt ? formatDate(order.payoutReleasedAt) : null,
      done: currentIdx >= 4,
      active: currentStep === "confirmed",
      icon: <CheckCircleOutlined />,
      timestamp: order.payoutReleasedAt,
    },
  ];
}

export function OrderTrackingPage({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const steps = buildSteps(order);
  const days = daysRemaining(order.estimatedDeliveryDate);
  const isCancelled = order.status === "cancelled";

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${alpha(theme.palette.primary.main, 0.07)} 0%, transparent 60%)`,
        pt: { xs: 10, md: 12 },
        pb: 8,
      })}
    >
      <Container maxWidth="sm">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          <Button
            startIcon={<ArrowBackRounded />}
            onClick={() => router.push(`/orders/${order.id}`)}
            sx={{ mb: 3, pl: 0 }}
            color="inherit"
          >
            Order details
          </Button>
        </motion.div>

        <Stack gap={3}>
          {/* Header card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
          >
            <Paper
              elevation={0}
              sx={(theme) => ({
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 3,
                overflow: "hidden",
              })}
            >
              <Box
                sx={(theme) => ({
                  px: 3,
                  py: 2.5,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
                })}
              >
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                  ORDER #{order.id.slice(0, 8).toUpperCase()}
                </Typography>
                <Typography variant="h5" fontWeight={800} mt={0.5}>
                  Track your delivery
                </Typography>
              </Box>

              <Stack gap={2} p={3}>
                {/* ETA banner */}
                {!isCancelled && !order.deliveredAt && (
                  <Box
                    sx={(theme) => ({
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor:
                        days !== null && days <= 0
                          ? alpha(theme.palette.success.main, 0.08)
                          : days !== null && days <= 2
                          ? alpha(theme.palette.warning.main, 0.08)
                          : alpha(theme.palette.primary.main, 0.07),
                      border: `1px solid ${
                        days !== null && days <= 0
                          ? alpha(theme.palette.success.main, 0.25)
                          : days !== null && days <= 2
                          ? alpha(theme.palette.warning.main, 0.25)
                          : alpha(theme.palette.primary.main, 0.2)
                      }`,
                    })}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                      <Box>
                        <Typography variant="overline" color="text.secondary" lineHeight={1.2}>
                          {days === null ? "Estimated delivery" : days <= 0 ? "Expected today" : `Arriving in`}
                        </Typography>
                        <Typography variant="h4" fontWeight={900} lineHeight={1.1}>
                          {days === null
                            ? order.shippedAt
                              ? "Calculating…"
                              : "Awaiting shipment"
                            : days <= 0
                            ? "Today"
                            : `${days} day${days === 1 ? "" : "s"}`}
                        </Typography>
                        {order.estimatedDeliveryDate && (
                          <Typography variant="body2" color="text.secondary" mt={0.5}>
                            By {formatDateShort(order.estimatedDeliveryDate)}
                          </Typography>
                        )}
                      </Box>
                      <LocalShippingOutlined
                        sx={(theme) => ({
                          fontSize: 48,
                          color:
                            days !== null && days <= 0
                              ? theme.palette.success.main
                              : days !== null && days <= 2
                              ? theme.palette.warning.main
                              : theme.palette.primary.main,
                          opacity: 0.6,
                        })}
                      />
                    </Stack>
                  </Box>
                )}

                {order.deliveredAt && (
                  <Box
                    sx={(theme) => ({
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.success.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                    })}
                  >
                    <CheckCircleOutlined color="success" />
                    <Typography variant="body1" fontWeight={700} color="success.main">
                      Delivered on {formatDateShort(order.deliveredAt)}
                    </Typography>
                  </Box>
                )}

                {isCancelled && (
                  <Box
                    sx={(theme) => ({
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.error.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                    })}
                  >
                    <CancelOutlined color="error" />
                    <Typography variant="body1" fontWeight={700} color="error">
                      Order cancelled
                    </Typography>
                  </Box>
                )}

                {/* Tracking number */}
                {order.trackingNumber && (
                  <Box
                    sx={(theme) => ({
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.info.main, 0.07),
                      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    })}
                  >
                    <Typography variant="caption" color="text.secondary">Tracking number</Typography>
                    <Typography variant="body1" fontWeight={700} fontFamily="monospace">
                      {order.trackingNumber}
                      {order.trackingCarrier ? ` · ${order.trackingCarrier}` : ""}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          </motion.div>

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease }}
          >
            <Paper
              elevation={0}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 3 }}
            >
              <Typography variant="subtitle1" fontWeight={700} mb={3}>
                Shipment timeline
              </Typography>

              <Stack gap={0}>
                {steps.map((step, i) => (
                  <React.Fragment key={step.key}>
                    <Stack direction="row" gap={2} alignItems="flex-start">
                      {/* Icon + connector */}
                      <Stack alignItems="center" gap={0} sx={{ minWidth: 36 }}>
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.3, delay: 0.15 + i * 0.08, ease }}
                        >
                          <Box
                            sx={(theme) => ({
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: step.done
                                ? step.active
                                  ? theme.palette.primary.main
                                  : theme.palette.success.main
                                : alpha(theme.palette.text.secondary, 0.12),
                              color: step.done ? "white" : "text.disabled",
                              "& svg": { fontSize: 18 },
                              flexShrink: 0,
                            })}
                          >
                            {React.cloneElement(step.icon)}
                          </Box>
                        </motion.div>
                        {i < steps.length - 1 && (
                          <Box
                            sx={(theme) => ({
                              width: 2,
                              flex: 1,
                              minHeight: 28,
                              bgcolor: step.done
                                ? theme.palette.success.main
                                : alpha(theme.palette.text.secondary, 0.12),
                              my: 0.5,
                              transition: "background-color 0.4s",
                            })}
                          />
                        )}
                      </Stack>

                      {/* Text */}
                      <Stack gap={0.25} pb={i < steps.length - 1 ? 2 : 0} pt={0.5}>
                        <Typography
                          variant="body1"
                          fontWeight={step.active || step.done ? 700 : 400}
                          color={step.done ? "text.primary" : "text.disabled"}
                        >
                          {step.label}
                        </Typography>
                        {step.sublabel && (
                          <Typography variant="body2" color="text.secondary">
                            {step.sublabel}
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </React.Fragment>
                ))}
              </Stack>
            </Paper>
          </motion.div>

          {/* Shipping details */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease }}
          >
            <Paper
              elevation={0}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 3 }}
            >
              <Typography variant="subtitle1" fontWeight={700} mb={2}>
                Delivery address
              </Typography>
              <Typography variant="body2" fontWeight={600}>{order.fullName}</Typography>
              <Typography variant="body2" color="text.secondary">{order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ""}</Typography>
              <Typography variant="body2" color="text.secondary">{order.city}, {order.state} {order.postalCode}</Typography>
              <Typography variant="body2" color="text.secondary">{order.country}</Typography>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Shipping method</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ textTransform: "capitalize" }}>{order.shippingMethod}</Typography>
              </Stack>
              {order.estimatedDeliveryDays && (
                <Stack direction="row" justifyContent="space-between" mt={0.5}>
                  <Typography variant="body2" color="text.secondary">vendor estimate</Typography>
                  <Typography variant="body2" fontWeight={600}>{order.estimatedDeliveryDays} day{order.estimatedDeliveryDays !== 1 ? "s" : ""}</Typography>
                </Stack>
              )}
            </Paper>
          </motion.div>
        </Stack>
      </Container>
    </Box>
  );
}
