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
  CheckCircleOutlined,
  CheckCircleRounded,
  EditRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  LogoutRounded,
  PaymentRounded,
  PhoneAndroidRounded,
  StorefrontRounded,
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
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { api } from "@/lib/api";
import { canCreateProductsRole } from "@/lib/roles";
import { PhoneInput } from "@/components/ui/phoneInput";
import { SaveButton } from "@/components/ui/saveButton";
import { UserProfile } from "@/types/types";
import { COUNTRY_LIST, getRegionsForCountry, getRegionLabel, MOMO_NETWORKS, validateMoMoNumber } from "@/lib/ghana";
import { useMomoResolve } from "@/lib/hooks/useMomoResolve";
import { useBankResolve } from "@/lib/hooks/useBankResolve";
import { useSaveState } from "@/lib/hooks/useSaveState";
import { PasskeyManager } from "@/components/auth/passkeyManager";

type ProfileSection = "personal" | "shipping" | "payment";

function SectionHeader({
  icon,
  title,
  subtitle,
  isEditing,
  onEdit,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isEditing: boolean;
  onEdit: () => void;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {!isEditing && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditRounded fontSize="small" />}
          onClick={onEdit}
          sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700, flexShrink: 0 }}
        >
          Edit
        </Button>
      )}
    </Stack>
  );
}

interface ProfilePageProps {
  initialProfile: UserProfile;
}

const sellerTypeLabels: Record<UserProfile["sellerType"], string> = {
  retail: "Retail vendor",
  wholesale: "Wholesale vendor",
};

const emptyPayout = (profile: UserProfile) => ({
  method: (profile.payoutInfo?.method === "bank" ? "bank" : "mobile_money") as "mobile_money" | "bank",
  mobileMoneyNetwork: profile.payoutInfo?.mobileMoneyNetwork ?? MOMO_NETWORKS[0].value,
  mobileMoneyNumber: profile.payoutInfo?.mobileMoneyNumber ?? "",
  bankCode: profile.payoutInfo?.bankCode ?? "",
  bankName: profile.payoutInfo?.bankName ?? "",
  accountNumber: profile.payoutInfo?.accountNumber ?? "",
  currency: "GHS",
  accountName: profile.payoutInfo?.accountName ?? profile.name ?? "",
});

export function ProfilePage({ initialProfile }: ProfilePageProps) {
  const router = useRouter();
  const { update } = useSession();

  // `profile` is also the live draft while a section is being edited.
  // `savedProfile` is the last server-confirmed snapshot — what read-only
  // sections render, and what "Cancel" resets an edited section back to.
  // Invariant: whenever a section isn't in edit mode, its slice of `profile`
  // equals the same slice of `savedProfile`.
  const [profile, setProfile] = React.useState(initialProfile);
  const [savedProfile, setSavedProfile] = React.useState(initialProfile);

  const [editing, setEditing] = React.useState<Record<ProfileSection, boolean>>({
    personal: false,
    shipping: false,
    payment: false,
  });
  const exitEditOnSettle = (section: ProfileSection) =>
    setEditing((e) => ({ ...e, [section]: false }));
  // onSettle (not the save itself) closes edit mode, so the section stays
  // open long enough for the user to actually see the button's "Saved ✓"
  // state — closing immediately on success would unmount the button (and
  // the confirmation with it) in the same tick it appears.
  const personalSave = useSaveState({ onSettle: () => exitEditOnSettle("personal") });
  const shippingSave = useSaveState({ onSettle: () => exitEditOnSettle("shipping") });
  const paymentSave = useSaveState({ onSettle: () => exitEditOnSettle("payment") });

  // Payout info state — mobile money or bank transfer. Same draft/saved
  // split as `profile`/`savedProfile` above.
  const [payout, setPayout] = React.useState(emptyPayout(initialProfile));
  const [savedPayout, setSavedPayout] = React.useState(emptyPayout(initialProfile));
  const [editingPayout, setEditingPayout] = React.useState(false);
  const payoutSave = useSaveState({ onSettle: () => setEditingPayout(false) });
  const [banks, setBanks] = React.useState<Array<{ id: number; name: string; code: string }>>([]);
  const [paymentNameVerified, setPaymentNameVerified] = React.useState(
    profile.paymentInfo?.momoNameVerified ?? false,
  );
  const [payoutNameVerified, setPayoutNameVerified] = React.useState(false);
  const [paymentFieldErrors, setPaymentFieldErrors] = React.useState<Record<string, string>>({});
  const [payoutFieldErrors, setPayoutFieldErrors] = React.useState<Record<string, string>>({});

  // Fetch bank list once on mount
  React.useEffect(() => {
    fetch("/api/banks")
      .then((r) => r.json())
      .then((d: { data?: Array<{ id: number; name: string; code: string }> }) => {
        if (d.data) setBanks(d.data);
      })
      .catch(() => {/* non-fatal */});
  }, []);

  // MoMo name-enquiry for payment info section
  const paymentMomoResolve = useMomoResolve(
    profile.paymentInfo?.mobileMoneyNumber ?? "",
    profile.paymentInfo?.mobileMoneyNetwork ?? "",
  );
  React.useEffect(() => {
    if (paymentMomoResolve.status === "resolved" && paymentMomoResolve.resolvedName) {
      setProfile((p) => ({
        ...p,
        paymentInfo: { ...p.paymentInfo, accountName: paymentMomoResolve.resolvedName! },
      }));
      setPaymentNameVerified(true);
    } else if (paymentMomoResolve.status === "failed") {
      setPaymentNameVerified((prev) => {
        if (prev) {
          setProfile((p) => ({ ...p, paymentInfo: { ...p.paymentInfo, accountName: "" } }));
        }
        return false;
      });
    }
  }, [paymentMomoResolve.status, paymentMomoResolve.resolvedName]);

  // Name-enquiry hooks for payout section
  const payoutMomoResolve = useMomoResolve(
    payout.mobileMoneyNumber,
    payout.mobileMoneyNetwork,
  );
  const payoutBankResolve = useBankResolve(payout.accountNumber, payout.bankCode);

  React.useEffect(() => {
    if (payoutMomoResolve.status === "resolved" && payoutMomoResolve.resolvedName) {
      setPayout((p) => ({ ...p, accountName: payoutMomoResolve.resolvedName! }));
      setPayoutNameVerified(true);
    } else if (payoutMomoResolve.status === "failed") {
      setPayoutNameVerified((prev) => {
        if (prev) setPayout((p) => ({ ...p, accountName: "" }));
        return false;
      });
    }
  }, [payoutMomoResolve.status, payoutMomoResolve.resolvedName]);

  React.useEffect(() => {
    if (payoutBankResolve.status === "resolved" && payoutBankResolve.resolvedName) {
      setPayout((p) => ({ ...p, accountName: payoutBankResolve.resolvedName! }));
      setPayoutNameVerified(true);
    } else if (payoutBankResolve.status === "failed") {
      setPayoutNameVerified((prev) => {
        if (prev) setPayout((p) => ({ ...p, accountName: "" }));
        return false;
      });
    }
  }, [payoutBankResolve.status, payoutBankResolve.resolvedName]);

  const isAdmin = profile.role === "admin";
  const sellerSwitchChecked = isAdmin || profile.role === "vendor";
  const savedSellerAccess =
    isAdmin || (canCreateProductsRole(profile.role) && profile.sellerStatus === "active");

  const updateProfileField =
    (field: "name" | "email" | "phone") =>
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

  const startEdit = (section: ProfileSection) => setEditing((e) => ({ ...e, [section]: true }));

  // Sends the whole UpdateProfilePayload (the backend expects it in full)
  // but only `section`'s slice comes from the live draft — every other
  // section's slice comes from `savedProfile`, so a section mid-edit
  // elsewhere can never be saved accidentally by this call.
  const saveProfileSection = async (section: ProfileSection) => {
    const updated = await api.updateProfile({
      name: section === "personal" ? profile.name : savedProfile.name,
      email: section === "personal" ? profile.email : savedProfile.email,
      phone: section === "personal" ? profile.phone : savedProfile.phone,
      shippingAddress: section === "shipping" ? profile.shippingAddress : savedProfile.shippingAddress,
      paymentInfo: section === "payment" ? profile.paymentInfo : savedProfile.paymentInfo,
    });

    const slice: Partial<UserProfile> =
      section === "personal"
        ? { name: updated.name, email: updated.email, phone: updated.phone }
        : section === "shipping"
        ? { shippingAddress: updated.shippingAddress }
        : { paymentInfo: updated.paymentInfo };

    setProfile((p) => ({ ...p, ...slice }));
    setSavedProfile((p) => ({ ...p, ...slice }));

    if (section === "personal") {
      await update({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
    }
    router.refresh();
  };

  const handleSavePersonal = () => personalSave.run(() => saveProfileSection("personal"));

  const handleCancelPersonal = () => {
    setProfile((p) => ({ ...p, name: savedProfile.name, email: savedProfile.email, phone: savedProfile.phone }));
    personalSave.reset();
    setEditing((e) => ({ ...e, personal: false }));
  };

  const handleSaveShipping = () => shippingSave.run(() => saveProfileSection("shipping"));

  const handleCancelShipping = () => {
    setProfile((p) => ({ ...p, shippingAddress: savedProfile.shippingAddress }));
    shippingSave.reset();
    setEditing((e) => ({ ...e, shipping: false }));
  };

  const handleSavePayment = () => paymentSave.run(() => saveProfileSection("payment"));

  const handleCancelPayment = () => {
    setProfile((p) => ({ ...p, paymentInfo: savedProfile.paymentInfo }));
    setPaymentNameVerified(savedProfile.paymentInfo?.momoNameVerified ?? false);
    setPaymentFieldErrors({});
    paymentSave.reset();
    setEditing((e) => ({ ...e, payment: false }));
  };

  const handleSavePayout = async () => {
    const fieldErrs: Record<string, string> = {};
    if (!payout.accountName.trim()) fieldErrs.accountName = "Account name is required";
    if (payout.method === "mobile_money") {
      if (!payout.mobileMoneyNumber.trim()) {
        fieldErrs.mobileMoneyNumber = "Mobile money number is required";
      } else {
        const momoErr = validateMoMoNumber(payout.mobileMoneyNumber);
        if (momoErr) fieldErrs.mobileMoneyNumber = momoErr;
      }
    } else if (payout.method === "bank") {
      if (!payout.bankCode) fieldErrs.bankCode = "Select a bank";
      if (!payout.accountNumber.trim()) fieldErrs.accountNumber = "Account number is required";
    }
    setPayoutFieldErrors(fieldErrs);
    if (Object.keys(fieldErrs).length > 0) return;

    await payoutSave.run(async () => {
      const res = await fetch("/api/auth/payout-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payout, currency: "GHS" }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { detail?: string };
        throw new Error(d.detail ?? "Could not save payout info");
      }
      setPayoutFieldErrors({});
      setSavedPayout(payout);
    });
  };

  const handleCancelPayout = () => {
    setPayout(savedPayout);
    setPayoutNameVerified(false);
    setPayoutFieldErrors({});
    payoutSave.reset();
    setEditingPayout(false);
  };

  const canUploadDocs = profile.role === "vendor" && !isAdmin;

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
                  component={Link}
                  href="/vendor/apply"
                  variant="contained"
                  startIcon={<AddBusinessRounded />}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                >
                  Become a vendor
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

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 320px" },
            alignItems: "start",
          }}
        >
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
                <SectionHeader
                  icon={<AccountCircleRounded color="primary" />}
                  title="Personal details"
                  isEditing={editing.personal}
                  onEdit={() => startEdit("personal")}
                />
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
                    disabled={!editing.personal}
                    required
                  />
                  <TextField
                    label="Email"
                    type="email"
                    value={profile.email}
                    onChange={updateProfileField("email")}
                    disabled={!editing.personal}
                    required
                  />
                  <PhoneInput
                    label="Phone"
                    value={profile.phone}
                    onChange={(val) => setProfile((c) => ({ ...c, phone: val }))}
                    autoComplete="tel"
                    disabled={!editing.personal}
                  />
                  <TextField
                    label="Account type"
                    value={profile.role}
                    InputProps={{ readOnly: true }}
                    disabled
                  />
                </Box>
                {editing.personal && (
                  <Stack direction="row" spacing={1.5}>
                    <SaveButton status={personalSave.status} onClick={handleSavePersonal} />
                    <Button
                      variant="outlined"
                      disabled={personalSave.status === "saving"}
                      onClick={handleCancelPersonal}
                      sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                )}
                {personalSave.status === "error" && personalSave.errorMessage && (
                  <Alert severity="error">{personalSave.errorMessage}</Alert>
                )}
                {personalSave.status === "saved" && (
                  <Alert severity="success">Your profile was updated.</Alert>
                )}
              </Stack>
            </Paper>

            {profile.role !== "vendor" && !isAdmin && (
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack spacing={2} alignItems="center" sx={{ textAlign: "center", py: 1 }}>
                  <AddBusinessRounded color="primary" sx={{ fontSize: 48 }} />
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      Want to sell on Spree?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Set up your store in minutes with our guided application.
                    </Typography>
                  </Box>
                  <Button
                    component={Link}
                    href="/vendor/apply"
                    variant="contained"
                    size="large"
                    startIcon={<AddBusinessRounded />}
                    fullWidth
                    sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900, py: 1.5 }}
                  >
                    Apply to become a vendor
                  </Button>
                </Stack>
              </Paper>
            )}

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
                <SectionHeader
                  icon={<LocalShippingRounded color="primary" />}
                  title="Shipping information"
                  isEditing={editing.shipping}
                  onEdit={() => startEdit("shipping")}
                />
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
                    disabled={!editing.shipping}
                  />
                  <TextField
                    label="Address line 1"
                    value={profile.shippingAddress.addressLine1}
                    onChange={updateShippingField("addressLine1")}
                    disabled={!editing.shipping}
                  />
                  <TextField
                    label="Address line 2"
                    value={profile.shippingAddress.addressLine2}
                    onChange={updateShippingField("addressLine2")}
                    disabled={!editing.shipping}
                  />
                  <TextField
                    label="City"
                    value={profile.shippingAddress.city}
                    onChange={updateShippingField("city")}
                    disabled={!editing.shipping}
                  />
                  {(() => {
                    const country = profile.shippingAddress.country || "Ghana";
                    const regions = getRegionsForCountry(country);
                    const label = getRegionLabel(country);
                    return regions ? (
                      <FormControl disabled={!editing.shipping}>
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
                        disabled={!editing.shipping}
                      />
                    );
                  })()}
                  <TextField
                    label="Postal code"
                    value={profile.shippingAddress.postalCode}
                    onChange={updateShippingField("postalCode")}
                    disabled={!editing.shipping}
                  />
                  <FormControl disabled={!editing.shipping}>
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
                {editing.shipping && (
                  <Stack direction="row" spacing={1.5}>
                    <SaveButton status={shippingSave.status} onClick={handleSaveShipping} />
                    <Button
                      variant="outlined"
                      disabled={shippingSave.status === "saving"}
                      onClick={handleCancelShipping}
                      sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                )}
                {shippingSave.status === "error" && shippingSave.errorMessage && (
                  <Alert severity="error">{shippingSave.errorMessage}</Alert>
                )}
                {shippingSave.status === "saved" && (
                  <Alert severity="success">Your profile was updated.</Alert>
                )}
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
                <SectionHeader
                  icon={<PaymentRounded color="primary" />}
                  title="Payment information"
                  isEditing={editing.payment}
                  onEdit={() => startEdit("payment")}
                />
                <Alert severity="info">
                  Save reference details here, not full card numbers or sensitive payment secrets.
                </Alert>
                <TextField
                  select
                  label="Preferred method"
                  value={profile.paymentInfo.method}
                  onChange={(e) => {
                    updatePaymentField("method")(e as React.ChangeEvent<HTMLInputElement>);
                    setPaymentFieldErrors({});
                  }}
                  disabled={!editing.payment}
                >
                  <MenuItem value="mobile_money">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PhoneAndroidRounded fontSize="small" color="primary" />
                      <span>Mobile Money (MoMo)</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                </TextField>

                {profile.paymentInfo.method === "mobile_money" ? (
                  <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
                    <TextField
                      select
                      label="MoMo network"
                      value={profile.paymentInfo.mobileMoneyNetwork ?? MOMO_NETWORKS[0].value}
                      onChange={updatePaymentField("mobileMoneyNetwork")}
                      disabled={!editing.payment}
                      fullWidth
                    >
                      {MOMO_NETWORKS.map((n) => (
                        <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="MoMo number"
                      value={profile.paymentInfo.mobileMoneyNumber ?? ""}
                      onChange={(e) => {
                        updatePaymentField("mobileMoneyNumber")(e as React.ChangeEvent<HTMLInputElement>);
                        const err = validateMoMoNumber(e.target.value.trim());
                        setPaymentFieldErrors((prev) => ({ ...prev, mobileMoneyNumber: err ?? "" }));
                      }}
                      onBlur={() => {
                        const num = (profile.paymentInfo.mobileMoneyNumber ?? "").trim();
                        if (num) {
                          const err = validateMoMoNumber(num);
                          setPaymentFieldErrors((prev) => ({ ...prev, mobileMoneyNumber: err ?? "" }));
                        }
                      }}
                      error={!!paymentFieldErrors.mobileMoneyNumber}
                      helperText={paymentFieldErrors.mobileMoneyNumber || "10-digit Ghana number, e.g. 0241234567"}
                      slotProps={{ htmlInput: { inputMode: "tel" as const, maxLength: 13 } }}
                      placeholder="0241234567"
                      disabled={!editing.payment}
                      fullWidth
                    />
                    <TextField
                      label="Account name"
                      value={profile.paymentInfo.accountName ?? ""}
                      disabled={!editing.payment}
                      slotProps={{
                        input: {
                          readOnly: paymentNameVerified,
                          endAdornment: paymentMomoResolve.status === "loading" ? (
                            <InputAdornment position="end"><CircularProgress size={18} /></InputAdornment>
                          ) : paymentNameVerified ? (
                            <InputAdornment position="end">
                              <Chip icon={<CheckCircleRounded />} label="Verified" color="success" size="small" variant="outlined" />
                            </InputAdornment>
                          ) : null,
                        },
                      }}
                      onChange={(e) => {
                        updatePaymentField("accountName")(e as React.ChangeEvent<HTMLInputElement>);
                        setPaymentNameVerified(false);
                      }}
                      helperText={
                        paymentMomoResolve.status === "loading"
                          ? "Verifying account…"
                          : paymentMomoResolve.status === "failed"
                          ? `Auto-verify unavailable — enter name manually`
                          : paymentNameVerified
                          ? "Name verified via MoMo network"
                          : "Full name as it appears on the MoMo account"
                      }
                      fullWidth
                      sx={{ gridColumn: { md: "span 2" } }}
                    />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                    }}
                  >
                    <TextField
                      label="Cardholder / account name"
                      value={profile.paymentInfo.cardholderName}
                      onChange={updatePaymentField("cardholderName")}
                      disabled={!editing.payment}
                    />
                    <TextField
                      label="Card last 4"
                      value={profile.paymentInfo.cardLast4}
                      onChange={updatePaymentField("cardLast4")}
                      slotProps={{ htmlInput: { maxLength: 4 } }}
                      disabled={!editing.payment}
                    />
                    <TextField
                      label="Expiry month"
                      value={profile.paymentInfo.expiryMonth}
                      onChange={updatePaymentField("expiryMonth")}
                      slotProps={{ htmlInput: { maxLength: 2 } }}
                      disabled={!editing.payment}
                    />
                    <TextField
                      label="Expiry year"
                      value={profile.paymentInfo.expiryYear}
                      onChange={updatePaymentField("expiryYear")}
                      slotProps={{ htmlInput: { maxLength: 4 } }}
                      disabled={!editing.payment}
                    />
                    <TextField
                      label="Billing postal code"
                      value={profile.paymentInfo.billingPostalCode}
                      onChange={updatePaymentField("billingPostalCode")}
                      disabled={!editing.payment}
                    />
                  </Box>
                )}
                {editing.payment && (
                  <Stack direction="row" spacing={1.5}>
                    <SaveButton status={paymentSave.status} onClick={handleSavePayment} />
                    <Button
                      variant="outlined"
                      disabled={paymentSave.status === "saving"}
                      onClick={handleCancelPayment}
                      sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                )}
                {paymentSave.status === "error" && paymentSave.errorMessage && (
                  <Alert severity="error">{paymentSave.errorMessage}</Alert>
                )}
                {paymentSave.status === "saved" && (
                  <Alert severity="success">Your profile was updated.</Alert>
                )}
              </Stack>
            </Paper>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
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
              <PasskeyManager />
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
                      ? "Your store is temporarily paused. Review the vendor notice above before contacting admin."
                      : profile.sellerStatus === "removed"
                        ? "Your vendor access was removed. Buyer features still work, but product publishing is disabled."
                    : sellerSwitchChecked
                      ? "Your application is in review. An admin will activate your store soon."
                      : "Apply to become a vendor to start publishing products on Spree."}
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
                  Buyers can browse immediately. Vendors must register a store with identity details, and admins can monitor vendor health privately.
                  Approved vendors keep buyer checkout access while managing their storefront and product catalog.
                </Typography>
              </Stack>
            </Paper>

            {/* ── IDENTITY VERIFICATION STATUS ── */}
            {canUploadDocs && (
              <Paper
                elevation={0}
                sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <BadgeRounded color="primary" />
                    <Box>
                      <Typography variant="h5" fontWeight={900}>Identity verification</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Your identity is verified via NIA Ghana Card lookup and live face match during seller onboarding.
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

                  {profile.governmentIdVerified ? (
                    <Alert severity="success" sx={{ borderRadius: 2 }}>
                      Your identity has been verified.
                      {profile.niaVerifiedAt && (
                        <> Completed on {new Date(profile.niaVerifiedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}.</>
                      )}
                    </Alert>
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Identity verification is completed during the seller onboarding process.
                      If you need to re-verify, please contact support.
                    </Alert>
                  )}
                </Stack>
              </Paper>
            )}

            {/* ── PAYOUT INFO ── */}
            {(profile.role === "vendor" || isAdmin) && (
              <Paper
                elevation={0}
                sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
              >
                <Stack spacing={2.5}>
                  <SectionHeader
                    icon={<AccountBalanceRounded color="primary" />}
                    title="Payout account"
                    subtitle="Where Spree sends your earnings after a buyer confirms delivery. Your original listing price is transferred in full."
                    isEditing={editingPayout}
                    onEdit={() => setEditingPayout(true)}
                  />

                  {/* Method toggle */}
                  <Stack direction="row" spacing={1}>
                    {(["mobile_money", "bank"] as const).map((m) => (
                      <Button
                        key={m}
                        variant={payout.method === m ? "contained" : "outlined"}
                        size="small"
                        startIcon={m === "mobile_money" ? <PhoneAndroidRounded fontSize="small" /> : <AccountBalanceRounded fontSize="small" />}
                        onClick={() => { setPayout((p) => ({ ...p, method: m })); setPayoutNameVerified(false); }}
                        disabled={!editingPayout}
                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                      >
                        {m === "mobile_money" ? "Mobile money" : "Bank account"}
                      </Button>
                    ))}
                  </Stack>

                  <Divider />

                  {payout.method === "mobile_money" ? (
                    <Stack spacing={2}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                          select
                          label="Network"
                          value={payout.mobileMoneyNetwork}
                          onChange={(e) => { setPayout((p) => ({ ...p, mobileMoneyNetwork: e.target.value })); setPayoutNameVerified(false); }}
                          disabled={!editingPayout}
                          size="small"
                          sx={{ minWidth: 180 }}
                        >
                          {MOMO_NETWORKS.map((n) => (
                            <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Mobile money number"
                          value={payout.mobileMoneyNumber}
                          onChange={(e) => { setPayout((p) => ({ ...p, mobileMoneyNumber: e.target.value })); setPayoutNameVerified(false); }}
                          onBlur={() => {
                            if (payout.mobileMoneyNumber.trim()) {
                              const err = validateMoMoNumber(payout.mobileMoneyNumber.trim());
                              setPayoutFieldErrors((prev) => ({ ...prev, mobileMoneyNumber: err ?? "" }));
                            }
                          }}
                          error={!!payoutFieldErrors.mobileMoneyNumber}
                          helperText={payoutFieldErrors.mobileMoneyNumber || "10-digit Ghana number, e.g. 0241234567"}
                          disabled={!editingPayout}
                          size="small"
                          fullWidth
                          placeholder="0241234567"
                          slotProps={{ htmlInput: { inputMode: "tel", maxLength: 13 } }}
                        />
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack spacing={2}>
                      <TextField
                        select={banks.length > 0}
                        label="Bank"
                        value={payout.bankCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const found = banks.find((b) => b.code === code);
                          setPayout((p) => ({ ...p, bankCode: code, bankName: found?.name ?? code }));
                          setPayoutNameVerified(false);
                        }}
                        disabled={!editingPayout}
                        size="small"
                        fullWidth
                        error={!!payoutFieldErrors.bankCode}
                        helperText={payoutFieldErrors.bankCode}
                      >
                        {banks.map((b) => (
                          <MenuItem key={b.code} value={b.code}>{b.name}</MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Account number"
                        value={payout.accountNumber}
                        onChange={(e) => { setPayout((p) => ({ ...p, accountNumber: e.target.value.replace(/\D/g, "") })); setPayoutNameVerified(false); }}
                        disabled={!editingPayout}
                        size="small"
                        fullWidth
                        placeholder="0123456789"
                        error={!!payoutFieldErrors.accountNumber}
                        helperText={payoutFieldErrors.accountNumber || "10-digit bank account number"}
                        slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 13 } }}
                      />
                    </Stack>
                  )}

                  {/* Account name — shared by both methods; auto-populated via resolve hooks */}
                  {(() => {
                    const resolving =
                      payout.method === "mobile_money"
                        ? payoutMomoResolve.status === "loading"
                        : payoutBankResolve.status === "loading";
                    const resolveFailed =
                      payout.method === "mobile_money"
                        ? payoutMomoResolve.status === "failed"
                        : payoutBankResolve.status === "failed";
                    return (
                      <TextField
                        label="Account name"
                        value={payout.accountName}
                        disabled={!editingPayout}
                        slotProps={{
                          input: {
                            readOnly: payoutNameVerified,
                            endAdornment: resolving ? (
                              <InputAdornment position="end"><CircularProgress size={18} /></InputAdornment>
                            ) : payoutNameVerified ? (
                              <InputAdornment position="end">
                                <Chip icon={<CheckCircleRounded />} label="Verified" color="success" size="small" variant="outlined" />
                              </InputAdornment>
                            ) : null,
                          },
                        }}
                        onChange={(e) => {
                          setPayout((p) => ({ ...p, accountName: e.target.value }));
                          setPayoutNameVerified(false);
                        }}
                        error={!!payoutFieldErrors.accountName}
                        helperText={
                          resolving
                            ? "Verifying account…"
                            : resolveFailed
                            ? "Auto-verify unavailable — enter name manually"
                            : payoutFieldErrors.accountName ||
                              (payoutNameVerified ? "Name verified" : "Full name as it appears on the account")
                        }
                        size="small"
                        fullWidth
                      />
                    );
                  })()}

                  {editingPayout && (
                    <Stack direction="row" spacing={1.5}>
                      <SaveButton status={payoutSave.status} onClick={handleSavePayout} idleLabel="Save payout account" />
                      <Button
                        variant="outlined"
                        disabled={payoutSave.status === "saving"}
                        onClick={handleCancelPayout}
                        sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  )}
                  {payoutSave.status === "error" && payoutSave.errorMessage && (
                    <Alert severity="error">{payoutSave.errorMessage}</Alert>
                  )}
                  {payoutSave.status === "saved" && (
                    <Alert severity="success">
                      Payout account saved. Funds will be sent here after delivery confirmation.
                    </Alert>
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
        </Box>
      </Stack>

    </Box>
  );
}
