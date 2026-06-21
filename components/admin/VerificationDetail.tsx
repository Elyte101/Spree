'use client';

import * as React from "react";
import Image from "next/image";
import {
  Alert,
  alpha,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckRounded,
  CloseRounded,
  DoNotDisturbRounded,
  ZoomInRounded,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import type { VerificationQueueItem } from "@/types/types";

interface VerificationDetailProps {
  seller: VerificationQueueItem;
  onDecision: (id: string, approved: boolean) => void;
  onClose: () => void;
}

interface DocumentUrls {
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
}

function DocumentImage({ url, label }: { url: string | null; label: string }) {
  const [zoom, setZoom] = React.useState(false);

  if (!url) {
    return (
      <Box>
        <Typography variant="caption" color="text.disabled" fontWeight={600} mb={0.5} display="block">
          {label}
        </Typography>
        <Box
          sx={{
            height: 140,
            borderRadius: 1.5,
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="caption" color="text.disabled">Not uploaded</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600} mb={0.5} display="block">
        {label}
      </Typography>
      <Box
        position="relative"
        sx={{
          height: 140,
          borderRadius: 1.5,
          overflow: "hidden",
          cursor: "zoom-in",
          "&:hover .zoom-overlay": { opacity: 1 },
        }}
        onClick={() => setZoom(true)}
      >
        <Image src={url} alt={label} fill style={{ objectFit: "cover" }} sizes="240px" />
        <Box
          className="zoom-overlay"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.15s",
          }}
        >
          <ZoomInRounded sx={{ color: "white", fontSize: 32 }} />
        </Box>
      </Box>

      {/* Full-screen zoom dialog */}
      <Dialog open={zoom} onClose={() => setZoom(false)} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: 0, position: "relative", bgcolor: "black" }}>
          <IconButton
            onClick={() => setZoom(false)}
            sx={{ position: "absolute", top: 8, right: 8, color: "white", zIndex: 1 }}
          >
            <CloseRounded />
          </IconButton>
          <Box sx={{ position: "relative", height: "80vh" }}>
            <Image src={url} alt={label} fill style={{ objectFit: "contain" }} />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export function VerificationDetail({ seller, onDecision, onClose }: VerificationDetailProps) {
  const [docs, setDocs] = React.useState<DocumentUrls | null>(null);
  const [docsLoading, setDocsLoading] = React.useState(true);
  const [docsError, setDocsError] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDocs(null);
    setDocsLoading(true);
    setDocsError(null);
    api.getSellerDocumentUrls(seller.id)
      .then((d) => setDocs(d))
      .catch((err) => setDocsError(err instanceof ApiClientError ? err.message : "Failed to load documents"))
      .finally(() => setDocsLoading(false));
  }, [seller.id]);

  async function handleApprove() {
    setActionLoading(true);
    setActionError(null);
    try {
      await api.approveSeller(seller.id);
      onDecision(seller.id, true);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Approval failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.rejectSeller(seller.id, { reason: rejectReason.trim() });
      onDecision(seller.id, false);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  }

  const location = [
    seller.storeLocation?.city,
    seller.storeLocation?.state,
    seller.storeLocation?.country,
  ].filter(Boolean).join(", ");

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      {/* Header */}
      <Box
        px={3}
        py={2.5}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.05) }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>{seller.name}</Typography>
          <Typography variant="body2" color="text.secondary">{seller.email}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseRounded />
        </IconButton>
      </Box>

      <Box p={3}>
        <Stack spacing={3}>
          {/* seller info */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              seller details
            </Typography>
            <Stack spacing={0.75}>
              <InfoRow label="Store name" value={seller.storeName || "—"} />
              <InfoRow label="seller type" value={seller.sellerType || "—"} />
              <InfoRow label="Location" value={location || "—"} />
              <InfoRow label="Phone" value={seller.phone || "—"} />
              <InfoRow label="Onboarding step" value={`${seller.onboardingStep} / 5`} />
            </Stack>
          </Box>

          <Divider />

          {/* Documents */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              Identity documents
            </Typography>
            {docsLoading ? (
              <Stack spacing={1}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} variant="rectangular" height={140} sx={{ borderRadius: 1.5 }} />
                ))}
              </Stack>
            ) : docsError ? (
              <Alert severity="error">{docsError}</Alert>
            ) : (
              <Stack spacing={1.5}>
                <DocumentImage url={docs?.idFrontUrl ?? null} label="ID — front" />
                <DocumentImage url={docs?.idBackUrl ?? null} label="ID — back" />
                <DocumentImage url={docs?.selfieUrl ?? null} label="Selfie with ID" />
              </Stack>
            )}
          </Box>

          <Divider />

          {/* Actions */}
          <Box>
            {actionError && (
              <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>
            )}

            {!showRejectForm ? (
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <CheckRounded />}
                  disabled={actionLoading || docsLoading}
                  onClick={handleApprove}
                >
                  Approve seller
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  startIcon={<DoNotDisturbRounded />}
                  disabled={actionLoading}
                  onClick={() => setShowRejectForm(true)}
                >
                  Reject application
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Reason for rejection
                </Typography>
                <TextField
                  multiline
                  minRows={3}
                  placeholder="Explain why this application is being rejected. This will be shown to the seller."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  fullWidth
                  required
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
                    disabled={actionLoading}
                    fullWidth
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleReject}
                    disabled={actionLoading || !rejectReason.trim()}
                    startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <DoNotDisturbRounded />}
                    fullWidth
                  >
                    Confirm rejection
                  </Button>
                </Stack>
              </Stack>
            )}
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}
