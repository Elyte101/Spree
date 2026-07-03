'use client';

import * as React from "react";
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckRounded,
  CloseRounded,
  DoNotDisturbRounded,
  FaceRounded,
  VerifiedUserRounded,
  WarningAmberRounded,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import type { VerificationQueueItem } from "@/types/types";

interface VerificationDetailProps {
  vendor: VerificationQueueItem;
  onDecision: (id: string, approved: boolean) => void;
  onClose: () => void;
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.85 ? "success" : score >= 0.6 ? "warning" : "error";
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.5}>
        <Typography variant="caption" color="text.secondary">Face match confidence</Typography>
        <Typography variant="caption" fontWeight={700} color={`${color}.main`}>{pct}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}

export function VerificationDetail({ vendor, onDecision, onClose }: VerificationDetailProps) {
  const [rejectReason, setRejectReason] = React.useState("");
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  async function handleApprove() {
    setActionLoading(true);
    setActionError(null);
    try {
      await api.approveSeller(vendor.id);
      onDecision(vendor.id, true);
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
      await api.rejectSeller(vendor.id, { reason: rejectReason.trim() });
      onDecision(vendor.id, false);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  }

  const location = [
    vendor.storeLocation?.city,
    vendor.storeLocation?.state,
    vendor.storeLocation?.country,
  ].filter(Boolean).join(", ");

  const niaVerified = vendor.governmentIdVerified === true;
  const confidence = vendor.niaMatchConfidence ?? null;
  const verifiedAt = vendor.niaVerifiedAt
    ? new Date(vendor.niaVerifiedAt).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

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
          <Typography variant="h6" fontWeight={700}>{vendor.name}</Typography>
          <Typography variant="body2" color="text.secondary">{vendor.email}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseRounded />
        </IconButton>
      </Box>

      <Box p={3}>
        <Stack spacing={3}>
          {/* Vendor info */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              Vendor details
            </Typography>
            <Stack spacing={0.75}>
              <InfoRow label="Store name" value={vendor.storeName || "—"} />
              <InfoRow label="Vendor type" value={vendor.sellerType || "—"} />
              <InfoRow label="Location" value={location || "—"} />
              <InfoRow label="Phone" value={vendor.phone || "—"} />
              <InfoRow label="Onboarding step" value={`${vendor.onboardingStep} / 5`} />
            </Stack>
          </Box>

          <Divider />

          {/* NIA Identity verification */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                Identity verification
              </Typography>
              {niaVerified ? (
                <Chip
                  label="NIA verified"
                  color="success"
                  size="small"
                  icon={<VerifiedUserRounded />}
                />
              ) : (
                <Chip
                  label="Not verified"
                  color="warning"
                  size="small"
                  icon={<WarningAmberRounded />}
                />
              )}
            </Stack>

            {niaVerified ? (
              <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "success.light" }}>
                <CardContent sx={{ pb: "16px !important" }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FaceRounded sx={{ color: "success.main", fontSize: 20 }} />
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        Face match passed automatically
                      </Typography>
                    </Stack>

                    {vendor.governmentIdNumber && (
                      <InfoRow label="Ghana Card no." value={vendor.governmentIdNumber} />
                    )}

                    {verifiedAt && (
                      <InfoRow label="Verified at" value={verifiedAt} />
                    )}

                    {confidence !== null && (
                      <Box mt={0.5}>
                        <ConfidenceBar score={confidence} />
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                This seller has not completed face verification yet.
                {vendor.governmentIdNumber && (
                  <Box mt={0.5}>
                    <Typography variant="caption">
                      Ghana Card on file: <strong>{vendor.governmentIdNumber}</strong>
                    </Typography>
                  </Box>
                )}
              </Alert>
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
                  disabled={actionLoading}
                  onClick={handleApprove}
                >
                  Approve vendor
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
                  placeholder="Explain why this application is being rejected. This will be shown to the vendor."
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
