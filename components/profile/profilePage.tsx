'use client';

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AccountCircleRounded,
  AddBusinessRounded,
  BadgeRounded,
  ContactPhoneRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  LogoutRounded,
  PaymentRounded,
  PlaceRounded,
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

const sellerTypeLabels: Record<UserProfile["sellerType"], string> = {
  retail: "Retail seller",
  wholesale: "Wholesale seller",
};

export function ProfilePage({ initialProfile }: ProfilePageProps) {
  const router = useRouter();
  const { update } = useSession();
  const sellerSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = React.useState(initialProfile);
  const [sellerMode, setSellerMode] = React.useState(initialProfile.role === "seller");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const isAdmin = profile.role === "admin";
  const sellerSwitchChecked = isAdmin || sellerMode;
  const savedSellerAccess =
    isAdmin || (canCreateProductsRole(profile.role) && profile.sellerStatus === "active");

  const updateProfileField =
    (
      field:
        | "name"
        | "email"
        | "phone"
        | "storeName"
        | "sellerType"
        | "storeTagline"
        | "storeDescription"
    ) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProfile((current) => ({ ...current, [field]: value }));
    };

  const updateSellerIdentityField =
    (field: keyof UserProfile["sellerIdentity"]) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const value = event.target.value;
      setProfile((current) => ({
        ...current,
        ...(field === "storeTagline" ? { storeTagline: value } : null),
        ...(field === "governmentIdType" ? { governmentIdType: value as UserProfile["governmentIdType"] } : null),
        ...(field === "governmentIdNumber" ? { governmentIdNumber: value } : null),
        sellerIdentity: {
          ...current.sellerIdentity,
          [field]: value,
        },
      }));
    };

  const updateStoreLocationField =
    (field: keyof UserProfile["storeLocation"]) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProfile((current) => ({
        ...current,
        storeLocation: {
          ...current.storeLocation,
          [field]: value,
        },
      }));
    };

  const updateSellerContactField =
    (field: keyof UserProfile["sellerContact"]) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProfile((current) => ({
        ...current,
        sellerContact: {
          ...current.sellerContact,
          [field]: value,
        },
      }));
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
        isSeller: sellerMode || isAdmin,
        storeName: profile.storeName,
        sellerType: profile.sellerType,
        storeTagline: profile.storeTagline,
        storeDescription: profile.storeDescription,
        storeLocation: profile.storeLocation,
        sellerContact: profile.sellerContact,
        sellerIdentity: profile.sellerIdentity,
        shippingAddress: profile.shippingAddress,
        paymentInfo: profile.paymentInfo,
      });

      setProfile(updatedProfile);
      setSellerMode(updatedProfile.role === "seller" || updatedProfile.role === "admin");
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

  const handleBecomeSeller = () => {
    setSellerMode(true);
    window.requestAnimationFrame(() => {
      sellerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
            borderRadius: 2,
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
                <Chip label="Store is active" color="success" />
              ) : profile.sellerStatus === "pending" ? (
                <Chip label="Pending admin approval" color="warning" />
              ) : profile.sellerStatus === "suspended" ? (
                <Chip label="Store suspended" color="warning" />
              ) : profile.sellerStatus === "removed" ? (
                <Chip label="Store removed" color="error" />
              ) : (
                <Chip label="Default buyer" variant="outlined" />
              )}
              {sellerSwitchChecked ? (
                <Chip label={sellerTypeLabels[profile.sellerType]} variant="outlined" />
              ) : null}
              {!sellerSwitchChecked && !isAdmin ? (
                <Button
                  type="button"
                  variant="contained"
                  startIcon={<AddBusinessRounded />}
                  onClick={handleBecomeSeller}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                >
                  Become a seller
                </Button>
              ) : (
                <Button
                  component={Link}
                  href="/dashboard/products"
                  variant="contained"
                  startIcon={<Inventory2Rounded />}
                  disabled={!savedSellerAccess}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                >
                  Manage products
                </Button>
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
                borderRadius: 2,
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
              ref={sellerSectionRef}
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StoreRounded color="primary" />
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Seller onboarding
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
                      ? "This admin account can also run a store"
                      : "Apply to become a seller"
                  }
                />

                <Alert severity="info">
                  Seller applications go to admin review before product publishing is enabled. Seller accounts can still shop and check out as buyers.
                </Alert>

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
                    label="Store tagline"
                    value={profile.storeTagline}
                    onChange={updateProfileField("storeTagline")}
                    disabled={!sellerSwitchChecked && !isAdmin}
                  />
                  <TextField
                    select
                    label="Sell as"
                    value={profile.sellerType}
                    onChange={updateProfileField("sellerType")}
                    disabled={!sellerSwitchChecked && !isAdmin}
                  >
                    <MenuItem value="retail">Retail seller</MenuItem>
                    <MenuItem value="wholesale">Wholesale seller</MenuItem>
                  </TextField>
                  <TextField
                    label="Store status"
                    value={
                      sellerSwitchChecked
                        ? profile.sellerStatus === "suspended"
                          ? "Suspended by admin"
                          : profile.sellerStatus === "removed"
                            ? "Removed by admin"
                            : profile.sellerStatus === "pending"
                              ? "Pending admin approval"
                            : savedSellerAccess
                              ? "Ready to sell"
                              : "Save to submit your seller application"
                        : "Buyer only"
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

                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PlaceRounded color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      Store location
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
                      label="Store address"
                      value={profile.storeLocation.addressLine1}
                      onChange={updateStoreLocationField("addressLine1")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                      required={sellerMode}
                    />
                    <TextField
                      label="City"
                      value={profile.storeLocation.city}
                      onChange={updateStoreLocationField("city")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                      required={sellerMode}
                    />
                    <TextField
                      label="State / Region"
                      value={profile.storeLocation.state}
                      onChange={updateStoreLocationField("state")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                      required={sellerMode}
                    />
                    <TextField
                      label="Country"
                      value={profile.storeLocation.country}
                      onChange={updateStoreLocationField("country")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                      required={sellerMode}
                    />
                    <TextField
                      label="Postal code"
                      value={profile.storeLocation.postalCode}
                      onChange={updateStoreLocationField("postalCode")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                    />
                  </Box>
                </Stack>

                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ContactPhoneRounded color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      Seller business details
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
                      label="Business email"
                      type="email"
                      value={profile.sellerContact.businessEmail}
                      onChange={updateSellerContactField("businessEmail")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                    />
                    <TextField
                      label="Business phone"
                      value={profile.sellerContact.businessPhone}
                      onChange={updateSellerContactField("businessPhone")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                      required={sellerMode && !profile.phone}
                    />
                    <TextField
                      label="WhatsApp"
                      value={profile.sellerContact.whatsapp}
                      onChange={updateSellerContactField("whatsapp")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                    />
                    <TextField
                      label="Business registration number"
                      value={profile.sellerContact.registrationNumber}
                      onChange={updateSellerContactField("registrationNumber")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                    />
                  </Box>
                </Stack>

                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BadgeRounded color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      Seller verification
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
                      select
                      label="Government ID"
                      value={profile.sellerIdentity.governmentIdType}
                      onChange={updateSellerIdentityField("governmentIdType")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                    >
                      <MenuItem value="ghana-card">Ghana Card</MenuItem>
                      <MenuItem value="passport">Passport</MenuItem>
                      <MenuItem value="drivers-license">Driver&apos;s License</MenuItem>
                    </TextField>
                    <TextField
                      label="ID number"
                      value={profile.sellerIdentity.governmentIdNumber}
                      onChange={updateSellerIdentityField("governmentIdNumber")}
                      disabled={!sellerSwitchChecked && !isAdmin}
                      helperText="This stays private to admins and seller review."
                    />
                  </Box>

                  {profile.sellerNotice ? (
                    <Alert severity="warning">{profile.sellerNotice}</Alert>
                  ) : null}
                  {profile.sellerBadge ? (
                    <Alert severity="success">
                      Store badge: {profile.sellerBadge}
                    </Alert>
                  ) : null}
                </Stack>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
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
                borderRadius: 2,
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
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
              >
                {saving ? "Saving..." : "Save profile"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                startIcon={<LogoutRounded />}
                onClick={() => void signOut({ callbackUrl: "/" })}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
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
                borderRadius: 2,
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
                    ? "Your store can publish products right away."
                    : profile.sellerStatus === "pending"
                      ? "Your storefront application is waiting for admin approval before products can go live."
                    : profile.sellerStatus === "suspended"
                      ? "Your store is temporarily paused. Review the seller notice above before contacting admin."
                      : profile.sellerStatus === "removed"
                        ? "Your seller access was removed. Buyer features still work, but product publishing is disabled."
                    : sellerSwitchChecked
                      ? "Save your store, description, and Ghana Card details to activate seller access."
                      : "Stay as a buyer, or turn on selling when you are ready to open a store."}
                </Typography>
                <Button
                  component={Link}
                  href="/dashboard/products/new"
                  variant="contained"
                  disabled={!savedSellerAccess}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                >
                  Create a product
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/products"
                  variant="outlined"
                  disabled={!savedSellerAccess}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                >
                  Manage products
                </Button>
                <Button
                  component={Link}
                  href={profile.storeSlug ? `/stores/${profile.storeSlug}` : "/products"}
                  variant="outlined"
                  disabled={!savedSellerAccess}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                >
                  View storefront
                </Button>
                <Button
                  component={Link}
                  href="/settings"
                  variant="outlined"
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                >
                  Open settings
                </Button>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Marketplace model
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Buyers can browse immediately. Sellers must register a store with identity details, and admins can monitor seller health privately.
                  Approved sellers keep buyer checkout access while managing their storefront and product catalog.
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
