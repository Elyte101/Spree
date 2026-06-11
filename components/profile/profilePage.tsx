'use client';

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AccountBalanceRounded,
  AccountCircleRounded,
  AddBusinessRounded,
  BadgeRounded,
  CameraAltRounded,
  CheckCircleOutlined,
  ContactPhoneRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  LogoutRounded,
  PaymentRounded,
  PhoneAndroidRounded,
  PlaceRounded,
  SaveRounded,
  StoreRounded,
  StorefrontRounded,
  UploadFileRounded,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { api, ApiClientError } from "@/lib/api";
import { canCreateProductsRole } from "@/lib/roles";
import { PhoneInput } from "@/components/ui/phoneInput";
import { UserProfile } from "@/types/types";
import { GHANA_ID_TYPES, COUNTRY_LIST, getRegionsForCountry, getRegionLabel } from "@/lib/ghana";

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

  // ID document upload state
  const [idFront, setIdFront] = React.useState<File | null>(null);
  const [idBack, setIdBack] = React.useState<File | null>(null);
  const [selfie, setSelfie] = React.useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = React.useState(false);
  const [docsError, setDocsError] = React.useState<string | null>(null);
  const [docsSuccess, setDocsSuccess] = React.useState<string | null>(null);

  // Payout info state
  const [payout, setPayout] = React.useState({
    method: (profile.payoutInfo?.method ?? "bank") as "bank" | "mobile_money",
    bankName: profile.payoutInfo?.bankName ?? "",
    accountNumber: profile.payoutInfo?.accountNumber ?? profile.payoutInfo?.mobileMoneyNumber ?? "",
    bankCode: profile.payoutInfo?.bankCode ?? "",
    mobileMoneyNetwork: profile.payoutInfo?.mobileMoneyNetwork ?? "",
    mobileMoneyNumber: profile.payoutInfo?.mobileMoneyNumber ?? "",
    currency: profile.payoutInfo?.currency ?? "$",
    accountName: profile.payoutInfo?.accountName ?? profile.name ?? "",
  });
  const [savingPayout, setSavingPayout] = React.useState(false);
  const [payoutError, setPayoutError] = React.useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = React.useState<string | null>(null);

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

  const handleUploadDocs = async () => {
    if (!idFront && !idBack && !selfie) return;
    setDocsError(null);
    setDocsSuccess(null);
    setUploadingDocs(true);
    try {
      const fd = new FormData();
      if (idFront) fd.append("id_front", idFront);
      if (idBack) fd.append("id_back", idBack);
      if (selfie) fd.append("selfie", selfie);
      const res = await fetch("/api/auth/id-documents", { method: "POST", body: fd });
      if (!res.ok) {
        const d = (await res.json()) as { detail?: string };
        throw new Error(d.detail ?? "Upload failed");
      }
      setDocsSuccess("Documents uploaded. An admin will review and verify your identity.");
      setIdFront(null);
      setIdBack(null);
      setSelfie(null);
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleSavePayout = async () => {
    setPayoutError(null);
    setPayoutSuccess(null);
    setSavingPayout(true);
    try {
      const res = await fetch("/api/auth/payout-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payout),
      });
      if (!res.ok) {
        const d = (await res.json()) as { detail?: string };
        throw new Error(d.detail ?? "Could not save payout info");
      }
      setPayoutSuccess("Payout account saved. Funds will be sent here after delivery confirmation.");
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingPayout(false);
    }
  };

  const canUploadDocs = sellerMode && !isAdmin;

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
                  <PhoneInput
                    label="Phone"
                    value={profile.phone}
                    onChange={(val) => setProfile((c) => ({ ...c, phone: val }))}
                    autoComplete="tel"
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
                    {(() => {
                      const country = profile.storeLocation.country || "Ghana";
                      const regions = getRegionsForCountry(country);
                      const label = getRegionLabel(country);
                      const disabled = !sellerSwitchChecked && !isAdmin;
                      return regions ? (
                        <FormControl required={sellerMode} disabled={disabled}>
                          <InputLabel>{label}</InputLabel>
                          <Select
                            label={label}
                            value={profile.storeLocation.state}
                            onChange={(e) => setProfile((current) => ({
                              ...current,
                              storeLocation: { ...current.storeLocation, state: e.target.value },
                            }))}
                          >
                            {regions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          label={label}
                          value={profile.storeLocation.state}
                          onChange={updateStoreLocationField("state")}
                          disabled={disabled}
                          required={sellerMode}
                        />
                      );
                    })()}
                    <FormControl required={sellerMode} disabled={!sellerSwitchChecked && !isAdmin}>
                      <InputLabel>Country</InputLabel>
                      <Select
                        label="Country"
                        value={profile.storeLocation.country || "Ghana"}
                        onChange={(e) => setProfile((current) => ({
                          ...current,
                          storeLocation: { ...current.storeLocation, country: e.target.value, state: "" },
                        }))}
                      >
                        {COUNTRY_LIST.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </Select>
                    </FormControl>
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
                    <PhoneInput
                      label="Business phone"
                      value={profile.sellerContact.businessPhone}
                      onChange={(val) => setProfile((c) => ({
                        ...c,
                        sellerContact: { ...c.sellerContact, businessPhone: val },
                      }))}
                      disabled={!sellerSwitchChecked && !isAdmin}
                      required={sellerMode && !profile.phone}
                    />
                    <PhoneInput
                      label="WhatsApp"
                      value={profile.sellerContact.whatsapp}
                      onChange={(val) => setProfile((c) => ({
                        ...c,
                        sellerContact: { ...c.sellerContact, whatsapp: val },
                      }))}
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
                      {GHANA_ID_TYPES.map((id) => (
                        <MenuItem key={id.value} value={id.value}>{id.label}</MenuItem>
                      ))}
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
                  {(() => {
                    const country = profile.shippingAddress.country || "Ghana";
                    const regions = getRegionsForCountry(country);
                    const label = getRegionLabel(country);
                    return regions ? (
                      <FormControl>
                        <InputLabel>{label}</InputLabel>
                        <Select
                          label={label}
                          value={profile.shippingAddress.state}
                          onChange={(e) => setProfile((current) => ({
                            ...current,
                            shippingAddress: { ...current.shippingAddress, state: e.target.value },
                          }))}
                        >
                          {regions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        label={label}
                        value={profile.shippingAddress.state}
                        onChange={updateShippingField("state")}
                      />
                    );
                  })()}
                  <TextField
                    label="Postal code"
                    value={profile.shippingAddress.postalCode}
                    onChange={updateShippingField("postalCode")}
                  />
                  <FormControl>
                    <InputLabel>Country</InputLabel>
                    <Select
                      label="Country"
                      value={profile.shippingAddress.country || "Ghana"}
                      onChange={(e) => setProfile((current) => ({
                        ...current,
                        shippingAddress: { ...current.shippingAddress, country: e.target.value, state: "" },
                      }))}
                    >
                      {COUNTRY_LIST.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </FormControl>
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

            {/* ── ID DOCUMENT UPLOAD ── */}
            {canUploadDocs && (
              <Paper
                elevation={0}
                sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
              >
                <Stack spacing={2.5}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <BadgeRounded color="primary" />
                    <Box>
                      <Typography variant="h5" fontWeight={900}>Identity verification</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Upload the front and back of your government ID plus a selfie holding it.
                        An admin will review within 24 hours.
                      </Typography>
                    </Box>
                    {profile.governmentIdVerified && (
                      <Chip
                        icon={<CheckCircleOutlined fontSize="small" />}
                        label="Verified"
                        color="success"
                        size="small"
                        sx={{ ml: "auto !important", fontWeight: 700 }}
                      />
                    )}
                  </Stack>

                  {docsError && <Alert severity="error" onClose={() => setDocsError(null)}>{docsError}</Alert>}
                  {docsSuccess && <Alert severity="success" onClose={() => setDocsSuccess(null)}>{docsSuccess}</Alert>}

                  {!profile.governmentIdVerified && (
                    <Box
                      sx={(theme) => ({
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.warning.main, 0.07),
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                      })}
                    >
                      <Typography variant="caption" color="warning.main" fontWeight={600}>
                        Your identity has not been verified yet. Upload your documents below to begin the review process.
                      </Typography>
                    </Box>
                  )}

                  <Stack spacing={2}>
                    {(
                      [
                        { label: "ID card — front", slot: "id_front", file: idFront, set: setIdFront, icon: <UploadFileRounded fontSize="small" />, existing: profile.idFrontUrl },
                        { label: "ID card — back", slot: "id_back", file: idBack, set: setIdBack, icon: <UploadFileRounded fontSize="small" />, existing: profile.idBackUrl },
                        { label: "Selfie holding ID", slot: "selfie", file: selfie, set: setSelfie, icon: <CameraAltRounded fontSize="small" />, existing: profile.selfieUrl },
                      ] as const
                    ).map(({ label, file, set, icon, existing }) => (
                      <Stack key={label} direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1.5}>
                        <Box flex={1}>
                          <Typography variant="body2" fontWeight={600} gutterBottom>{label}</Typography>
                          {existing && !file && (
                            <Typography variant="caption" color="success.main">
                              ✓ Previously uploaded
                            </Typography>
                          )}
                        </Box>
                        <Button
                          component="label"
                          variant={file ? "contained" : "outlined"}
                          color={file ? "success" : "primary"}
                          startIcon={icon}
                          size="small"
                          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
                        >
                          {file ? file.name.slice(0, 24) : `Choose file`}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            hidden
                            onChange={(e) => set(e.target.files?.[0] ?? null)}
                          />
                        </Button>
                      </Stack>
                    ))}
                  </Stack>

                  <Button
                    variant="contained"
                    onClick={handleUploadDocs}
                    disabled={uploadingDocs || (!idFront && !idBack && !selfie)}
                    startIcon={uploadingDocs ? <CircularProgress size={16} color="inherit" /> : <UploadFileRounded />}
                    sx={{ alignSelf: "flex-start", borderRadius: 2.5, fontWeight: 700, textTransform: "none" }}
                  >
                    {uploadingDocs ? "Uploading…" : "Submit documents"}
                  </Button>
                </Stack>
              </Paper>
            )}

            {/* ── PAYOUT INFO ── */}
            {(sellerMode || isAdmin) && (
              <Paper
                elevation={0}
                sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
              >
                <Stack spacing={2.5}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <AccountBalanceRounded color="primary" />
                    <Box>
                      <Typography variant="h5" fontWeight={900}>Payout account</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Where Spree sends your earnings after a buyer confirms delivery. Your original listing price is transferred in full.
                      </Typography>
                    </Box>
                  </Stack>

                  {payoutError && <Alert severity="error" onClose={() => setPayoutError(null)}>{payoutError}</Alert>}
                  {payoutSuccess && <Alert severity="success" onClose={() => setPayoutSuccess(null)}>{payoutSuccess}</Alert>}

                  {/* Method toggle */}
                  <Stack direction="row" spacing={1}>
                    {(["bank", "mobile_money"] as const).map((m) => (
                      <Button
                        key={m}
                        variant={payout.method === m ? "contained" : "outlined"}
                        size="small"
                        startIcon={m === "bank" ? <AccountBalanceRounded fontSize="small" /> : <PhoneAndroidRounded fontSize="small" />}
                        onClick={() => setPayout((p) => ({ ...p, method: m }))}
                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                      >
                        {m === "bank" ? "Bank account" : "Mobile money"}
                      </Button>
                    ))}
                  </Stack>

                  <Divider />

                  {payout.method === "bank" ? (
                    <Stack spacing={2}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                          label="Account name"
                          value={payout.accountName}
                          onChange={(e) => setPayout((p) => ({ ...p, accountName: e.target.value }))}
                          size="small"
                          fullWidth
                        />
                        <TextField
                          label="Bank name"
                          value={payout.bankName}
                          onChange={(e) => setPayout((p) => ({ ...p, bankName: e.target.value }))}
                          size="small"
                          fullWidth
                        />
                      </Stack>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                          label="Account number"
                          value={payout.accountNumber}
                          onChange={(e) => setPayout((p) => ({ ...p, accountNumber: e.target.value }))}
                          size="small"
                          fullWidth
                          inputProps={{ maxLength: 20 }}
                        />
                        <TextField
                          label="Bank code (GHIPSS / sort code)"
                          value={payout.bankCode}
                          onChange={(e) => setPayout((p) => ({ ...p, bankCode: e.target.value }))}
                          size="small"
                          fullWidth
                          inputProps={{ maxLength: 10 }}
                        />
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack spacing={2}>
                      <TextField
                        label="Account name"
                        value={payout.accountName}
                        onChange={(e) => setPayout((p) => ({ ...p, accountName: e.target.value }))}
                        size="small"
                        fullWidth
                      />
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                          select
                          label="Network"
                          value={payout.mobileMoneyNetwork}
                          onChange={(e) => setPayout((p) => ({ ...p, mobileMoneyNetwork: e.target.value }))}
                          size="small"
                          sx={{ minWidth: 160 }}
                        >
                          {["MTN", "Vodafone", "AirtelTigo"].map((n) => (
                            <MenuItem key={n} value={n}>{n}</MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Mobile money number"
                          value={payout.mobileMoneyNumber}
                          onChange={(e) => setPayout((p) => ({ ...p, mobileMoneyNumber: e.target.value }))}
                          size="small"
                          fullWidth
                          inputProps={{ maxLength: 15 }}
                        />
                      </Stack>
                    </Stack>
                  )}

                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      select
                      label="Currency"
                      value={payout.currency}
                      onChange={(e) => setPayout((p) => ({ ...p, currency: e.target.value }))}
                      size="small"
                      sx={{ width: 120 }}
                    >
                      {["₵", "GHS"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                    <Button
                      variant="contained"
                      onClick={handleSavePayout}
                      disabled={savingPayout}
                      startIcon={savingPayout ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
                      sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: "none" }}
                    >
                      {savingPayout ? "Saving…" : "Save payout account"}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
