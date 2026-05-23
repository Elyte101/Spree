'use client';

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  CheckCircleOutlined,
  ErrorOutlineRounded,
} from "@mui/icons-material";
import { alpha, Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";

import { useCart } from "@/components/providers/cartProvider";

const ease = [0.22, 1, 0.36, 1] as const;

type VerifyState = "loading" | "success" | "failed" | "error";

export function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { clearCart } = useCart();
  const [state, setState] = React.useState<VerifyState>("loading");
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string>("");
  const calledRef = React.useRef(false);

  React.useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const reference = params.get("reference") ?? "";

    if (!reference) {
      setState("error");
      setErrorMsg("No payment reference found. Please try checking out again.");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(
          `/api/orders/verify-payment?reference=${encodeURIComponent(reference)}`
        );
        const data = (await res.json()) as { orderId?: string; status?: string; detail?: string };

        if (!res.ok) {
          setState("failed");
          setErrorMsg(data.detail ?? "Payment could not be verified.");
          return;
        }

        if (data.status === "paid" || data.status === "completed") {
          clearCart();
          setOrderId(data.orderId ?? null);
          setState("success");
        } else {
          setState("failed");
          setErrorMsg(`Payment status: ${data.status ?? "unknown"}. Please contact support.`);
        }
      } catch {
        setState("error");
        setErrorMsg("Network error while verifying payment. Please try again.");
      }
    };

    void verify();
  }, [params, clearCart]);

  React.useEffect(() => {
    if (state === "success" && orderId) {
      const timer = setTimeout(() => {
        router.push(`/checkout/success?orderId=${orderId}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, orderId, router]);

  const icon =
    state === "loading" ? (
      <CircularProgress size={56} thickness={3} />
    ) : state === "success" ? (
      <CheckCircleOutlined sx={{ fontSize: 64, color: "success.main" }} />
    ) : (
      <ErrorOutlineRounded sx={{ fontSize: 64, color: "error.main" }} />
    );

  const title =
    state === "loading"
      ? "Verifying your payment…"
      : state === "success"
      ? "Payment confirmed!"
      : "Payment verification failed";

  const subtitle =
    state === "loading"
      ? "Please wait while we confirm your payment with Paystack."
      : state === "success"
      ? "Your order is being prepared. Redirecting you now…"
      : errorMsg;

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${alpha(
          state === "success"
            ? theme.palette.success.main
            : state === "loading"
            ? theme.palette.primary.main
            : theme.palette.error.main,
          0.08
        )} 0%, transparent 70%)`,
      })}
    >
      <Container maxWidth="sm">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <Stack alignItems="center" gap={3} textAlign="center" py={8}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1, ease }}
            >
              {icon}
            </motion.div>

            <Box>
              <Typography variant="h4" fontWeight={800} gutterBottom>
                {title}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {subtitle}
              </Typography>
            </Box>

            {(state === "failed" || state === "error") && (
              <Stack direction="row" gap={2} flexWrap="wrap" justifyContent="center">
                <Button
                  variant="contained"
                  onClick={() => router.push("/checkout")}
                  sx={{ borderRadius: 2.5, fontWeight: 700 }}
                >
                  Try again
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => router.push("/orders")}
                  sx={{ borderRadius: 2.5, fontWeight: 700 }}
                >
                  View my orders
                </Button>
              </Stack>
            )}
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
}
