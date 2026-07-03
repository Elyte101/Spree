'use client';

import * as React from "react";
import Link from "next/link";
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { api, ApiClientError } from "@/lib/api";
import { AdminSellerDetail, SellerStatus } from "@/types/types";

interface AdminVendorDetailPageProps {
  initialSeller: AdminSellerDetail;
}

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Not yet started";

const sellerTypeLabels: Record<AdminSellerDetail["sellerType"], string> = {
  retail: "Retail vendor",
  wholesale: "Wholesale vendor",
};

const formatDeliverySpeed = (value?: number | null) =>
  value === null || value === undefined ? "Not tracked" : `${value.toFixed(1)} days average`;

const formatStoreLocation = (vendor: AdminSellerDetail) =>
  [
    vendor.storeLocation.city,
    vendor.storeLocation.state,
    vendor.storeLocation.country,
  ].filter(Boolean).join(", ") || "Location not provided";

export function AdminVendorDetailPage({
  initialSeller,
}: AdminVendorDetailPageProps) {
  const [vendor, setSeller] = React.useState(initialSeller);
  const [status, setStatus] = React.useState<Extract<SellerStatus, "pending" | "active" | "suspended" | "removed">>(
    (initialSeller.sellerStatus === "buyer" ? "active" : initialSeller.sellerStatus) as Extract<
      SellerStatus,
      "pending" | "active" | "suspended" | "removed"
    >
  );
  const [sellerNotice, setSellerNotice] = React.useState(initialSeller.sellerNotice);
  const [adminNote, setAdminNote] = React.useState(initialSeller.adminNote);
  const [sellerBadge, setSellerBadge] = React.useState(initialSeller.sellerBadge);
  const [completedDeliveries, setCompletedDeliveries] = React.useState(
    String(initialSeller.completedDeliveries ?? 0)
  );
  const [averageDeliveryDays, setAverageDeliveryDays] = React.useState(
    initialSeller.averageDeliveryDays === null || initialSeller.averageDeliveryDays === undefined
      ? ""
      : String(initialSeller.averageDeliveryDays)
  );
  const [governmentIdVerified, setGovernmentIdVerified] = React.useState(
    initialSeller.governmentIdVerified
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const updated = await api.updateAdminSellerStatus(vendor.id, {
        status,
        sellerNotice,
        adminNote,
        sellerBadge,
        completedDeliveries: Number(completedDeliveries) || 0,
        averageDeliveryDays: averageDeliveryDays.trim() ? Number(averageDeliveryDays) : null,
        governmentIdVerified,
      });
      setSeller(updated);
      setStatus(updated.sellerStatus as Extract<SellerStatus, "pending" | "active" | "suspended" | "removed">);
      setSellerNotice(updated.sellerNotice);
      setAdminNote(updated.adminNote);
      setSellerBadge(updated.sellerBadge);
      setCompletedDeliveries(String(updated.completedDeliveries ?? 0));
      setAverageDeliveryDays(
        updated.averageDeliveryDays === null || updated.averageDeliveryDays === undefined
          ? ""
          : String(updated.averageDeliveryDays)
      );
      setGovernmentIdVerified(updated.governmentIdVerified);
      setMessage("vendor status saved.");
    } catch (saveError) {
      setError(
        saveError instanceof ApiClientError
          ? saveError.message
          : "We couldn't update this vendor right now."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", xl: "row" }}
          justifyContent="space-between"
          spacing={2.5}
          alignItems={{ xs: "flex-start", xl: "center" }}
        >
          <Box>
            <Chip label="vendor profile" color="primary" sx={{ mb: 1.5, borderRadius: 999 }} />
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              {vendor.storeName}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip label={sellerTypeLabels[vendor.sellerType]} variant="outlined" />
              {vendor.sellerBadge ? (
                <Chip label={vendor.sellerBadge} color="success" variant="outlined" />
              ) : null}
            </Stack>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {vendor.storeDescription}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              component={Link}
              href={`/stores/${vendor.storeSlug}`}
              variant="outlined"
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
            >
              Open public store
            </Button>
            <Button
              component={Link}
              href="/dashboard/vendors"
              variant="text"
              sx={{ textTransform: "none", fontWeight: 900 }}
            >
              Back to sellers
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {[
          { label: "Followers", value: vendor.followerCount },
          { label: "Recorded purchases", value: vendor.purchaseCount },
          { label: "Products", value: vendor.productCount },
          { label: "Completed deliveries", value: vendor.completedDeliveries },
        ].map((item) => (
          <Paper
            key={item.label}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.75, fontWeight: 900 }}>
              {item.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.1fr) 360px" },
          alignItems: "start",
        }}
      >
        <Stack spacing={3}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                vendor details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Name: {vendor.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Email: {vendor.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Phone: {vendor.phone || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                vendor type: {sellerTypeLabels[vendor.sellerType]}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Store location: {formatStoreLocation(vendor)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Store address: {vendor.storeLocation.addressLine1 || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Business email: {vendor.sellerContact.businessEmail || vendor.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Business phone: {vendor.sellerContact.businessPhone || vendor.phone || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registration: {vendor.sellerContact.registrationNumber || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Government ID: {vendor.governmentIdType} {vendor.governmentIdNumber || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Verification: {vendor.governmentIdVerified ? "Verified" : "Pending review"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Selling since: {formatDate(vendor.startedAt)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Delivery speed: {formatDeliverySpeed(vendor.averageDeliveryDays)}
              </Typography>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Reports from buyers
              </Typography>
              {vendor.reports.length ? (
                vendor.reports.map((report) => (
                  <Paper
                    key={report.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Chip label={report.reason} size="small" />
                        <Chip label={formatDate(report.createdAt)} size="small" variant="outlined" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Reported by {report.reporterName}
                      </Typography>
                      <Typography variant="body2">
                        {report.details || "No additional details were provided."}
                      </Typography>
                    </Stack>
                  </Paper>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No buyer reports on this vendor yet.
                </Typography>
              )}
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={3}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Admin controls
              </Typography>
              <TextField
                select
                label="vendor status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as Extract<SellerStatus, "pending" | "active" | "suspended" | "removed">
                  )
                }
              >
                <MenuItem value="pending">Pending review</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
                <MenuItem value="removed">Removed</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={governmentIdVerified}
                    onChange={(event) => setGovernmentIdVerified(event.target.checked)}
                  />
                }
                label="Verify vendor identity"
              />
              <TextField
                label="Public vendor badge"
                value={sellerBadge}
                onChange={(event) => setSellerBadge(event.target.value)}
                helperText="Examples: Verified vendor, Fast delivery, Trusted vendor"
              />
              <TextField
                label="Completed deliveries"
                type="number"
                value={completedDeliveries}
                onChange={(event) => setCompletedDeliveries(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
              <TextField
                label="Average delivery days"
                type="number"
                value={averageDeliveryDays}
                onChange={(event) => setAverageDeliveryDays(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              />
              <TextField
                label="vendor notice"
                value={sellerNotice}
                onChange={(event) => setSellerNotice(event.target.value)}
                multiline
                minRows={3}
                helperText="Visible to the vendor on their profile."
              />
              <TextField
                label="Admin note"
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                multiline
                minRows={4}
                helperText="Private context for the admin team."
              />
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
              >
                {saving ? "Saving..." : "Save status"}
              </Button>
            </Stack>
          </Paper>

          {/* ID Document Review */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Identity documents
                </Typography>
                <Chip
                  label={vendor.governmentIdVerified ? "Verified" : "Pending review"}
                  color={vendor.governmentIdVerified ? "success" : "warning"}
                  size="small"
                />
              </Stack>

              {vendor.niaVerifiedAt ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={0.5}>
                    NIA face match passed on{" "}
                    {new Date(vendor.niaVerifiedAt).toLocaleString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </Typography>
                  {vendor.niaMatchConfidence != null && (
                    <Typography variant="body2" color="text.secondary">
                      Match confidence:{" "}
                      <strong>{Math.round(vendor.niaMatchConfidence * 100)}%</strong>
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Identity not yet verified via NIA face match.
                </Typography>
              )}

              <Typography variant="caption" color="text.secondary">
                Identity is verified automatically when the seller passes the live face match.
                Use Admin controls below to manually override if needed.
              </Typography>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Fulfillment references
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Shipping: {vendor.shippingAddress.addressLine1 || "Not configured"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Payment method: {vendor.paymentInfo.method}
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}
