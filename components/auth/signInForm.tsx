'use client';

import * as React from "react";
import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { LockOutlined } from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";

interface SignInFormProps {
  callbackUrl: string;
  reason?: "seller";
  currentUserEmail?: string;
  currentUserRole?: string;
}

function getLocalRedirectTarget(callbackUrl: string) {
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/profile";
  }

  return callbackUrl;
}

export function SignInForm({
  callbackUrl,
  reason,
  currentUserEmail,
  currentUserRole,
}: SignInFormProps) {
  const redirectTarget = getLocalRedirectTarget(callbackUrl);
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isSellerRestricted =
    reason === "seller" &&
    currentUserRole !== undefined &&
    currentUserRole !== "seller" &&
    currentUserRole !== "admin";

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

    try {
      if (mode === "signup") {
        await api.signUp({
          name,
          email,
          password,
        });
      }
    } catch (signupError) {
      setSubmitting(false);
      setError(
        signupError instanceof ApiClientError
          ? signupError.message
          : "We couldn’t create your account. Please try again."
      );
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: redirectTarget,
      redirect: false,
    });

    setSubmitting(false);

    if (!result) {
      setError("We couldn't start the sign-in flow. Please try again.");
      return;
    }

    if (result.error) {
      setError(
        mode === "signup"
          ? "Your account was created, but the automatic sign-in failed. Please sign in manually."
          : "Invalid email or password."
      );
      return;
    }

    window.location.assign(redirectTarget);
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
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.18 : 0.1
        )}, transparent 24%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 480,
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={2.5}>
          <Box>
            <Chip
              icon={<LockOutlined />}
              label="Secure Sign In"
              color="primary"
              sx={{ mb: 1.5, borderRadius: 999 }}
            />
            <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
              {mode === "signin" ? "Welcome back." : "Create your account."}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {mode === "signin"
                ? "Sign in to see your account, saved details, and store information."
                : "Create an account to save your details and make shopping easier next time."}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant={mode === "signin" ? "contained" : "outlined"}
              onClick={() => setMode("signin")}
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
            >
              Sign in
            </Button>
            <Button
              variant={mode === "signup" ? "contained" : "outlined"}
              onClick={() => setMode("signup")}
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
            >
              Sign up
            </Button>
          </Stack>

          {mode === "signin" ? (
            <Alert severity="info">
              Enter the email address and password for your account.
            </Alert>
          ) : (
            <Alert severity="info">
              Choose a password with uppercase, lowercase, a number, and a symbol.
            </Alert>
          )}

          {reason === "seller" ? (
            <Alert severity={isSellerRestricted ? "warning" : "info"}>
              {isSellerRestricted
                ? `You are signed in as ${currentUserEmail ?? "another user"}. Please use an account with access to manage the shop to continue.`
                : "Sign in with an account that can manage the shop to continue."}
            </Alert>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <TextField
                label="Full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            ) : null}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800, py: 1.2 }}
            >
              {submitting
                ? mode === "signin"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </Stack>

          <Button
            component={Link}
            href="/"
            variant="text"
            sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 700 }}
          >
            Back to storefront
          </Button>

          {isSellerRestricted ? (
            <Button
              type="button"
              variant="outlined"
              disabled={submitting}
              onClick={handleAccountSwitch}
              sx={{ alignSelf: "flex-start", borderRadius: 999, textTransform: "none", fontWeight: 700 }}
            >
              Sign out and switch account
            </Button>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
