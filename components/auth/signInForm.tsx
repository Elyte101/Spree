'use client';

import * as React from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import {
  Alert,
  alpha,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  FingerprintRounded,
  LockOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import { useThemeContext } from "@/theme/themeContext";

interface SignInFormProps {
  callbackUrl: string;
  reason?: "seller";
  currentUserEmail?: string;
  currentUserRole?: string;
}

function getLocalRedirectTarget(callbackUrl: string) {
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return "/profile";
  return callbackUrl;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h13.2c-.6 3-2.3 5.6-4.9 7.3v6h7.9c4.6-4.2 7.3-10.5 7.3-17.5z"/>
      <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.9-6c-2.2 1.5-5 2.3-8.1 2.3-6.2 0-11.5-4.2-13.4-9.9H2.4v6.2C6.4 42.5 14.7 48 24 48z"/>
      <path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6v-6.2H2.4A24 24 0 0 0 0 24c0 3.9.9 7.6 2.4 10.8l8.2-6.2z"/>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.9 2.4 30.4 0 24 0 14.7 0 6.4 5.5 2.4 13.2l8.2 6.2C12.5 13.7 17.8 9.5 24 9.5z"/>
    </svg>
  );
}

function AppleIcon({ mode }: { mode: "light" | "dark" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" fill={mode === "dark" ? "#fff" : "#000"}>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.3-150.3-109.2c-52-75.3-91.8-192-91.8-302.8 0-179.8 117.9-275 233.7-275 61.9 0 113.4 40.8 152.5 40.8 37.3 0 96-43.1 165.4-43.1 26.4 0 107.6 2.3 161.9 96.3zM548.2 113.1C577 78.1 597.9 29.7 597.9 0c0-7.7-.6-15.5-2-22.5-55.5 2.1-121.5 37-161.3 79.1-27.7 29.7-52.4 78-52.4 127.4 0 8.3 1.4 16.6 2 19.3 3.2.6 8.3 1.4 13.4 1.4 50.1 0 112.3-33.2 150.6-91.6z"/>
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  required?: boolean;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <TextField
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      required={required}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
                edge="end"
                size="small"
              >
                {show ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

export function SignInForm({
  callbackUrl,
  reason,
  currentUserEmail,
  currentUserRole,
}: SignInFormProps) {
  const redirectTarget = getLocalRedirectTarget(callbackUrl);
  const { mode } = useThemeContext();
  const { update: updateSession } = useSession();

  const [tab, setTab] = React.useState<"signin" | "signup">("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [socialLoading, setSocialLoading] = React.useState<"google" | "apple" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const isSellerRestricted =
    reason === "seller" &&
    currentUserRole !== undefined &&
    currentUserRole !== "seller" &&
    currentUserRole !== "admin";

  const handleSocialSignIn = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    try {
      await signIn(provider, { callbackUrl: redirectTarget });
    } catch {
      setError("Social sign-in failed. Please try again.");
      setSocialLoading(null);
    }
  };

  const handlePasskey = () => {
    setInfo("Passkey login is coming soon — stay tuned!");
    setTimeout(() => setInfo(null), 4000);
  };

  const handleAccountSwitch = async () => {
    setSubmitting(true);
    await signOut({
      callbackUrl: `/auth/sign-in?callbackUrl=${encodeURIComponent(redirectTarget)}&reason=seller`,
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (tab === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setSubmitting(false);
        return;
      }

      try {
        await api.signUp({ name, email, password });
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "We couldn't create your account. Please try again."
        );
        setSubmitting(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: redirectTarget,
      redirect: false,
    });

    setSubmitting(false);

    if (!result) {
      setError("Sign-in failed. Please try again.");
      return;
    }

    if (result.error) {
      if (result.error === "rate_limited") {
        setError("Too many attempts. Please wait 15 minutes before trying again.");
      } else {
        setError(
          tab === "signup"
            ? "Account created — but automatic sign-in failed. Please sign in manually."
            : "Invalid email or password."
        );
      }
      return;
    }

    window.location.assign(redirectTarget);
  };

  const socialBtnSx = {
    borderRadius: 999,
    textTransform: "none" as const,
    fontWeight: 600,
    py: 1.1,
    gap: 1,
    borderColor: "divider",
    color: "text.primary",
    "&:hover": { borderColor: "primary.main", bgcolor: alpha("#655AFF", 0.04) },
  };

  return (
    <Box
      component="main"
      sx={(theme) => ({
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: { xs: 2, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(ellipse at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.16 : 0.08
        )} 0%, transparent 50%), radial-gradient(ellipse at bottom right, ${alpha(
          theme.palette.secondary.main,
          theme.palette.mode === "dark" ? 0.10 : 0.05
        )} 0%, transparent 50%), ${theme.palette.background.default}`,
      })}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 460,
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={3}>
          {/* Header */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  bgcolor: "#F5F4FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LockOutlined sx={{ fontSize: 18, color: "primary.main" }} />
              </Box>
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Secure Sign In
              </Typography>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.025em" }}>
              {tab === "signin" ? "Welcome back." : "Create account."}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {tab === "signin"
                ? "Sign in to access your orders, saved details, and store information."
                : "Join Spree as a buyer. Upgrade to seller anytime with a government ID."}
            </Typography>
          </Box>

          {/* Tab switcher */}
          <Stack
            direction="row"
            sx={(theme) => ({
              bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              borderRadius: 999,
              p: "3px",
            })}
          >
            {(["signin", "signup"] as const).map((t) => (
              <Button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                variant="text"
                sx={{
                  flex: 1,
                  borderRadius: 999,
                  fontWeight: 700,
                  textTransform: "none",
                  py: 0.75,
                  fontSize: "0.875rem",
                  bgcolor: tab === t ? "background.paper" : "transparent",
                  color: tab === t ? "text.primary" : "text.secondary",
                  boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  "&:hover": { bgcolor: tab === t ? "background.paper" : "transparent" },
                }}
              >
                {t === "signin" ? "Sign in" : "Sign up"}
              </Button>
            ))}
          </Stack>

          {/* seller restriction warning */}
          {reason === "seller" && (
            <Alert severity={isSellerRestricted ? "warning" : "info"}>
              {isSellerRestricted
                ? `Signed in as ${currentUserEmail ?? "another user"}. Use a seller or admin account to continue.`
                : "Sign in with a seller or admin account to manage the store."}
            </Alert>
          )}

          {/* Error / info messages */}
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {info && <Alert severity="info" onClose={() => setInfo(null)}>{info}</Alert>}

          {/* Social sign-in */}
          <Stack spacing={1.25}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => handleSocialSignIn("google")}
              disabled={!!socialLoading || submitting}
              startIcon={socialLoading === "google" ? <CircularProgress size={16} /> : <GoogleIcon />}
              sx={socialBtnSx}
            >
              Continue with Google
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => handleSocialSignIn("apple")}
              disabled={!!socialLoading || submitting}
              startIcon={socialLoading === "apple" ? <CircularProgress size={16} /> : <AppleIcon mode={mode} />}
              sx={socialBtnSx}
            >
              Continue with Apple
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={handlePasskey}
              disabled={!!socialLoading || submitting}
              startIcon={<FingerprintRounded />}
              sx={{ ...socialBtnSx, color: "primary.main", borderColor: "primary.main" }}
            >
              Use Passkey
            </Button>
          </Stack>

          <Divider sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
            or continue with email
          </Divider>

          {/* Email/password form */}
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            {tab === "signup" && (
              <TextField
                label="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            )}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
              required
            />
            {tab === "signup" && (
              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                required
              />
            )}
            {tab === "signup" && (
              <Typography variant="caption" color="text.secondary">
                Password must be 8+ characters with uppercase, lowercase, number, and symbol.
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting || !!socialLoading}
              sx={{ borderRadius: 999, fontWeight: 800, py: 1.3 }}
            >
              {submitting
                ? tab === "signin" ? "Signing in…" : "Creating account…"
                : tab === "signin" ? "Sign in" : "Create account"}
            </Button>
          </Stack>

          {/* Footer links */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button
              component={Link}
              href="/"
              variant="text"
              size="small"
              sx={{ textTransform: "none", fontWeight: 700, color: "primary.main" }}
            >
              Back to storefront
            </Button>
            {isSellerRestricted && (
              <Button
                variant="text"
                size="small"
                disabled={submitting}
                onClick={handleAccountSwitch}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Switch account
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
