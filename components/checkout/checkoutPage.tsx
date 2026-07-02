'use client';

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  CreditCardRounded,
  LockOutlined,
  LocalShippingRounded,
  PhoneAndroidRounded,
  AccountBalanceRounded,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useCart } from "@/components/providers/cartProvider";
import { PhoneInput } from "@/components/ui/phoneInput";
import { useCartStore } from "@/lib/stores/cartStore";
import { PROCESSING_FEE_RATE } from "@/lib/pricing";
import { UserProfile, Product } from "@/types/types";
import { formatPrice, COUNTRY_LIST, DEFAULT_COUNTRY, getRegionsForCountry, getRegionLabel } from "@/lib/ghana";

const ease = [0.22, 1, 0.36, 1] as const;

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease },
  }),
};

interface CheckoutFormState {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

type MomoProvider = "mtn" | "vod" | "atl";
type PaymentStage = "idle" | "charging" | "otp_needed" | "polling" | "verifying";

function StepBadge({ n }: { n: number }) {
  return (
    <Box
      sx={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "primary.main",
        color: "primary.contrastText",
        fontWeight: 900,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {n}
    </Box>
  );
}

const shippingOptions = [
  { value: "standard", label: "Standard", detail: "3–5 business days", priceKey: "standard" as const },
  { value: "express", label: "Express", detail: "2 business days", price: 18 },
];

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        access_code?: string;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

function loadPaystackJS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.PaystackPop) {
      resolve();
      return;
    }
    const existing = document.getElementById("paystack-inline-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "paystack-inline-js";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack payment library"));
    document.head.appendChild(script);
  });
}

export function CheckoutPage({ initialProfile }: { initialProfile?: UserProfile | null }) {
  const { cart, clearCart } = useCart();
  const refreshPrices = useCartStore((s) => s.refreshPrices);

  const [shippingMethod, setShippingMethod] = React.useState("standard");
  const [paymentMethod, setPaymentMethod] = React.useState<"momo" | "card">("momo");
  const [stage, setStage] = React.useState<PaymentStage>("idle");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // MoMo fields
  const [momoPhone, setMomoPhone] = React.useState("");
  const [momoProvider, setMomoProvider] = React.useState<MomoProvider | "">("");

  // OTP fields
  const [otp, setOtp] = React.useState("");
  const [momoPrompt, setMomoPrompt] = React.useState("");

  // Holds reference + orderId across async steps
  const pendingPaymentRef = React.useRef<{ reference: string; orderId: string } | null>(null);
  const pollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh item prices from the catalog on mount so stale localStorage prices
  // don't cause a mismatch with the server's recomputed totals.
  React.useEffect(() => {
    const ids = cart.items.map((i) => i.productId).filter(Boolean) as string[];
    if (!ids.length) return;
    fetch(`/api/products?ids=${ids.join(",")}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { items?: Product[] } | null) => {
        const products = data?.items ?? [];
        if (!products.length) return;
        const priceMap: Record<string, number> = {};
        for (const p of products) priceMap[p.id] = p.price;
        refreshPrices(priceMap);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop polling on unmount
  React.useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const [form, setForm] = React.useState<CheckoutFormState>(() => {
    const addr = initialProfile?.shippingAddress;
    return {
      fullName: addr?.fullName || initialProfile?.name || "",
      email: initialProfile?.email || "",
      phone: initialProfile?.phone || "",
      addressLine1: addr?.addressLine1 || "",
      addressLine2: addr?.addressLine2 || "",
      city: addr?.city || "",
      state: addr?.state || "",
      postalCode: addr?.postalCode || "",
      country: addr?.country || DEFAULT_COUNTRY,
    };
  });

  const setField =
    (field: keyof CheckoutFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const standardShipping = cart.standardShipping ?? cart.shipping;
  const shipping =
    cart.items.length === 0 ? 0 : shippingMethod === "express" ? 18 : standardShipping;
  const total = Number((cart.subtotal + shipping + cart.tax).toFixed(2));

  const formIsValid =
    form.fullName.trim().length >= 2 &&
    form.email.trim().length >= 5 &&
    form.addressLine1.trim().length >= 2 &&
    form.city.trim().length >= 1 &&
    form.state.trim().length >= 1 &&
    form.postalCode.trim().length >= 1 &&
    form.country.trim().length >= 1;

  const momoDetailsValid =
    paymentMethod !== "momo" ||
    (momoPhone.replace(/\D/g, "").length >= 9 && !!momoProvider);

  const canSubmit =
    cart.items.length > 0 &&
    stage === "idle" &&
    !submitting &&
    formIsValid &&
    momoDetailsValid;

  const buildOrderPayload = () => ({
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || null,
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2.trim() || null,
    city: form.city.trim(),
    state: form.state.trim(),
    postalCode: form.postalCode.trim(),
    country: form.country.trim(),
    shippingMethod,
    paymentMethod,
    subtotal: cart.subtotal,
    shippingCost: shipping,
    tax: cart.tax,
    total,
    currency: "GHS",
    items: cart.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      color: item.color ?? null,
      size: item.size ?? null,
    })),
  });

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const verifyAndComplete = React.useCallback(async (reference: string, orderId: string) => {
    setStage("verifying");
    try {
      const res = await fetch(`/api/orders/verify-payment?reference=${encodeURIComponent(reference)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? "Payment verification failed");
      }
      clearCart();
      window.location.href = `/checkout/success?orderId=${orderId}`;
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `${err.message} — reference: ${reference}`
          : `Verification failed — reference: ${reference}`
      );
      setSubmitting(false);
      setStage("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = React.useCallback((reference: string, orderId: string) => {
    setStage("polling");
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/check-charge?reference=${encodeURIComponent(reference)}`);
        if (!res.ok) return;
        const data = await res.json() as { status: string };
        if (data.status === "success") {
          stopPolling();
          await verifyAndComplete(reference, orderId);
        } else if (data.status === "failed") {
          stopPolling();
          setSubmitError("Payment was declined. Please try a different number or provider.");
          setSubmitting(false);
          setStage("idle");
        }
      } catch {
        // Network error during poll — keep trying
      }
    }, 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyAndComplete]);

  const handleOtpSubmit = async () => {
    const { reference, orderId } = pendingPaymentRef.current ?? {};
    if (!reference || !orderId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/submit-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim(), reference }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? "OTP submission failed");
      }
      const { status } = await res.json() as { status: string };
      if (status === "pending") {
        setOtp("");
        startPolling(reference, orderId);
      } else if (status === "success") {
        await verifyAndComplete(reference, orderId);
      } else {
        throw new Error("OTP verification failed. Please try again.");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const handleMomoPayment = async () => {
    setStage("charging");
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/orders/charge-momo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildOrderPayload(),
          momoPhone: momoPhone.trim(),
          momoProvider,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? "Payment initiation failed");
      }
      const { orderId, reference, status, displayText } = await res.json() as {
        orderId: string;
        reference: string;
        status: string;
        displayText: string;
      };
      pendingPaymentRef.current = { reference, orderId };

      if (status === "send_otp") {
        setMomoPrompt(displayText);
        setStage("otp_needed");
        setSubmitting(false);
      } else if (status === "pending") {
        startPolling(reference, orderId);
      } else if (status === "success") {
        await verifyAndComplete(reference, orderId);
      } else {
        throw new Error(displayText || "Payment failed. Please try again.");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
      setStage("idle");
    }
  };

  const handleCardPayment = async () => {
    setStage("charging");
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/orders/initialize-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOrderPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? "Failed to initialize payment");
      }
      const { orderId, reference, authorizationUrl, accessCode } = await res.json() as {
        orderId: string;
        reference: string;
        authorizationUrl: string;
        accessCode: string;
      };

      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

      if (!publicKey || !accessCode) {
        // Dev mode or missing key — fall back to redirect
        window.location.href = authorizationUrl;
        return;
      }

      await loadPaystackJS();

      window.PaystackPop.setup({
        key: publicKey,
        email: form.email.trim(),
        amount: Math.round(total * 100),
        currency: "GHS",
        ref: reference,
        access_code: accessCode,
        callback: async (response) => {
          await verifyAndComplete(response.reference, orderId);
        },
        onClose: () => {
          setSubmitError("Payment was cancelled. Your order has been saved — click Pay again to complete.");
          setSubmitting(false);
          setStage("idle");
        },
      }).openIframe();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
      setStage("idle");
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (paymentMethod === "momo") {
      handleMomoPayment();
    } else {
      handleCardPayment();
    }
  };

  const buttonLabel = (() => {
    if (stage === "charging" || stage === "verifying") return "Processing...";
    if (paymentMethod === "momo") return "Pay with Mobile Money";
    return "Pay with Card";
  })();

  const cardSx = {
    p: { xs: 2, sm: 3 },
    borderRadius: 3,
    border: "1px solid",
    borderColor: "divider",
  } as const;

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        px: { xs: 1.5, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `
          radial-gradient(ellipse 60% 40% at 0% 0%,
            ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.1)},
            transparent
          ),
          radial-gradient(ellipse 50% 35% at 100% 100%,
            ${alpha(theme.palette.secondary.main, theme.palette.mode === "dark" ? 0.12 : 0.06)},
            transparent
          ),
          ${theme.palette.background.default}
        `,
      })}
    >
      <Stack spacing={4}>
        {/* ── Header ── */}
        <motion.div custom={0} variants={sectionVariants} initial="hidden" animate="visible">
          <Paper
            elevation={0}
            sx={(theme) => ({
              ...cardSx,
              background: `linear-gradient(135deg,
                ${alpha(theme.palette.primary.main, 0.07)} 0%,
                transparent 60%
              )`,
            })}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ sm: "flex-end" }}
              spacing={2}
            >
              <Box>
                <Chip
                  icon={<LockOutlined />}
                  label="Secure Checkout"
                  color="primary"
                  sx={{ mb: 1.5, borderRadius: 999 }}
                />
                <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
                  Finish your purchase.
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 480 }}>
                  Fill in your details, pick a delivery option, and place your order.
                </Typography>
              </Box>
              {cart.items.length > 0 && (
                <Chip
                  label={`${cart.items.length} item${cart.items.length === 1 ? "" : "s"} · ${formatPrice(total)}`}
                  color="primary"
                  variant="outlined"
                  sx={{ borderRadius: 999, fontWeight: 700, display: { xs: "none", sm: "flex" } }}
                />
              )}
            </Stack>
          </Paper>
        </motion.div>

        {/* ── Error alert (top) ── */}
        <AnimatePresence>
          {submitError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.25, ease }}
            >
              <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ borderRadius: 2 }}>
                {submitError}
              </Alert>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 380px" },
            alignItems: "start",
          }}
        >
          {/* ── Left column – form ── */}
          <Stack spacing={2.5}>
            {/* Contact */}
            <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
              <Paper elevation={0} sx={cardSx}>
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <StepBadge n={1} />
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                        Contact details
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Your confirmation will be sent here
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider />

                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                    }}
                  >
                    <TextField
                      label="Full name"
                      value={form.fullName}
                      onChange={setField("fullName")}
                      autoComplete="name"
                      required
                      sx={{ gridColumn: { sm: "1 / -1" } }}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={setField("email")}
                      autoComplete="email"
                      required
                    />
                    <PhoneInput
                      label="Phone"
                      value={form.phone}
                      onChange={(val) => setForm((prev) => ({ ...prev, phone: val }))}
                      autoComplete="tel"
                    />
                    <TextField
                      label="Address"
                      value={form.addressLine1}
                      onChange={setField("addressLine1")}
                      autoComplete="address-line1"
                      required
                      sx={{ gridColumn: { sm: "1 / -1" } }}
                    />
                    <TextField
                      label="Apt, floor, etc."
                      value={form.addressLine2}
                      onChange={setField("addressLine2")}
                      autoComplete="address-line2"
                      sx={{ gridColumn: { sm: "1 / -1" } }}
                    />
                    <TextField
                      label="City"
                      value={form.city}
                      onChange={setField("city")}
                      autoComplete="address-level2"
                      required
                    />
                    {(() => {
                      const regions = getRegionsForCountry(form.country);
                      const label = getRegionLabel(form.country);
                      return regions ? (
                        <FormControl required>
                          <InputLabel>{label}</InputLabel>
                          <Select
                            label={label}
                            value={form.state}
                            onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                            autoComplete="address-level1"
                          >
                            {regions.map((r) => (
                              <MenuItem key={r} value={r}>{r}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          label={label}
                          value={form.state}
                          onChange={setField("state")}
                          autoComplete="address-level1"
                          required
                        />
                      );
                    })()}
                    <TextField
                      label="Postal / Digital Address"
                      value={form.postalCode}
                      onChange={setField("postalCode")}
                      autoComplete="postal-code"
                      placeholder={form.country === "Ghana" ? "e.g. GA-123-4567" : ""}
                      required
                    />
                    <FormControl required>
                      <InputLabel>Country</InputLabel>
                      <Select
                        label="Country"
                        value={form.country}
                        onChange={(e) => setForm((p) => ({ ...p, country: e.target.value, state: "" }))}
                        autoComplete="country-name"
                      >
                        {COUNTRY_LIST.map((c) => (
                          <MenuItem key={c} value={c}>{c}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Stack>
              </Paper>
            </motion.div>

            {/* Delivery */}
            <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
              <Paper elevation={0} sx={cardSx}>
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <StepBadge n={2} />
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                        Delivery method
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Choose how fast you want it
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider />

                  <Stack spacing={1.5}>
                    {shippingOptions.map((option) => {
                      const isSelected = shippingMethod === option.value;
                      const price = option.value === "express" ? 18 : standardShipping;
                      return (
                        <motion.div key={option.value} whileTap={{ scale: 0.985 }} transition={{ duration: 0.12 }}>
                          <Box
                            onClick={() => setShippingMethod(option.value)}
                            sx={(theme) => ({
                              p: 2,
                              borderRadius: 2,
                              border: "1.5px solid",
                              borderColor: isSelected ? "primary.main" : "divider",
                              bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.05) : "transparent",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              transition: "border-color 0.18s, background-color 0.18s",
                              "&:hover": { borderColor: isSelected ? "primary.main" : "text.disabled" },
                            })}
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Radio
                                checked={isSelected}
                                onChange={() => setShippingMethod(option.value)}
                                size="small"
                                sx={{ p: 0 }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Box>
                                <Typography fontWeight={700}>{option.label}</Typography>
                                <Typography variant="body2" color="text.secondary">{option.detail}</Typography>
                              </Box>
                            </Stack>
                            <Typography
                              fontWeight={800}
                              color={isSelected ? "primary.main" : "text.primary"}
                              sx={{ transition: "color 0.18s" }}
                            >
                              {formatPrice(price)}
                            </Typography>
                          </Box>
                        </motion.div>
                      );
                    })}
                  </Stack>
                </Stack>
              </Paper>
            </motion.div>

            {/* Payment */}
            <motion.div custom={3} variants={sectionVariants} initial="hidden" animate="visible">
              <Paper elevation={0} sx={cardSx}>
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <StepBadge n={3} />
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                        Payment method
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Handled securely by Paystack
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider />

                  <Stack spacing={1.5}>
                    {(
                      [
                        {
                          value: "momo" as const,
                          label: "Mobile Money",
                          detail: "MTN MoMo · Telecel Cash · AirtelTigo",
                          icon: <PhoneAndroidRounded />,
                        },
                        {
                          value: "card" as const,
                          label: "Card / Bank Transfer",
                          detail: "Visa, Mastercard, GHIPSS instant pay",
                          icon: <AccountBalanceRounded />,
                        },
                      ] as const
                    ).map((opt) => {
                      const isSelected = paymentMethod === opt.value;
                      return (
                        <motion.div key={opt.value} whileTap={{ scale: 0.985 }} transition={{ duration: 0.12 }}>
                          <Box
                            onClick={() => { setPaymentMethod(opt.value); setStage("idle"); }}
                            sx={(theme) => ({
                              p: 2,
                              borderRadius: 2,
                              border: "1.5px solid",
                              borderColor: isSelected ? "primary.main" : "divider",
                              bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.05) : "transparent",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                              transition: "border-color 0.18s, background-color 0.18s",
                              "&:hover": { borderColor: isSelected ? "primary.main" : "text.disabled" },
                            })}
                          >
                            <Radio
                              checked={isSelected}
                              onChange={() => { setPaymentMethod(opt.value); setStage("idle"); }}
                              size="small"
                              sx={{ p: 0 }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Box
                              sx={(theme) => ({
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 36,
                                height: 36,
                                borderRadius: 1.5,
                                bgcolor: isSelected
                                  ? alpha(theme.palette.primary.main, 0.12)
                                  : alpha(theme.palette.text.primary, 0.06),
                                color: isSelected ? "primary.main" : "text.secondary",
                                transition: "background-color 0.18s, color 0.18s",
                                flexShrink: 0,
                              })}
                            >
                              {opt.icon}
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography fontWeight={700}>{opt.label}</Typography>
                              <Typography variant="body2" color="text.secondary">{opt.detail}</Typography>
                            </Box>
                          </Box>
                        </motion.div>
                      );
                    })}
                  </Stack>

                  {/* MoMo inline fields */}
                  <AnimatePresence>
                    {paymentMethod === "momo" && stage === "idle" && (
                      <motion.div
                        key="momo-fields"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease }}
                      >
                        <Box
                          sx={{
                            display: "grid",
                            gap: 2,
                            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                            pt: 0.5,
                          }}
                        >
                          <TextField
                            label="MoMo phone number"
                            value={momoPhone}
                            onChange={(e) => setMomoPhone(e.target.value)}
                            placeholder="e.g. 0551234567"
                            required
                            slotProps={{ htmlInput: { inputMode: "tel" } }}
                          />
                          <FormControl required>
                            <InputLabel>Provider</InputLabel>
                            <Select
                              label="Provider"
                              value={momoProvider}
                              onChange={(e) => setMomoProvider(e.target.value as MomoProvider)}
                            >
                              <MenuItem value="mtn">MTN Mobile Money</MenuItem>
                              <MenuItem value="vod">Telecel Cash</MenuItem>
                              <MenuItem value="atl">AirtelTigo Money</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* OTP input */}
                  <AnimatePresence>
                    {stage === "otp_needed" && (
                      <motion.div
                        key="otp"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.22, ease }}
                      >
                        <Box
                          sx={(theme) => ({
                            p: 2,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            border: "1px solid",
                            borderColor: alpha(theme.palette.primary.main, 0.2),
                          })}
                        >
                          <Typography variant="body2" color="text.secondary" mb={1.5}>
                            {momoPrompt || "Enter the OTP sent to your MoMo number."}
                          </Typography>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <TextField
                              label="One-time password"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                              slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 8 } }}
                              size="small"
                              sx={{ flex: 1 }}
                              autoFocus
                            />
                            <Button
                              variant="contained"
                              onClick={handleOtpSubmit}
                              disabled={otp.length < 4 || submitting}
                              size="small"
                              sx={{ fontWeight: 700, flexShrink: 0, borderRadius: 999 }}
                            >
                              {submitting ? <CircularProgress size={16} color="inherit" /> : "Confirm"}
                            </Button>
                          </Stack>
                        </Box>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Polling indicator */}
                  <AnimatePresence>
                    {stage === "polling" && (
                      <motion.div
                        key="polling"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
                          <CircularProgress size={20} />
                          <Typography variant="body2" color="text.secondary">
                            Waiting for payment confirmation from your MoMo provider…
                          </Typography>
                        </Stack>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Stack>
              </Paper>
            </motion.div>
          </Stack>

          {/* ── Right column – order summary ── */}
          <motion.div custom={4} variants={sectionVariants} initial="hidden" animate="visible">
            <Paper
              elevation={0}
              sx={(theme) => ({
                position: { xl: "sticky" },
                top: { xl: 96 },
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
                backdropFilter: "blur(12px)",
                background:
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.background.paper, 0.82)
                    : alpha(theme.palette.background.paper, 0.9),
              })}
            >
              {/* Summary header strip */}
              <Box
                sx={(theme) => ({
                  px: { xs: 2, sm: 2.5 },
                  py: 2,
                  background: `linear-gradient(135deg,
                    ${alpha(theme.palette.primary.main, 0.1)} 0%,
                    ${alpha(theme.palette.primary.main, 0.03)} 100%
                  )`,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                })}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LocalShippingRounded color="primary" fontSize="small" />
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Order summary
                    </Typography>
                  </Stack>
                  <Chip
                    label={formatPrice(total)}
                    size="small"
                    color="primary"
                    sx={{ borderRadius: 999, fontWeight: 700 }}
                  />
                </Stack>
              </Box>

              <Stack sx={{ p: { xs: 2, sm: 2.5 } }} spacing={2.5}>
                {/* Items */}
                <AnimatePresence initial={false}>
                  {cart.items.length > 0 ? (
                    <Stack spacing={1.5}>
                      {cart.items.map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ delay: i * 0.04, duration: 0.3, ease }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography fontWeight={700} noWrap>{item.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Qty {item.quantity}
                                {item.color ? ` · ${item.color}` : ""}
                                {item.size ? ` · ${item.size}` : ""}
                              </Typography>
                            </Box>
                            <Typography fontWeight={700} sx={{ flexShrink: 0 }}>
                              {formatPrice(item.price * item.quantity)}
                            </Typography>
                          </Stack>
                        </motion.div>
                      ))}
                    </Stack>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        Your cart is empty. Add a product before completing checkout.
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Divider />

                {/* Price breakdown */}
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Subtotal</Typography>
                    <Typography fontWeight={600}>{formatPrice(cart.subtotal)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Delivery fee ({shippingMethod})</Typography>
                    <Typography fontWeight={600}>{formatPrice(shipping)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">
                      Processing fee ({(PROCESSING_FEE_RATE * 100).toFixed(1)}%)
                    </Typography>
                    <Typography fontWeight={600}>{formatPrice(cart.tax)}</Typography>
                  </Stack>
                </Stack>

                <Divider />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>Total</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{formatPrice(total)}</Typography>
                </Stack>

                {/* Inline error — visible without scrolling to top */}
                {submitError && (
                  <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ borderRadius: 2 }}>
                    {submitError}
                  </Alert>
                )}

                {/* Place order button — hidden during OTP / polling stages */}
                {(stage === "idle" || stage === "charging" || stage === "verifying") && (
                  <motion.div whileTap={canSubmit ? { scale: 0.97 } : undefined}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      endIcon={
                        submitting ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          <CreditCardRounded />
                        )
                      }
                      disabled={!canSubmit}
                      onClick={handleSubmit}
                      sx={{
                        borderRadius: 999,
                        py: 1.5,
                        textTransform: "none",
                        fontWeight: 900,
                        fontSize: "1rem",
                        boxShadow: "none",
                        "&:hover": { boxShadow: "none" },
                      }}
                    >
                      {buttonLabel}
                    </Button>
                  </motion.div>
                )}

                <Button
                  component={Link}
                  href="/cart"
                  variant="text"
                  fullWidth
                  sx={{
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 700,
                    color: "text.secondary",
                    mt: -1,
                  }}
                >
                  Back to cart
                </Button>

                {/* Trust signal */}
                <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
                  <LockOutlined sx={{ fontSize: 13, color: "text.disabled" }} />
                  <Typography variant="caption" color="text.disabled">
                    256-bit SSL · Secure checkout
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          </motion.div>
        </Box>
      </Stack>
    </Box>
  );
}
