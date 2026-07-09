'use client';

import * as React from "react";
import Link from "next/link";
import {
  alpha,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { MailOutlineRounded } from "@mui/icons-material";

import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await api.requestPasswordReset(email);
    } catch {
      // Intentionally ignored — the backend always returns a generic
      // success response regardless of whether the email has an account,
      // so there is nothing meaningfully different to show on failure.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 4,
        background: `radial-gradient(ellipse at top, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.14 : 0.07
        )}, transparent 60%), ${theme.palette.background.default}`,
      })}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 400,
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {submitted ? (
          <Stack spacing={2.5} alignItems="center" textAlign="center">
            <MailOutlineRounded sx={{ fontSize: 56, color: "primary.main" }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Check your email
            </Typography>
            <Typography variant="body2" color="text.secondary">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to
              reset your password. The link expires in 1 hour.
            </Typography>
            <Button
              component={Link}
              href="/auth/sign-in"
              variant="contained"
              sx={{ borderRadius: 999, fontWeight: 700, textTransform: "none" }}
            >
              Back to sign in
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            <Stack spacing={0.5}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Forgot your password?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter the email address on your account and we&apos;ll send you a link to
                reset your password.
              </Typography>
            </Stack>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting || !email}
              sx={{ borderRadius: 999, fontWeight: 800, py: 1.3 }}
            >
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
            <Button
              component={Link}
              href="/auth/sign-in"
              variant="text"
              size="small"
              sx={{ textTransform: "none", fontWeight: 700, alignSelf: "center" }}
            >
              Back to sign in
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
