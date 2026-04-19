'use client';

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AccountCircleRounded,
  LocalShippingRounded,
  LogoutRounded,
  PaymentRounded,
  SaveRounded,
  StoreRounded,
  StorefrontRounded,
} from "@mui/icons-material";
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
import { canCreateProductsRole } from "@/lib/roles";
import { UserProfile } from "@/types/types";

interface ProfilePageProps {
  initialProfile: UserProfile;
}

export function ProfilePage({ initialProfile }: ProfilePageProps) {
  const router = useRouter();
  const { update } = useSession();
  const [profile, setProfile] = React.useState(initialProfile);
  const [sellerMode, setSellerMode] = React.useState(initialProfile.role === "seller");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const isAdmin = profile.role === "admin";
  const sellerSwitchChecked = isAdmin || sellerMode;
  const savedSellerAccess = isAdmin || canCreateProductsRole(profile.role);

  const updateProfileField =
    (field: "name" | "email" | "phone" | "storeName" | "storeDescription") =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProfile((current) => ({ ...current, [field]: value }));
    };

  const updateShippingField =
    (field: keyof UserProfile["shippingAddress"]) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProfile((current) => ({
        ...current,
        shippingAddress: {
          ...current.shippingAddress,
          [field]: value,
        },
      }));
    };

  const updatePaymentField =
    (field: keyof UserProfile["paymentInfo"]) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProfile((current) => ({
        ...current,
        paymentInfo: {
          ...current.paymentInfo,
          [field]: value,
        },
      }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedProfile = await api.updateProfile({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        isSeller: sellerMode,
        storeName: profile.storeName,
        storeDescription: profile.storeDescription,
        shippingAddress: profile.shippingAddress,
        paymentInfo: profile.paymentInfo,
      });

      setProfile(updatedProfile);
      setSellerMode(updatedProfile.role === "seller");
      await update({
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        role: updatedProfile.role,
      });
      router.refresh();
      setSuccess("Your profile was updated.");
    } catch (profileError) {
      setError(
        profileError instanceof ApiClientError
          ? profileError.message
          : "We couldn't save your profile right now."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100%",
        px: { xs: 2, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(circle at top left, ${theme.palette.mode === "dark" ? "rgba(25, 118, 210, 0.16)" : "rgba(25, 118, 210, 0.08)"} 0%, transparent 24%), linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={4}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            spacing={2}
            alignItems={{ xs: "flex-start", lg: "center" }}
          >
            <Box>
              <Chip
                icon={<AccountCircleRounded />}
                label="Profile"
                color="primary"
                sx={{ mb: 1.5, borderRadius: 999 }}
              />
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
                Manage your account and store.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Update your details and set up your shop from one place.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={`Account type: ${profile.role}`} color="secondary" />
              {savedSellerAccess ? (
                <Chip label="Selling is on" color="success" />
              ) : (
                <Chip label="Shopping only" variant="outlined" />
              )}
            </Stack>
          </Stack>
        </Paper>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 320px" },
            alignItems: "start",
          }}
        >
          <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccountCircleRounded color="primary" />
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Personal details
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Display name"
                    value={profile.name}
                    onChange={updateProfileField("name")}
                    required
                  />
                  <TextField
                    label="Email"
                    type="email"
                    value={profile.email}
                    onChange={updateProfileField("email")}
                    required
                  />
                  <TextField
                    label="Phone"
                    value={profile.phone}
                    onChange={updateProfileField("phone")}
                  />
                  <TextField
                    label="Account type"
                    value={profile.role}
                    InputProps={{ readOnly: true }}
                  />
                </Box>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StoreRounded color="primary" />
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Shop details
                  </Typography>
                </Stack>

                <FormControlLabel
                  control={
                    <Switch
                      checked={sellerSwitchChecked}
                      onChange={(event) => setSellerMode(event.target.checked)}
                      disabled={isAdmin}
                    />
                  }
                  label={
                    isAdmin
                      ? "This account can already manage the shop"
                      : "Turn this on to set up a shop and publish products"
                  }
                />

                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Store name"
                    value={profile.storeName}
                    onChange={updateProfileField("storeName")}
                    disabled={!sellerSwitchChecked && !isAdmin}
                    required={sellerMode}
                  />
                  <TextField
                    label="Store status"
                    value={
                      sellerSwitchChecked
                        ? savedSellerAccess
                          ? "Ready to sell"
                          : "Save to start selling"
                        : "Shopping only"
                    }
                    InputProps={{ readOnly: true }}
                  />
                </Box>

                <TextField
                  label="Store description"
                  value={profile.storeDescription}
                  onChange={updateProfileField("storeDescription")}
                  multiline
                  minRows={3}
                  disabled={!sellerSwitchChecked && !isAdmin}
                />
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocalShippingRounded color="primary" />
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Shipping information
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Full name"
                    value={profile.shippingAddress.fullName}
                    onChange={updateShippingField("fullName")}
                  />
                  <TextField
                    label="Address line 1"
                    value={profile.shippingAddress.addressLine1}
                    onChange={updateShippingField("addressLine1")}
                  />
                  <TextField
                    label="Address line 2"
                    value={profile.shippingAddress.addressLine2}
                    onChange={updateShippingField("addressLine2")}
                  />
                  <TextField
                    label="City"
                    value={profile.shippingAddress.city}
                    onChange={updateShippingField("city")}
                  />
                  <TextField
                    label="State / Region"
                    value={profile.shippingAddress.state}
                    onChange={updateShippingField("state")}
                  />
                  <TextField
                    label="Postal code"
                    value={profile.shippingAddress.postalCode}
                    onChange={updateShippingField("postalCode")}
                  />
                  <TextField
                    label="Country"
                    value={profile.shippingAddress.country}
                    onChange={updateShippingField("country")}
                  />
                </Box>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PaymentRounded color="primary" />
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Payment information
                  </Typography>
                </Stack>
                <Alert severity="info">
                  Save reference details here, not full card numbers or sensitive payment secrets.
                </Alert>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    select
                    label="Preferred method"
                    value={profile.paymentInfo.method}
                    onChange={updatePaymentField("method")}
                  >
                    <MenuItem value="card">Card</MenuItem>
                    <MenuItem value="paypal">PayPal</MenuItem>
                    <MenuItem value="bank-transfer">Bank transfer</MenuItem>
                  </TextField>
                  <TextField
                    label="Cardholder / account name"
                    value={profile.paymentInfo.cardholderName}
                    onChange={updatePaymentField("cardholderName")}
                  />
                  <TextField
                    label="Card last 4"
                    value={profile.paymentInfo.cardLast4}
                    onChange={updatePaymentField("cardLast4")}
                    inputProps={{ maxLength: 4 }}
                  />
                  <TextField
                    label="Expiry month"
                    value={profile.paymentInfo.expiryMonth}
                    onChange={updatePaymentField("expiryMonth")}
                    inputProps={{ maxLength: 2 }}
                  />
                  <TextField
                    label="Expiry year"
                    value={profile.paymentInfo.expiryYear}
                    onChange={updatePaymentField("expiryYear")}
                    inputProps={{ maxLength: 4 }}
                  />
                  <TextField
                    label="Billing postal code"
                    value={profile.paymentInfo.billingPostalCode}
                    onChange={updatePaymentField("billingPostalCode")}
                  />
                </Box>
              </Stack>
            </Paper>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveRounded />}
                disabled={saving}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
              >
                {saving ? "Saving..." : "Save profile"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                startIcon={<LogoutRounded />}
                onClick={() => void signOut({ callbackUrl: "/" })}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
              >
                Sign out
              </Button>
            </Stack>
          </Stack>

          <Stack spacing={2.5}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StorefrontRounded color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Store actions
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {savedSellerAccess
                    ? "Your account can add products right away."
                    : sellerSwitchChecked
                      ? "Save your profile to start adding products to your shop."
                      : "Turn on selling, add your shop name, and save when you're ready to begin."}
                </Typography>
                <Button
                  component={Link}
                  href="/dashboard/products/new"
                  variant="contained"
                  disabled={!savedSellerAccess}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
                >
                  Create a product
                </Button>
                <Button
                  component={Link}
                  href="/settings"
                  variant="outlined"
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
                >
                  Open settings
                </Button>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  How this helps
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You can shop with a regular account, or turn on selling to add shop details and publish items.
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
