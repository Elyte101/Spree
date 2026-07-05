'use client';

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  BadgeRounded,
  CheckCircleRounded,
  CheckRounded,
  CloseRounded,
  ContactPhoneRounded,
  LocalShippingRounded,
  PaymentRounded,
  PhoneAndroidRounded,
  PlaceRounded,
  SendRounded,
  StoreRounded,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { PhoneInput } from "@/components/ui/phoneInput";
import {
  GHANA_ID_TYPES, GHANA_ID_SPECS, applyIdFormat, initialIdValue,
  COUNTRY_LIST, getRegionsForCountry, getRegionLabel,
  MOMO_NETWORKS, validateMoMoNumber,
} from "@/lib/ghana";
import { GovernmentIdType, SellerType, UserProfile } from "@/types/types";
import { useMomoResolve } from "@/lib/hooks/useMomoResolve";
import { Step4Identity } from "@/components/vendor/steps/Step4Identity";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardData {
  name: string;
  email: string;
  storeName: string;
  storeTagline: string;
  sellerType: SellerType;
  storeDescription: string;
  storeAddressLine1: string;
  storeCity: string;
  storeState: string;
  storePostalCode: string;
  storeCountry: string;
  businessEmail: string;
  businessPhone: string;
  whatsapp: string;
  registrationNumber: string;
  shipFullName: string;
  shipAddressLine1: string;
  shipAddressLine2: string;
  shipCity: string;
  shipState: string;
  shipPostalCode: string;
  shipCountry: string;
  paymentMethod: "card" | "bank-transfer" | "mobile_money";
  momoProvider: string;
  momoNumber: string;
  momoAccountName: string;
  momoNameVerified: boolean;
  cardholderName: string;
  cardLast4: string;
  expiryMonth: string;
  expiryYear: string;
  billingPostalCode: string;
  governmentIdType: GovernmentIdType;
  governmentIdNumber: string;
}

type StepErrors = Record<string, string>;

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAFT_KEY = "spree-vendor-wizard-draft";

const STEP_LABELS = [
  "Get Started",
  "Your Store",
  "Location",
  "Business",
  "Shipping",
  "Payment",
  "Identity",
  "Review",
];

const STEP_ICONS = [
  null,
  <StoreRounded key="store" fontSize="inherit" />,
  <PlaceRounded key="place" fontSize="inherit" />,
  <ContactPhoneRounded key="contact" fontSize="inherit" />,
  <LocalShippingRounded key="shipping" fontSize="inherit" />,
  <PaymentRounded key="payment" fontSize="inherit" />,
  <BadgeRounded key="badge" fontSize="inherit" />,
  <CheckRounded key="check" fontSize="inherit" />,
];

// Maps server field names to wizard step indexes for 422 routing
const FIELD_TO_STEP: Record<string, number> = {
  name: 0, email: 0,
  storeName: 1, storeDescription: 1, sellerType: 1,
  "storeLocation.addressLine1": 2, "storeLocation.city": 2,
  "storeLocation.state": 2, "storeLocation.country": 2,
  "sellerContact.businessPhone": 3, "sellerContact.businessEmail": 3,
  "shippingAddress.addressLine1": 4,
  "paymentInfo.method": 5,
  "sellerIdentity.governmentIdType": 6, "sellerIdentity.governmentIdNumber": 6,
};

// ── LocalStorage helpers ───────────────────────────────────────────────────────

interface DraftPayload extends WizardData { _step?: number }

function saveDraft(data: WizardData, step: number) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, _step: step })); } catch { /* quota / SSR */ }
}

function loadDraft(): DraftPayload | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftPayload) : null;
  } catch { return null; }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ── Error serialisation ────────────────────────────────────────────────────────

function toErrorMessage(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" && "msg" in d) ? String((d as { msg: unknown }).msg) : null)
      .filter(Boolean) as string[];
    return msgs.length ? msgs.join("; ") : "Validation failed — please check your information.";
  }
  return "An unexpected error occurred. Please try again.";
}

// ── Step validation ────────────────────────────────────────────────────────────

function validateStep(step: number, data: WizardData): StepErrors {
  const e: StepErrors = {};
  if (step === 0) {
    if (!data.name.trim()) e.name = "Display name is required.";
    if (!data.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = "Enter a valid email address.";
  }
  if (step === 1) {
    if (!data.storeName.trim()) e.storeName = "Store name is required.";
    if (!data.storeDescription.trim()) e.storeDescription = "Store description is required.";
  }
  if (step === 2) {
    if (!data.storeAddressLine1.trim()) e.storeAddressLine1 = "Address is required.";
    if (!data.storeCity.trim()) e.storeCity = "City is required.";
    if (!data.storeCountry.trim()) e.storeCountry = "Country is required.";
    if (!data.storeState.trim()) e.storeState = "Region / state is required.";
  }
  if (step === 3) {
    if (!data.businessPhone.trim()) e.businessPhone = "Business phone is required.";
  }
  if (step === 5 && data.paymentMethod === "mobile_money") {
    if (!data.momoNumber.trim()) {
      e.momoNumber = "MoMo number is required.";
    } else {
      const momoErr = validateMoMoNumber(data.momoNumber.trim());
      if (momoErr) e.momoNumber = momoErr;
    }
  }
  // Step 6 (Identity) validation is handled entirely by Step4Identity — it only
  // calls onSubmit after NIA lookup + face-verify succeed, so no manual check here.
  return e;
}

// ── Initial data from profile + draft ─────────────────────────────────────────

function buildInitialStep(): number {
  const d = loadDraft();
  // Never restore directly to the Review step (step 7) — user should confirm
  const saved = d?._step ?? 0;
  return Math.min(saved, STEP_LABELS.length - 2);
}

function buildInitialData(profile: UserProfile): WizardData {
  const d = loadDraft();
  return {
    name:               d?.name               ?? profile.name               ?? "",
    email:              d?.email              ?? profile.email              ?? "",
    storeName:          d?.storeName          ?? profile.storeName          ?? "",
    storeTagline:       d?.storeTagline       ?? profile.storeTagline       ?? "",
    sellerType:         d?.sellerType         ?? profile.sellerType         ?? "retail",
    storeDescription:   d?.storeDescription   ?? profile.storeDescription   ?? "",
    storeAddressLine1:  d?.storeAddressLine1  ?? profile.storeLocation?.addressLine1 ?? "",
    storeCity:          d?.storeCity          ?? profile.storeLocation?.city         ?? "",
    storeState:         d?.storeState         ?? profile.storeLocation?.state        ?? "",
    storePostalCode:    d?.storePostalCode    ?? profile.storeLocation?.postalCode   ?? "",
    storeCountry:       (d?.storeCountry      ?? profile.storeLocation?.country)     || "Ghana",
    businessEmail:      d?.businessEmail      ?? profile.sellerContact?.businessEmail     ?? "",
    businessPhone:      d?.businessPhone      ?? profile.sellerContact?.businessPhone     ?? "",
    whatsapp:           d?.whatsapp           ?? profile.sellerContact?.whatsapp          ?? "",
    registrationNumber: d?.registrationNumber ?? profile.sellerContact?.registrationNumber ?? "",
    shipFullName:       d?.shipFullName       ?? profile.shippingAddress?.fullName      ?? "",
    shipAddressLine1:   d?.shipAddressLine1   ?? profile.shippingAddress?.addressLine1  ?? "",
    shipAddressLine2:   d?.shipAddressLine2   ?? profile.shippingAddress?.addressLine2  ?? "",
    shipCity:           d?.shipCity           ?? profile.shippingAddress?.city          ?? "",
    shipState:          d?.shipState          ?? profile.shippingAddress?.state         ?? "",
    shipPostalCode:     d?.shipPostalCode     ?? profile.shippingAddress?.postalCode    ?? "",
    shipCountry:        (d?.shipCountry       ?? profile.shippingAddress?.country)      || "Ghana",
    paymentMethod:      (d?.paymentMethod      ?? profile.paymentInfo?.method            ?? "mobile_money") as WizardData["paymentMethod"],
    momoProvider:       d?.momoProvider       ?? profile.paymentInfo?.mobileMoneyNetwork ?? MOMO_NETWORKS[0].value,
    momoNumber:         d?.momoNumber         ?? profile.paymentInfo?.mobileMoneyNumber  ?? "",
    momoAccountName:    d?.momoAccountName    ?? profile.paymentInfo?.accountName        ?? "",
    momoNameVerified:   d?.momoNameVerified   ?? profile.paymentInfo?.momoNameVerified   ?? false,
    cardholderName:     d?.cardholderName     ?? profile.paymentInfo?.cardholderName    ?? "",
    cardLast4:          d?.cardLast4          ?? profile.paymentInfo?.cardLast4         ?? "",
    expiryMonth:        d?.expiryMonth        ?? profile.paymentInfo?.expiryMonth       ?? "",
    expiryYear:         d?.expiryYear         ?? profile.paymentInfo?.expiryYear        ?? "",
    billingPostalCode:  d?.billingPostalCode  ?? profile.paymentInfo?.billingPostalCode ?? "",
    governmentIdType:   d?.governmentIdType   ?? profile.governmentIdType               ?? "ghana-card",
    governmentIdNumber: initialIdValue(
      d?.governmentIdType ?? profile.governmentIdType ?? "ghana-card",
      d?.governmentIdNumber ?? profile.governmentIdNumber ?? "",
    ),
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// Country/Region selects render inside the page (not inside a Dialog), so z-index is just 1
const MENU_SX = { "& .MuiPaper-root": { bgcolor: "background.paper", maxHeight: 300 } };

function CountrySelect({ value, onChange, error, required }: {
  value: string; onChange: (v: string) => void; error?: string; required?: boolean;
}) {
  return (
    <FormControl fullWidth error={!!error} required={required}>
      <InputLabel>Country</InputLabel>
      <Select label="Country" value={value || "Ghana"} onChange={(e) => onChange(e.target.value)} MenuProps={{ sx: MENU_SX }}>
        {COUNTRY_LIST.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}

function RegionSelect({ country, value, onChange, error, required }: {
  country: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean;
}) {
  const regions = getRegionsForCountry(country);
  const label = getRegionLabel(country);
  if (regions) {
    return (
      <FormControl fullWidth error={!!error} required={required}>
        <InputLabel>{label}</InputLabel>
        <Select label={label} value={value} onChange={(e) => onChange(e.target.value)} MenuProps={{ sx: MENU_SX }}>
          {regions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }
  return (
    <TextField label={label} value={value} onChange={(e) => onChange(e.target.value)}
      error={!!error} helperText={error} required={required} fullWidth />
  );
}

// ── Wizard page component ─────────────────────────────────────────────────────

export function VendorApplicationWizard({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { update } = useSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [step, setStep] = React.useState(() => buildInitialStep());
  const [data, setData] = React.useState<WizardData>(() => buildInitialData(profile));
  const [errors, setErrors] = React.useState<StepErrors>({});
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(() => {
    const s = buildInitialStep();
    return new Set(Array.from({ length: s }, (_, i) => i));
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  // Auto-save draft (include current step so it survives page reload)
  React.useEffect(() => { saveDraft(data, step); }, [data, step]);

  // MoMo name-enquiry
  const momoResolve = useMomoResolve(data.momoNumber, data.momoProvider);
  React.useEffect(() => {
    if (momoResolve.status === "resolved" && momoResolve.resolvedName) {
      setData((d) => ({ ...d, momoAccountName: momoResolve.resolvedName!, momoNameVerified: true }));
    } else if (momoResolve.status === "failed") {
      // Clear any previously auto-verified name (e.g. stale mock value from draft)
      setData((d) => d.momoNameVerified ? { ...d, momoAccountName: "", momoNameVerified: false } : d);
    }
  }, [momoResolve.status, momoResolve.resolvedName]);

  const updateField = <K extends keyof WizardData>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setData((d) => ({ ...d, [field]: e.target.value }));

  const setField = <K extends keyof WizardData>(field: K, value: WizardData[K]) =>
    setData((d) => ({ ...d, [field]: value }));

  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleNext = () => {
    const errs = validateStep(step, data);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setCompletedSteps((s) => new Set([...s, step]));
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Called by Step4Identity when NIA lookup + face-verify both succeed.
  const handleIdentityComplete = async (idData: { governmentIdType?: GovernmentIdType; governmentIdNumber?: string }) => {
    setData((d) => ({
      ...d,
      governmentIdType: idData.governmentIdType ?? d.governmentIdType,
      governmentIdNumber: idData.governmentIdNumber ?? d.governmentIdNumber,
    }));
    setCompletedSteps((s) => new Set([...s, 6]));
    setStep(7);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setErrors({});
    if (step === 0) {
      router.push("/profile");
    } else {
      setStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleStepClick = (idx: number) => {
    if (completedSteps.has(idx) || idx === step) {
      setErrors({});
      setStep(idx);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerError(null);

    try {
      const payload = {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: profile.phone ?? "",
        isSeller: true,
        storeName: data.storeName.trim(),
        sellerType: data.sellerType,
        storeTagline: data.storeTagline.trim(),
        storeDescription: data.storeDescription.trim(),
        storeLocation: {
          addressLine1: data.storeAddressLine1.trim(),
          city: data.storeCity.trim(),
          state: data.storeState.trim(),
          postalCode: data.storePostalCode.trim(),
          country: data.storeCountry || "Ghana",
        },
        sellerContact: {
          businessEmail: data.businessEmail.trim(),
          businessPhone: data.businessPhone,
          whatsapp: data.whatsapp,
          registrationNumber: data.registrationNumber.trim(),
        },
        sellerIdentity: {
          governmentIdType: data.governmentIdType,
          governmentIdNumber: data.governmentIdNumber.trim(),
          storeTagline: data.storeTagline.trim(),
        },
        shippingAddress: {
          fullName: data.shipFullName.trim(),
          addressLine1: data.shipAddressLine1.trim(),
          addressLine2: data.shipAddressLine2.trim(),
          city: data.shipCity.trim(),
          state: data.shipState.trim(),
          postalCode: data.shipPostalCode.trim(),
          country: data.shipCountry || "Ghana",
        },
        paymentInfo: {
          method: data.paymentMethod,
          ...(data.paymentMethod === "mobile_money"
            ? {
                mobileMoneyNetwork: data.momoProvider,
                mobileMoneyNumber: data.momoNumber.trim(),
                accountName: data.momoAccountName.trim(),
                momoNameVerified: data.momoNameVerified,
                currency: "GHS",
              }
            : {
                cardholderName: data.cardholderName.trim(),
                cardLast4: data.cardLast4.trim(),
                expiryMonth: data.expiryMonth.trim(),
                expiryYear: data.expiryYear.trim(),
                billingPostalCode: data.billingPostalCode.trim(),
              }),
        },
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { detail?: unknown; errors?: Record<string, string> };
        if (res.status === 422 && body.errors) {
          for (const [field, msg] of Object.entries(body.errors)) {
            const stepIdx = FIELD_TO_STEP[field];
            if (stepIdx !== undefined) {
              setStep(stepIdx);
              setErrors({ [field]: String(msg) });
              setServerError(null);
              return;
            }
          }
        }
        throw new Error(body.detail !== undefined
          ? toErrorMessage(body.detail)
          : `Save failed (${res.status}). Please try again.`);
      }

      clearDraft();
      setSubmitSuccess(true);
      await update();
      setTimeout(() => router.push("/profile"), 2400);
    } catch (err) {
      console.error("[VendorApplicationWizard] submit error:", err);
      setServerError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step content ───────────────────────────────────────────────────────────

  const steps: React.ReactNode[] = [
    /* 0 */
    <Stack key="s0" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Let us know who you are. This name and email will appear on your store.
      </Typography>
      <TextField label="Display name" value={data.name} required fullWidth autoFocus
        onChange={(e) => { updateField("name")(e); clearError("name"); }}
        error={!!errors.name} helperText={errors.name}
        inputProps={{ "aria-invalid": !!errors.name }} />
      <TextField label="Email address" type="email" value={data.email} required fullWidth
        onChange={(e) => { updateField("email")(e); clearError("email"); }}
        error={!!errors.email} helperText={errors.email}
        inputProps={{ "aria-invalid": !!errors.email }} />
    </Stack>,

    /* 1 */
    <Stack key="s1" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        What is your store called, and what do you sell?
      </Typography>
      <TextField label="Store name" value={data.storeName} required fullWidth autoFocus
        onChange={(e) => { updateField("storeName")(e); clearError("storeName"); }}
        error={!!errors.storeName} helperText={errors.storeName} />
      <TextField label="Store tagline" value={data.storeTagline} fullWidth
        onChange={updateField("storeTagline")} placeholder="One line that sums up your shop" />
      <FormControl fullWidth>
        <InputLabel>Sell as</InputLabel>
        <Select label="Sell as" value={data.sellerType}
          onChange={(e) => setField("sellerType", e.target.value as SellerType)}
          MenuProps={{ sx: MENU_SX }}>
          <MenuItem value="retail">Retail vendor</MenuItem>
          <MenuItem value="wholesale">Wholesale vendor</MenuItem>
        </Select>
      </FormControl>
      <TextField label="Store description" value={data.storeDescription} required multiline minRows={3} fullWidth
        onChange={(e) => { updateField("storeDescription")(e); clearError("storeDescription"); }}
        error={!!errors.storeDescription} helperText={errors.storeDescription}
        placeholder="What do you sell? Who is your store for?" />
    </Stack>,

    /* 2 */
    <Stack key="s2" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Where is your store based? This helps buyers know where orders ship from.
      </Typography>
      <TextField label="Store address" value={data.storeAddressLine1} required fullWidth autoFocus
        onChange={(e) => { updateField("storeAddressLine1")(e); clearError("storeAddressLine1"); }}
        error={!!errors.storeAddressLine1} helperText={errors.storeAddressLine1} />
      <TextField label="City" value={data.storeCity} required fullWidth
        onChange={(e) => { updateField("storeCity")(e); clearError("storeCity"); }}
        error={!!errors.storeCity} helperText={errors.storeCity} />
      <CountrySelect value={data.storeCountry}
        onChange={(v) => { setData((d) => ({ ...d, storeCountry: v, storeState: "" })); clearError("storeCountry"); }}
        error={errors.storeCountry} required />
      <RegionSelect country={data.storeCountry || "Ghana"} value={data.storeState}
        onChange={(v) => { setData((d) => ({ ...d, storeState: v })); clearError("storeState"); }}
        error={errors.storeState} required />
      <TextField label="Postal code (optional)" value={data.storePostalCode} fullWidth
        onChange={updateField("storePostalCode")} />
    </Stack>,

    /* 3 */
    <Stack key="s3" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        How should buyers and Spree reach you for business matters?
      </Typography>
      <TextField label="Business email (optional)" type="email" value={data.businessEmail} fullWidth autoFocus
        onChange={updateField("businessEmail")} />
      <Box>
        <PhoneInput label="Business phone" value={data.businessPhone} required
          onChange={(v) => { setData((d) => ({ ...d, businessPhone: v })); clearError("businessPhone"); }} />
        {errors.businessPhone && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
            {errors.businessPhone}
          </Typography>
        )}
      </Box>
      <PhoneInput label="WhatsApp (optional)" value={data.whatsapp}
        onChange={(v) => setData((d) => ({ ...d, whatsapp: v }))} />
      <TextField label="Business registration number (optional)" value={data.registrationNumber} fullWidth
        onChange={updateField("registrationNumber")} helperText="Leave blank for sole traders" />
    </Stack>,

    /* 4 */
    <Stack key="s4" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Where should orders be sent for dispatching? You can update this later.
      </Typography>
      <TextField label="Full name" value={data.shipFullName} fullWidth autoFocus onChange={updateField("shipFullName")} />
      <TextField label="Address line 1" value={data.shipAddressLine1} fullWidth onChange={updateField("shipAddressLine1")} />
      <TextField label="Address line 2 (optional)" value={data.shipAddressLine2} fullWidth onChange={updateField("shipAddressLine2")} />
      <TextField label="City" value={data.shipCity} fullWidth onChange={updateField("shipCity")} />
      <CountrySelect value={data.shipCountry}
        onChange={(v) => setData((d) => ({ ...d, shipCountry: v, shipState: "" }))} />
      <RegionSelect country={data.shipCountry || "Ghana"} value={data.shipState}
        onChange={(v) => setData((d) => ({ ...d, shipState: v }))} />
      <TextField label="Postal code (optional)" value={data.shipPostalCode} fullWidth onChange={updateField("shipPostalCode")} />
    </Stack>,

    /* 5 */
    <Stack key="s5" spacing={2.5}>
      <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
        This is how Spree will pay you after each sale. You can update it later in your profile settings.
      </Alert>
      <FormControl fullWidth>
        <InputLabel>Payout method</InputLabel>
        <Select label="Payout method" value={data.paymentMethod}
          onChange={(e) => setField("paymentMethod", e.target.value as WizardData["paymentMethod"])}
          MenuProps={{ sx: MENU_SX }}>
          <MenuItem value="mobile_money">
            <Stack direction="row" alignItems="center" spacing={1}>
              <PhoneAndroidRounded fontSize="small" color="primary" />
              <span>Mobile Money (MoMo)</span>
            </Stack>
          </MenuItem>
          <MenuItem value="bank-transfer">Bank transfer</MenuItem>
          <MenuItem value="card">Card</MenuItem>
        </Select>
      </FormControl>

      {data.paymentMethod === "mobile_money" ? (
        <>
          <FormControl fullWidth>
            <InputLabel>MoMo network</InputLabel>
            <Select label="MoMo network" value={data.momoProvider}
              onChange={(e) => setData((d) => ({ ...d, momoProvider: e.target.value }))}
              MenuProps={{ sx: MENU_SX }}>
              {MOMO_NETWORKS.map((n) => <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="MoMo number"
            value={data.momoNumber}
            fullWidth
            required
            placeholder="0241234567"
            onChange={(e) => { setData((d) => ({ ...d, momoNumber: e.target.value })); clearError("momoNumber"); }}
            onBlur={() => {
              if (data.momoNumber.trim()) {
                const err = validateMoMoNumber(data.momoNumber.trim());
                if (err) setErrors((prev) => ({ ...prev, momoNumber: err }));
              }
            }}
            error={!!errors.momoNumber}
            helperText={errors.momoNumber || "10-digit Ghana number, e.g. 0241234567"}
            inputProps={{ inputMode: "tel", maxLength: 13 }}
          />
          <TextField
            label="Account name"
            value={data.momoAccountName}
            fullWidth
            slotProps={{
              input: {
                readOnly: data.momoNameVerified,
                endAdornment: momoResolve.status === "loading" ? (
                  <InputAdornment position="end"><CircularProgress size={18} /></InputAdornment>
                ) : data.momoNameVerified ? (
                  <InputAdornment position="end">
                    <Chip
                      icon={<CheckCircleRounded />}
                      label="Verified"
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  </InputAdornment>
                ) : null,
              },
            }}
            onChange={(e) => {
              setData((d) => ({ ...d, momoAccountName: e.target.value, momoNameVerified: false }));
            }}
            helperText={
              momoResolve.status === "loading"
                ? "Verifying account…"
                : momoResolve.status === "failed"
                ? `Auto-verify unavailable (${momoResolve.failReason ?? "lookup failed"}) — enter name manually`
                : data.momoNameVerified
                ? "Name verified via MoMo network"
                : "Full name as it appears on the MoMo account"
            }
          />
          {data.momoProvider && data.momoNumber && !errors.momoNumber && (
            <Alert severity="success" icon={false} sx={{ borderRadius: 2, py: 1 }}>
              Payouts will be sent to <strong>{data.momoAccountName}</strong> via <strong>{data.momoProvider}</strong>.
            </Alert>
          )}
          <Box sx={(theme) => ({ p: 1.5, borderRadius: 2, bgcolor: theme.palette.action.hover })}>
            <Typography variant="caption" color="text.secondary" lineHeight={1.7}>
              <strong>MTN Mobile Money:</strong> 024, 054, 055, 059<br />
              <strong>Telecel Cash (Telecel):</strong> 020, 050<br />
              <strong>AirtelTigo Money:</strong> 026, 027, 056, 057
            </Typography>
          </Box>
        </>
      ) : (
        <>
          <TextField label="Cardholder / account name" value={data.cardholderName} fullWidth onChange={updateField("cardholderName")} />
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(2, 1fr)" }}>
            <TextField label="Card last 4" value={data.cardLast4} onChange={updateField("cardLast4")} inputProps={{ maxLength: 4 }} />
            <TextField label="Billing postal code" value={data.billingPostalCode} onChange={updateField("billingPostalCode")} />
            <TextField label="Expiry month" value={data.expiryMonth} onChange={updateField("expiryMonth")} inputProps={{ maxLength: 2 }} placeholder="MM" />
            <TextField label="Expiry year" value={data.expiryYear} onChange={updateField("expiryYear")} inputProps={{ maxLength: 4 }} placeholder="YYYY" />
          </Box>
        </>
      )}
    </Stack>,

    /* 6 — Identity: NIA lookup + SmartSelfie face match */
    <Box key="s6">
      <Step4Identity
        profile={profile as Parameters<typeof Step4Identity>[0]["profile"]}
        onSubmit={handleIdentityComplete as Parameters<typeof Step4Identity>[0]["onSubmit"]}
        submitting={false}
      />
    </Box>,

    /* 7 — Review */
    <Stack key="s7" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Review your application before submitting. Click any section to make changes.
      </Typography>
      {typeof serverError === "string" && serverError.length > 0 && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>{serverError}</Alert>
      )}
      {submitSuccess && <Alert severity="success" sx={{ borderRadius: 2 }}>Application submitted! Returning to your profile…</Alert>}
      {[
        { title: "Account", idx: 0, rows: [["Display name", data.name], ["Email", data.email]] },
        { title: "Store", idx: 1, rows: [["Store name", data.storeName], ["Tagline", data.storeTagline], ["Sell as", data.sellerType === "retail" ? "Retail vendor" : "Wholesale vendor"], ["Description", data.storeDescription.slice(0, 80) + (data.storeDescription.length > 80 ? "…" : "")]] },
        { title: "Location", idx: 2, rows: [["Address", data.storeAddressLine1], ["City", data.storeCity], ["Region", data.storeState], ["Country", data.storeCountry]] },
        { title: "Business", idx: 3, rows: [["Business phone", data.businessPhone], ["Business email", data.businessEmail], ["WhatsApp", data.whatsapp]] },
        {
          title: "Payment",
          idx: 5,
          rows: data.paymentMethod === "mobile_money"
            ? [
                ["Method", "Mobile Money (MoMo)"],
                ["Network", MOMO_NETWORKS.find((n) => n.value === data.momoProvider)?.label ?? data.momoProvider],
                ["MoMo number", data.momoNumber],
                ["Account name", data.momoAccountName],
              ]
            : [
                ["Method", data.paymentMethod === "bank-transfer" ? "Bank transfer" : "Card"],
                ["Cardholder name", data.cardholderName],
                ["Card last 4", data.cardLast4 ? `•••• ${data.cardLast4}` : ""],
                ["Expiry", data.expiryMonth && data.expiryYear ? `${data.expiryMonth}/${data.expiryYear}` : ""],
              ],
        },
        { title: "Identity", idx: 6, rows: [["ID type", GHANA_ID_TYPES.find((t) => t.value === data.governmentIdType)?.label ?? ""], ["ID number", data.governmentIdNumber ? "••••••••" : ""], ["Verified", profile.governmentIdVerified ? "✓ NIA verified" : "Pending"]] },
      ].map(({ title, idx, rows }) => (
        <Box key={title} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"
            sx={{ px: 2, py: 1, bgcolor: "action.hover" }}>
            <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
            <Button size="small" onClick={() => handleStepClick(idx)}
              sx={{ textTransform: "none", fontWeight: 700 }}>Edit</Button>
          </Stack>
          <Stack spacing={1.25} sx={{ px: 2, py: 1.5 }}>
            {rows.filter(([, v]) => v).map(([label, value]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                <Typography variant="body2" fontWeight={600}>{value}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>,
  ];

  const isLastStep = step === STEP_LABELS.length - 1;
  const progressPct = Math.round((step / (STEP_LABELS.length - 1)) * 100);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={(theme) => ({
      minHeight: "100%",
      py: { xs: 3, md: 5 },
      background: theme.palette.mode === "dark"
        ? `radial-gradient(circle at top left, rgba(101,90,255,0.12) 0%, transparent 50%)`
        : `radial-gradient(circle at top left, rgba(101,90,255,0.06) 0%, transparent 50%)`,
    })}>
      <Container maxWidth="md">

        {/* Page header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: { xs: 3, md: 4 } }}>
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight={800} lineHeight={1} display="block">
              Vendor Application
            </Typography>
            <Typography variant="h4" fontWeight={900} color="text.primary" sx={{ mt: 0.25, lineHeight: 1.1, letterSpacing: "-0.025em" }}>
              Become a vendor
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Complete all steps to submit your store for review.
            </Typography>
          </Box>
          <IconButton
            component={Link}
            href="/profile"
            aria-label="Back to profile"
            sx={{ mt: 0.5 }}
          >
            <CloseRounded />
          </IconButton>
        </Stack>

        {/* ── Stepper ── */}

        {/* Mobile: linear progress bar + step label */}
        {isMobile && (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                Step {step + 1} of {STEP_LABELS.length}
              </Typography>
              <Typography variant="caption" color="primary.main" fontWeight={700}>
                {STEP_LABELS[step]}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progressPct}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}

        {/* Desktop: full alternativeLabel stepper */}
        {!isMobile && (
          <Box sx={{ mb: 4 }}>
            <Stepper activeStep={step} alternativeLabel nonLinear>
              {STEP_LABELS.map((label, idx) => (
                <Step key={label} completed={completedSteps.has(idx)}>
                  <StepButton
                    onClick={() => handleStepClick(idx)}
                    disabled={!completedSteps.has(idx) && idx !== step}
                    sx={{ py: 0.5, borderRadius: 2 }}
                  >
                    <StepLabel
                      sx={{
                        "& .MuiStepLabel-label": {
                          fontSize: "0.72rem",
                          fontWeight: completedSteps.has(idx) || idx === step ? 700 : 500,
                          lineHeight: 1.3,
                          mt: "4px !important",
                          whiteSpace: "nowrap",
                        },
                        "& .MuiStepLabel-iconContainer": { pb: 0 },
                      }}
                    >
                      {label}
                    </StepLabel>
                  </StepButton>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {/* Step card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {/* Step heading inside card */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.5 }}>
              <Box sx={(theme) => ({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: "primary.main",
                fontSize: 18,
                flexShrink: 0,
              })}>
                {STEP_ICONS[step]}
              </Box>
              <Typography variant="h5" fontWeight={800}>
                {STEP_LABELS[step]}
              </Typography>
            </Stack>
            {isMobile && (
              <Typography variant="caption" color="text.secondary">
                Step {step + 1} of {STEP_LABELS.length}
              </Typography>
            )}
          </Box>

          {/* Step body */}
          <Box role="region" aria-live="polite">
            {steps[step]}
          </Box>

          {/* Navigation */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 4, pt: 3, borderTop: "1px solid", borderColor: "divider" }}
          >
            <Button
              variant="outlined"
              startIcon={<ArrowBackRounded />}
              onClick={handleBack}
              disabled={submitting}
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
            >
              {step === 0 ? "Back to profile" : "Back"}
            </Button>

            {isLastStep ? (
              <Button
                variant="contained"
                disableElevation
                onClick={handleSubmit}
                disabled={submitting || submitSuccess}
                startIcon={
                  submitting
                    ? <CircularProgress size={15} color="inherit" />
                    : <SendRounded sx={{ fontSize: "16px !important" }} />
                }
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </Button>
            ) : step === 6 ? null : (
              <Button
                variant="contained"
                disableElevation
                endIcon={<ArrowForwardRounded />}
                onClick={handleNext}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
              >
                Next
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Draft notice */}
        <Typography variant="caption" color="text.disabled" textAlign="center" display="block" sx={{ mt: 2 }}>
          Your progress is saved automatically. You can come back any time.
        </Typography>

      </Container>
    </Box>
  );
}
