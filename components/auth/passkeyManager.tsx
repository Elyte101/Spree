"use client";

import * as React from "react";
import {
  DeleteOutlineRounded,
  FingerprintRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

interface PasskeyCredential {
  id: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Best-effort label for a newly-registered credential — WebAuthn doesn't
// hand back a human-readable authenticator name, so this is just a
// reasonable default the user can't currently rename after the fact.
function guessDeviceName() {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad passkey";
  if (/android/i.test(ua)) return "Android passkey";
  if (/mac os x/i.test(ua)) return "Mac passkey";
  if (/windows/i.test(ua)) return "Windows passkey";
  return "Passkey";
}

export function PasskeyManager() {
  const [credentials, setCredentials] = React.useState<PasskeyCredential[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadCredentials = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/webauthn/credentials");
      if (!res.ok) {
        setLoadError("Couldn't load your passkeys. Please refresh the page.");
        return;
      }
      setCredentials(await res.json());
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load your passkeys. Please refresh the page.");
    }
  }, []);

  React.useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const handleAdd = async () => {
    setError(null);
    setAdding(true);
    try {
      const optionsRes = await fetch("/api/auth/webauthn/register/options", { method: "POST" });
      if (!optionsRes.ok) {
        setError("Couldn't start passkey registration. Please try again.");
        return;
      }
      const { options, challengeId } = await optionsRes.json();

      const { startRegistration } = await import("@simplewebauthn/browser");
      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          credential: attestation,
          deviceName: guessDeviceName(),
        }),
      });
      if (!verifyRes.ok) {
        setError(
          verifyRes.status === 409
            ? "That passkey is already registered."
            : "That passkey couldn't be saved. Please try again."
        );
        return;
      }
      await loadCredentials();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setError("Passkey registration didn't work. Please try again.");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/auth/webauthn/credentials/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't remove that passkey. Please try again.");
        return;
      }
      setCredentials((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    } catch {
      setError("Couldn't remove that passkey. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <FingerprintRounded color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Passkeys
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Sign in without a password using your device&apos;s fingerprint, face, or screen lock.
      </Typography>

      {loadError && <Alert severity="error">{loadError}</Alert>}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {credentials === null && !loadError ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      ) : credentials && credentials.length > 0 ? (
        <Stack spacing={1}>
          {credentials.map((cred) => (
            <Stack
              key={cred.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                py: 1,
                px: 1.5,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {cred.deviceName || "Passkey"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Added {formatDate(cred.createdAt)}
                  {cred.lastUsedAt ? ` · Last used ${formatDate(cred.lastUsedAt)}` : ""}
                </Typography>
              </Box>
              <IconButton
                aria-label="Remove passkey"
                size="small"
                disabled={deletingId === cred.id}
                onClick={() => void handleDelete(cred.id)}
              >
                {deletingId === cred.id ? (
                  <CircularProgress size={16} />
                ) : (
                  <DeleteOutlineRounded fontSize="small" />
                )}
              </IconButton>
            </Stack>
          ))}
        </Stack>
      ) : (
        credentials && (
          <Typography variant="body2" color="text.secondary">
            No passkeys added yet.
          </Typography>
        )
      )}

      <Button
        type="button"
        variant="outlined"
        startIcon={adding ? <CircularProgress size={16} /> : <FingerprintRounded />}
        disabled={adding}
        onClick={() => void handleAdd()}
        sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900, alignSelf: "flex-start" }}
      >
        {adding ? "Waiting for device…" : "Add a passkey"}
      </Button>
    </Stack>
  );
}
