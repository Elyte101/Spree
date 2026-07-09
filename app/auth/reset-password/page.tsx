'use client';

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlined,
  ErrorOutlineRounded,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  if (!token) {
    return (
      <Stack spacing={2.5} alignItems="center" textAlign="center">
        <ErrorOutlineRounded sx={{ fontSize: 56, color: "error.main" }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Invalid link
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No reset token found in the link. Please request a new one.
        </Typography>
        <Button
          component={Link}
          href="/auth/forgot-password"
          variant="contained"
          sx={{ borderRadius: 999, fontWeight: 700, textTransform: "none" }}
        >
          Request a new link
        </Button>
      </Stack>
    );
  }

  if (success) {
    return (
      <Stack spacing={2.5} alignItems="center" textAlign="center">
        <CheckCircleOutlined sx={{ fontSize: 56, color: "success.main" }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Password reset
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your password has been reset. Please sign in with your new password.
        </Typography>
        <Button
          component={Link}
          href="/auth/sign-in"
          variant="contained"
          sx={{ borderRadius: 999, fontWeight: 700, textTransform: "none" }}
        >
          Sign in
        </Button>
      </Stack>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.confirmPasswordReset(token, password);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "This link is invalid or has expired. Please request a new one."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Set a new password
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose a new password for your account.
        </Typography>
      </Stack>
      {error && (
        <Typography variant="body2" color="error.main">
          {error}
        </Typography>
      )}
      <TextField
        label="New password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        autoFocus
        required
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                  {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        label="Confirm new password"
        type={showPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        required
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={submitting || !password || !confirmPassword}
        sx={{ borderRadius: 999, fontWeight: 800, py: 1.3 }}
      >
        {submitting ? "Resetting…" : "Reset password"}
      </Button>
    </Stack>
  );
}

export default function ResetPasswordPage() {
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
        <React.Suspense fallback={<CircularProgress size={48} />}>
          <ResetPasswordContent />
        </React.Suspense>
      </Paper>
    </Box>
  );
}
