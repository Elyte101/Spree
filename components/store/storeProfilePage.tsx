'use client';

import * as React from "react";
import Link from "next/link";
import {
  FlagRounded,
  GroupRounded,
  ReportRounded,
  StorefrontRounded,
  VerifiedRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useSession } from "next-auth/react";

import { ProductCard } from "@/components/product/productCard";
import { api, ApiClientError } from "@/lib/api";
import { SellerDetail } from "@/types/types";

interface StoreProfilePageProps {
  initialSeller: SellerDetail;
}

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Recently joined";

const sellerTypeLabels: Record<SellerDetail["sellerType"], string> = {
  retail: "Retail seller",
  wholesale: "Wholesale seller",
};

const formatDeliverySpeed = (value?: number | null) =>
  value === null || value === undefined ? "Delivery speed not tracked" : `${value.toFixed(1)} day average delivery`;

const formatStoreLocation = (seller: SellerDetail) =>
  [
    seller.storeLocation.city,
    seller.storeLocation.state,
    seller.storeLocation.country,
  ].filter(Boolean).join(", ") || "Location not provided";

export function StoreProfilePage({ initialSeller }: StoreProfilePageProps) {
  const { status } = useSession();
  const [seller, setSeller] = React.useState(initialSeller);
  const [reportReason, setReportReason] = React.useState("misleading-listing");
  const [reportDetails, setReportDetails] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [following, setFollowing] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);

  const handleFollow = async () => {
    setFollowing(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await api.followSeller(seller.id);
      setSeller((current) => ({
        ...current,
        followerCount: updated.followerCount,
      }));
      setMessage(`You are now following ${seller.storeName}.`);
    } catch (followError) {
      setError(
        followError instanceof ApiClientError
          ? followError.message
          : "We couldn't follow this store right now."
      );
    } finally {
      setFollowing(false);
    }
  };

  const handleReport = async () => {
    setReporting(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await api.reportSeller(seller.id, {
        reason: reportReason as
          | "counterfeit"
          | "fraud"
          | "abuse"
          | "delivery-issue"
          | "misleading-listing"
          | "other",
        details: reportDetails,
      });
      setSeller((current) => ({
        ...current,
        reportCount: updated.reportCount,
      }));
      setMessage("Your report has been sent to admin for review.");
      setReportDetails("");
    } catch (reportError) {
      setError(
        reportError instanceof ApiClientError
          ? reportError.message
          : "We couldn't submit the report right now."
      );
    } finally {
      setReporting(false);
    }
  };

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100%",
        px: { xs: 1.5, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.1)} 0%, transparent 24%), linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={3}>
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
            <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
              <Chip
                icon={<StorefrontRounded />}
                label="seller storefront"
                color="primary"
                sx={{ width: "fit-content", borderRadius: 999 }}
              />
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
                {seller.storeName}
              </Typography>
              {seller.storeTagline ? (
                <Typography variant="h6" color="text.secondary">
                  {seller.storeTagline}
                </Typography>
              ) : null}
              <Typography variant="body1" color="text.secondary">
                {seller.storeDescription}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={sellerTypeLabels[seller.sellerType]} variant="outlined" />
                {seller.governmentIdVerified && (
                  <Chip
                    icon={<VerifiedRounded sx={{ fontSize: 15 }} />}
                    label="Verified seller"
                    color="success"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                {seller.sellerBadge ? (
                  <Chip label={seller.sellerBadge} color="success" variant="outlined" />
                ) : null}
                <Chip label={formatStoreLocation(seller)} variant="outlined" />
                <Chip label={`${seller.followerCount} followers`} variant="outlined" />
                <Chip label={`${seller.purchaseCount} recorded purchases`} variant="outlined" />
                <Chip label={`${seller.completedDeliveries} completed deliveries`} variant="outlined" />
                <Chip label={`Selling since ${formatDate(seller.startedAt)}`} variant="outlined" />
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                startIcon={<GroupRounded />}
                disabled={status !== "authenticated" || following}
                onClick={handleFollow}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
              >
                {following ? "Following..." : "Follow seller"}
              </Button>
              <Button
                component={Link}
                href="/products"
                variant="outlined"
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
              >
                Keep shopping
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {seller.sellerNotice ? (
          <Alert severity="warning">{seller.sellerNotice}</Alert>
        ) : null}
        {message ? <Alert severity="success">{message}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.35fr) 340px" },
            alignItems: "start",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                Products from this store
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
                }}
              >
                {seller.products.length ? (
                  seller.products.map((product) => (
                    <ProductCard key={product.id} product={product} size="compact" />
                  ))
                ) : (
                  <Paper
                    elevation={0}
                    sx={{
                      gridColumn: "1 / -1",
                      p: 3,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      This seller has not published products yet.
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Stack>
          </Paper>

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
                <Stack direction="row" spacing={1} alignItems="center">
                  <FlagRounded color="warning" />
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Buyer protection
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  If a store behaves suspiciously, buyers can flag it and the admin can suspend or remove the seller privately.
                </Typography>
                <TextField
                  select
                  label="Reason"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  disabled={status !== "authenticated"}
                >
                  <MenuItem value="misleading-listing">Misleading listing</MenuItem>
                  <MenuItem value="delivery-issue">Delivery issue</MenuItem>
                  <MenuItem value="counterfeit">Counterfeit product</MenuItem>
                  <MenuItem value="fraud">Fraud</MenuItem>
                  <MenuItem value="abuse">Abuse</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
                <TextField
                  label="Details"
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  multiline
                  minRows={4}
                  disabled={status !== "authenticated"}
                />
                <Button
                  variant="outlined"
                  startIcon={<ReportRounded />}
                  onClick={handleReport}
                  disabled={status !== "authenticated" || reporting}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                >
                  {reporting ? "Sending report..." : "Report seller"}
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
                  Store health
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Reports filed: {seller.reportCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  seller status: {seller.sellerStatus}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Store type: {sellerTypeLabels[seller.sellerType]}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Location: {formatStoreLocation(seller)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Contact: {seller.sellerContact.businessPhone || seller.sellerContact.businessEmail || "Not provided"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDeliverySpeed(seller.averageDeliveryDays)}
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
