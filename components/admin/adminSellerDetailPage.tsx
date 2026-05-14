'use client';

import * as React from "react";
import Link from "next/link";
import {
  Alert,
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

interface AdminSellerDetailPageProps {
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
  retail: "Retail seller",
  wholesale: "Wholesale seller",
};

const formatDeliverySpeed = (value?: number | null) =>
  value === null || value === undefined ? "Not tracked" : `${value.toFixed(1)} days average`;

const formatStoreLocation = (seller: AdminSellerDetail) =>
  [
    seller.storeLocation.city,
    seller.storeLocation.state,
    seller.storeLocation.country,
  ].filter(Boolean).join(", ") || "Location not provided";

export function AdminSellerDetailPage({
  initialSeller,
}: AdminSellerDetailPageProps) {
  const [seller, setSeller] = React.useState(initialSeller);
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
      const updated = await api.updateAdminSellerStatus(seller.id, {
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
      setMessage("Seller status saved.");
    } catch (saveError) {
      setError(
        saveError instanceof ApiClientError
          ? saveError.message
          : "We couldn't update this seller right now."
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
            <Chip label="Seller profile" color="primary" sx={{ mb: 1.5, borderRadius: 999 }} />
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              {seller.storeName}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip label={sellerTypeLabels[seller.sellerType]} variant="outlined" />
              {seller.sellerBadge ? (
                <Chip label={seller.sellerBadge} color="success" variant="outlined" />
              ) : null}
            </Stack>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {seller.storeDescription}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              component={Link}
              href={`/stores/${seller.storeSlug}`}
              variant="outlined"
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
            >
              Open public store
            </Button>
            <Button
              component={Link}
              href="/dashboard/sellers"
              variant="text"
              sx={{ textTransform: "none", fontWeight: 800 }}
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
          { label: "Followers", value: seller.followerCount },
          { label: "Recorded purchases", value: seller.purchaseCount },
          { label: "Products", value: seller.productCount },
          { label: "Completed deliveries", value: seller.completedDeliveries },
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
                Seller details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Name: {seller.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Email: {seller.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Phone: {seller.phone || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Seller type: {sellerTypeLabels[seller.sellerType]}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Store location: {formatStoreLocation(seller)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Store address: {seller.storeLocation.addressLine1 || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Business email: {seller.sellerContact.businessEmail || seller.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Business phone: {seller.sellerContact.businessPhone || seller.phone || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registration: {seller.sellerContact.registrationNumber || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Government ID: {seller.governmentIdType} {seller.governmentIdNumber || "Not provided"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Verification: {seller.governmentIdVerified ? "Verified" : "Pending review"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Selling since: {formatDate(seller.startedAt)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Delivery speed: {formatDeliverySpeed(seller.averageDeliveryDays)}
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
              {seller.reports.length ? (
                seller.reports.map((report) => (
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
                  No buyer reports on this seller yet.
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
                label="Seller status"
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
                label="Verify seller identity"
              />
              <TextField
                label="Public seller badge"
                value={sellerBadge}
                onChange={(event) => setSellerBadge(event.target.value)}
                helperText="Examples: Verified seller, Fast delivery, Trusted seller"
              />
              <TextField
                label="Completed deliveries"
                type="number"
                value={completedDeliveries}
                onChange={(event) => setCompletedDeliveries(event.target.value)}
                inputProps={{ min: 0, step: 1 }}
              />
              <TextField
                label="Average delivery days"
                type="number"
                value={averageDeliveryDays}
                onChange={(event) => setAverageDeliveryDays(event.target.value)}
                inputProps={{ min: 0, step: 0.1 }}
              />
              <TextField
                label="Seller notice"
                value={sellerNotice}
                onChange={(event) => setSellerNotice(event.target.value)}
                multiline
                minRows={3}
                helperText="Visible to the seller on their profile."
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
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
              >
                {saving ? "Saving..." : "Save status"}
              </Button>
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
                Shipping: {seller.shippingAddress.addressLine1 || "Not configured"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Payment method: {seller.paymentInfo.method}
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}
