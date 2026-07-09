'use client';

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { CheckCircleOutlined, ErrorOutlineRounded } from "@mui/icons-material";

type State = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = React.useState<State>("verifying");
  const [message, setMessage] = React.useState("");
  const { update: updateSession } = useSession();

  React.useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No verification token found in the link.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        const data = await res.json();
        if (res.ok) {
          setState("success");
          setMessage("Your email has been verified. You're all set!");
          // A8: refresh the current session's emailVerified flag (if signed
          // in) so the user doesn't need to fully re-login for it to take
          // effect — see the jwt callback's trigger === "update" handling.
          void updateSession();
        } else {
          setState("error");
          setMessage((data as { detail?: string }).detail ?? "This link is invalid or has expired.");
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Verification failed. Please try again.");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [token, updateSession]);

  const icon =
    state === "verifying" ? (
      <CircularProgress size={48} />
    ) : state === "success" ? (
      <CheckCircleOutlined sx={{ fontSize: 56, color: "success.main" }} />
    ) : (
      <ErrorOutlineRounded sx={{ fontSize: 56, color: "error.main" }} />
    );

  const heading =
    state === "verifying"
      ? "Verifying your email…"
      : state === "success"
      ? "Email verified!"
      : "Verification failed";

  return (
    <Stack spacing={2.5} alignItems="center">
      {icon}
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        {heading}
      </Typography>
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
      {state !== "verifying" && (
        <Button
          component={Link}
          href={state === "success" ? "/profile" : "/auth/sign-in"}
          variant="contained"
          sx={{ borderRadius: 999, fontWeight: 700, textTransform: "none" }}
        >
          {state === "success" ? "Go to your profile" : "Back to sign in"}
        </Button>
      )}
    </Stack>
  );
}

export default function VerifyEmailPage() {
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
          textAlign: "center",
        }}
      >
        <React.Suspense fallback={<CircularProgress size={48} />}>
          <VerifyEmailContent />
        </React.Suspense>
      </Paper>
    </Box>
  );
}
