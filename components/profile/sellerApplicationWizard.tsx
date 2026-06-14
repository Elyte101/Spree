'use client';

import * as React from "react";
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  BadgeRounded,
  CheckRounded,
  CloseRounded,
  CloudUploadRounded,
  ContactPhoneRounded,
  DeleteOutlineRounded,
  LocalShippingRounded,
  PaymentRounded,
  PlaceRounded,
  SendRounded,
  StoreRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
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
import { GHANA_ID_TYPES, COUNTRY_LIST, getRegionsForCountry, getRegionLabel } from "@/lib/ghana";
import { GovernmentIdType, SellerType, UserProfile } from "@/types/types";

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
  paymentMethod: "card" | "paypal" | "bank-transfer";
  cardholderName: string;
  cardLast4: string;
  expiryMonth: string;
  expiryYear: string;
  billingPostalCode: string;
  governmentIdType: GovernmentIdType;
  governmentIdNumber: string;
}

type StepErrors = Record<string, string>;

interface ImgCheckResult {
  blocking: string[];
  warnings: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAFT_KEY = "spree-seller-wizard-draft";

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

// Maps server field names (from 422 responses) to wizard step indexes
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

function saveDraft(data: WizardData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* quota / SSR */ }
}

function loadDraft(): Partial<WizardData> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<WizardData>) : null;
  } catch { return null; }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ── Image validation (canvas-based, browser-only) ─────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function validateIdImage(
  file: File,
  slot: "front" | "back" | "selfie",
): Promise<ImgCheckResult> {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    blocking.push("Upload a JPEG, PNG, or WebP image.");
    return { blocking, warnings };
  }
  if (file.size < 30 * 1024) {
    blocking.push("Image is too small (minimum 30 KB). Use a higher-quality photo.");
  }
  if (file.size > 10 * 1024 * 1024) {
    blocking.push("Image exceeds 10 MB. Please compress it before uploading.");
  }
  if (blocking.length) return { blocking, warnings };

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    if (Math.max(w, h) < 1000) {
      blocking.push(`Resolution too low (${w}×${h} px). Long edge must be ≥1000 px.`);
    }

    if (slot !== "selfie") {
      const ratio = Math.max(w, h) / Math.min(w, h);
      if (ratio < 1.2 || ratio > 2.2) {
        warnings.push("Photograph the full ID card in landscape for best results.");
      }
    }

    // Scale down for fast analysis
    const scale = Math.min(1, 400 / Math.max(w, h, 1));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blocking, warnings };
    ctx.drawImage(img, 0, 0, cw, ch);
    const { data: px } = ctx.getImageData(0, 0, cw, ch);

    // Mean luminance
    let totalLum = 0;
    const count = cw * ch;
    for (let i = 0; i < px.length; i += 4) {
      totalLum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    }
    const meanLum = totalLum / count;
    if (meanLum < 45) blocking.push("Image is too dark. Retake in better lighting.");
    else if (meanLum > 240) warnings.push("Image may be overexposed — check that text is readable.");

    // Variance of Laplacian (sharpness)
    let lapSum = 0, lapSqSum = 0;
    const lapCount = (cw - 2) * (ch - 2);
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < cw - 1; x++) {
        const gray = (idx: number) =>
          0.299 * px[idx] + 0.587 * px[idx + 1] + 0.114 * px[idx + 2];
        const c = gray((y * cw + x) * 4);
        const t = gray(((y - 1) * cw + x) * 4);
        const b = gray(((y + 1) * cw + x) * 4);
        const l = gray((y * cw + (x - 1)) * 4);
        const r = gray((y * cw + (x + 1)) * 4);
        const lap = Math.abs(-4 * c + t + b + l + r);
        lapSum += lap;
        lapSqSum += lap * lap;
      }
    }
    const lapMean = lapSum / lapCount;
    const lapVar = lapSqSum / lapCount - lapMean * lapMean;
    if (lapVar < 40) {
      blocking.push("Image is blurry. Hold the camera still and ensure the ID is in sharp focus.");
    } else if (lapVar < 100) {
      warnings.push("Image may be slightly blurry — sharper photos speed up review.");
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  return { blocking, warnings };
}

// ── Step validation ────────────────────────────────────────────────────────────

function validateStep(
  step: number,
  data: WizardData,
  idFiles: { front: File | null; back: File | null; selfie: File | null },
  imgErrors: { front: ImgCheckResult; back: ImgCheckResult; selfie: ImgCheckResult },
): StepErrors {
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
    if (!data.businessPhone.trim() || data.businessPhone.trim() === "") {
      e.businessPhone = "Business phone is required.";
    }
  }
  if (step === 6) {
    if (!data.governmentIdType) e.governmentIdType = "Select your ID type.";
    if (!data.governmentIdNumber.trim()) e.governmentIdNumber = "ID number is required.";
    if (!idFiles.front) e.idFront = "Upload the front of your ID.";
    else if (imgErrors.front.blocking.length) e.idFront = imgErrors.front.blocking[0];
    if (!idFiles.back) e.idBack = "Upload the back of your ID.";
    else if (imgErrors.back.blocking.length) e.idBack = imgErrors.back.blocking[0];
    if (!idFiles.selfie) e.selfie = "Upload a selfie holding your ID.";
    else if (imgErrors.selfie.blocking.length) e.selfie = imgErrors.selfie.blocking[0];
  }
  return e;
}

// ── Initial data ──────────────────────────────────────────────────────────────

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
    storeCountry:       (d?.storeCountry       ?? profile.storeLocation?.country)      || "Ghana",
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
    shipCountry:        (d?.shipCountry        ?? profile.shippingAddress?.country)       || "Ghana",
    paymentMethod:      d?.paymentMethod      ?? profile.paymentInfo?.method            ?? "card",
    cardholderName:     d?.cardholderName     ?? profile.paymentInfo?.cardholderName    ?? "",
    cardLast4:          d?.cardLast4          ?? profile.paymentInfo?.cardLast4         ?? "",
    expiryMonth:        d?.expiryMonth        ?? profile.paymentInfo?.expiryMonth       ?? "",
    expiryYear:         d?.expiryYear         ?? profile.paymentInfo?.expiryYear        ?? "",
    billingPostalCode:  d?.billingPostalCode  ?? profile.paymentInfo?.billingPostalCode ?? "",
    governmentIdType:   d?.governmentIdType   ?? profile.governmentIdType               ?? "ghana-card",
    governmentIdNumber: d?.governmentIdNumber ?? profile.governmentIdNumber             ?? "",
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface DropzoneProps {
  label: string;
  icon: React.ReactNode;
  file: File | null;
  thumbnail: string | null;
  checking: boolean;
  error?: string;
  warning?: string;
  onFile: (f: File) => void;
  onClear: () => void;
}

function IdDropzone({ label, icon, file, thumbnail, checking, error, warning, onFile, onClear }: DropzoneProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <Box>
      <Box
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        sx={(theme) => ({
          position: "relative",
          minHeight: 120,
          borderRadius: 2,
          border: "2px dashed",
          borderColor: error
            ? "error.main"
            : dragging
              ? "primary.main"
              : theme.palette.divider,
          bgcolor: dragging ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          transition: "border-color 0.2s ease, background-color 0.2s ease",
          "&:focus-visible": {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        })}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        {thumbnail ? (
          <>
            <Box
              component="img"
              src={thumbnail}
              alt={label}
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Box
              sx={{
                position: "absolute", inset: 0,
                bgcolor: "rgba(0,0,0,0.38)",
                display: "flex", alignItems: "flex-end", p: 1,
              }}
            >
              <Typography variant="caption" color="white" fontWeight={700} noWrap sx={{ maxWidth: "100%" }}>
                {file?.name}
              </Typography>
            </Box>
          </>
        ) : (
          <Stack alignItems="center" spacing={0.75} sx={{ py: 1.5, px: 2, pointerEvents: "none" }}>
            {checking
              ? <CircularProgress size={24} />
              : <Box sx={{ fontSize: 32, color: "text.secondary", display: "flex" }}>{icon}</Box>
            }
            <Typography variant="body2" fontWeight={700} textAlign="center">{label}</Typography>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              Drag & drop or click<br />JPEG · PNG · WebP
            </Typography>
          </Stack>
        )}
      </Box>

      {file && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineRounded fontSize="small" />}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", minWidth: 0 }}
          >
            Remove
          </Button>
        </Box>
      )}

      {checking && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          Checking image quality…
        </Typography>
      )}
      {!checking && error && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {error}
        </Typography>
      )}
      {!checking && !error && warning && (
        <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
          {warning}
        </Typography>
      )}
    </Box>
  );
}

// Country + Region selects with proper dialog z-index
const MENU_SX = { zIndex: 1500, "& .MuiPaper-root": { bgcolor: "background.paper", maxHeight: 300 } };

interface CountrySelectProps {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
}

function CountrySelect({ value, onChange, error, required }: CountrySelectProps) {
  return (
    <FormControl fullWidth error={!!error} required={required}>
      <InputLabel>Country</InputLabel>
      <Select
        label="Country"
        value={value || "Ghana"}
        onChange={(e) => onChange(e.target.value)}
        MenuProps={{ sx: MENU_SX }}
      >
        {COUNTRY_LIST.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}

interface RegionSelectProps {
  country: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
}

function RegionSelect({ country, value, onChange, error, required }: RegionSelectProps) {
  const regions = getRegionsForCountry(country);
  const label = getRegionLabel(country);
  if (regions) {
    return (
      <FormControl fullWidth error={!!error} required={required}>
        <InputLabel>{label}</InputLabel>
        <Select
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          MenuProps={{ sx: MENU_SX }}
        >
          {regions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={!!error}
      helperText={error}
      required={required}
      fullWidth
    />
  );
}

// ── Wizard component ──────────────────────────────────────────────────────────

export interface SellerApplicationWizardProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSuccess: () => void;
}

export function SellerApplicationWizard({ open, onClose, profile, onSuccess }: SellerApplicationWizardProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState<WizardData>(() => buildInitialData(profile));
  const [errors, setErrors] = React.useState<StepErrors>({});
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set());
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  // Identity document files
  const [idFront, setIdFront] = React.useState<File | null>(null);
  const [idBack, setIdBack] = React.useState<File | null>(null);
  const [idSelfie, setIdSelfie] = React.useState<File | null>(null);
  const [thumbFront, setThumbFront] = React.useState<string | null>(null);
  const [thumbBack, setThumbBack] = React.useState<string | null>(null);
  const [thumbSelfie, setThumbSelfie] = React.useState<string | null>(null);
  const [checkingFront, setCheckingFront] = React.useState(false);
  const [checkingBack, setCheckingBack] = React.useState(false);
  const [checkingSelfie, setCheckingSelfie] = React.useState(false);
  const [errFront, setErrFront] = React.useState<ImgCheckResult>({ blocking: [], warnings: [] });
  const [errBack, setErrBack] = React.useState<ImgCheckResult>({ blocking: [], warnings: [] });
  const [errSelfie, setErrSelfie] = React.useState<ImgCheckResult>({ blocking: [], warnings: [] });

  // Auto-save draft
  React.useEffect(() => {
    if (open) saveDraft(data);
  }, [data, open]);

  // Reset when re-opened
  React.useEffect(() => {
    if (open) {
      setData(buildInitialData(profile));
      setStep(0);
      setErrors({});
      setCompletedSteps(new Set());
      setServerError(null);
      setSubmitSuccess(false);
      setIdFront(null); setIdBack(null); setIdSelfie(null);
      setThumbFront(null); setThumbBack(null); setThumbSelfie(null);
      setErrFront({ blocking: [], warnings: [] });
      setErrBack({ blocking: [], warnings: [] });
      setErrSelfie({ blocking: [], warnings: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      if (thumbFront) URL.revokeObjectURL(thumbFront);
      if (thumbBack) URL.revokeObjectURL(thumbBack);
      if (thumbSelfie) URL.revokeObjectURL(thumbSelfie);
    };
  }, [thumbFront, thumbBack, thumbSelfie]);

  const updateField = <K extends keyof WizardData>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setData((d) => ({ ...d, [field]: e.target.value }));

  const setField = <K extends keyof WizardData>(field: K, value: WizardData[K]) =>
    setData((d) => ({ ...d, [field]: value }));

  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  // ── File handling ──────────────────────────────────────────────────────────

  const handleIdFile = React.useCallback(async (
    slot: "front" | "back" | "selfie",
    file: File,
  ) => {
    const setFile = slot === "front" ? setIdFront : slot === "back" ? setIdBack : setIdSelfie;
    const setThumb = slot === "front" ? setThumbFront : slot === "back" ? setThumbBack : setThumbSelfie;
    const setChecking = slot === "front" ? setCheckingFront : slot === "back" ? setCheckingBack : setCheckingSelfie;
    const setImgErr = slot === "front" ? setErrFront : slot === "back" ? setErrBack : setErrSelfie;
    const errKey = slot === "front" ? "idFront" : slot === "back" ? "idBack" : "selfie";

    const prevThumb = slot === "front" ? thumbFront : slot === "back" ? thumbBack : thumbSelfie;
    if (prevThumb) URL.revokeObjectURL(prevThumb);

    const url = URL.createObjectURL(file);
    setFile(file);
    setThumb(url);
    setImgErr({ blocking: [], warnings: [] });
    setChecking(true);
    clearError(errKey);

    const result = await validateIdImage(file, slot);
    setImgErr(result);
    setChecking(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbFront, thumbBack, thumbSelfie]);

  const clearIdFile = (slot: "front" | "back" | "selfie") => {
    const setFile = slot === "front" ? setIdFront : slot === "back" ? setIdBack : setIdSelfie;
    const setThumb = slot === "front" ? setThumbFront : slot === "back" ? setThumbBack : setThumbSelfie;
    const prevThumb = slot === "front" ? thumbFront : slot === "back" ? thumbBack : thumbSelfie;
    const setImgErr = slot === "front" ? setErrFront : slot === "back" ? setErrBack : setErrSelfie;

    if (prevThumb) URL.revokeObjectURL(prevThumb);
    setFile(null);
    setThumb(null);
    setImgErr({ blocking: [], warnings: [] });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const idFiles = { front: idFront, back: idBack, selfie: idSelfie };
  const imgErrors = { front: errFront, back: errBack, selfie: errSelfie };

  const handleNext = () => {
    const errs = validateStep(step, data, idFiles, imgErrors);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setCompletedSteps((s) => new Set([...s, step]));
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  const handleStepClick = (idx: number) => {
    if (completedSteps.has(idx) || idx === step) {
      setErrors({});
      setStep(idx);
    }
  };

  const attemptClose = () => {
    const hasDraft = !!loadDraft();
    const isDirty = !!data.name || !!data.storeName || step > 0;
    if (hasDraft || isDirty) {
      setDiscardOpen(true);
    } else {
      onClose();
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerError(null);

    try {
      // Upload identity documents
      if (idFront || idBack || idSelfie) {
        const fd = new FormData();
        if (idFront) fd.append("id_front", idFront);
        if (idBack) fd.append("id_back", idBack);
        if (idSelfie) fd.append("selfie", idSelfie);
        const docsRes = await fetch("/api/auth/id-documents", { method: "POST", body: fd });
        if (!docsRes.ok) {
          const d = (await docsRes.json()) as { detail?: string };
          throw new Error(d.detail ?? "Document upload failed. Please try again.");
        }
      }

      // PUT profile
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
          cardholderName: data.cardholderName.trim(),
          cardLast4: data.cardLast4.trim(),
          expiryMonth: data.expiryMonth.trim(),
          expiryYear: data.expiryYear.trim(),
          billingPostalCode: data.billingPostalCode.trim(),
        },
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as {
          detail?: string;
          errors?: Record<string, string>;
        };
        // Route to the offending step on 422
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
        throw new Error(body.detail ?? `Save failed (${res.status}). Please try again.`);
      }

      clearDraft();
      setSubmitSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess();
      }, 2200);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step content ───────────────────────────────────────────────────────────

  const steps: React.ReactNode[] = [
    /* 0: Get Started */
    <Stack key="s0" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Let us know who you are. This name and email will be visible on your store.
      </Typography>
      <TextField
        label="Display name"
        value={data.name}
        onChange={(e) => { updateField("name")(e); clearError("name"); }}
        error={!!errors.name}
        helperText={errors.name}
        required
        fullWidth
        autoFocus
        inputProps={{ "aria-invalid": !!errors.name, "aria-describedby": errors.name ? "err-name" : undefined }}
      />
      <TextField
        label="Email address"
        type="email"
        value={data.email}
        onChange={(e) => { updateField("email")(e); clearError("email"); }}
        error={!!errors.email}
        helperText={errors.email}
        required
        fullWidth
        inputProps={{ "aria-invalid": !!errors.email }}
      />
    </Stack>,

    /* 1: Your Store */
    <Stack key="s1" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        What is your store called, and what do you sell?
      </Typography>
      <TextField
        label="Store name"
        value={data.storeName}
        onChange={(e) => { updateField("storeName")(e); clearError("storeName"); }}
        error={!!errors.storeName}
        helperText={errors.storeName}
        required
        fullWidth
        autoFocus
      />
      <TextField
        label="Store tagline"
        value={data.storeTagline}
        onChange={updateField("storeTagline")}
        placeholder="One line that sums up your shop"
        fullWidth
      />
      <FormControl fullWidth>
        <InputLabel>Sell as</InputLabel>
        <Select
          label="Sell as"
          value={data.sellerType}
          onChange={(e) => setField("sellerType", e.target.value as SellerType)}
          MenuProps={{ sx: MENU_SX }}
        >
          <MenuItem value="retail">Retail seller</MenuItem>
          <MenuItem value="wholesale">Wholesale seller</MenuItem>
        </Select>
      </FormControl>
      <TextField
        label="Store description"
        value={data.storeDescription}
        onChange={(e) => { updateField("storeDescription")(e); clearError("storeDescription"); }}
        error={!!errors.storeDescription}
        helperText={errors.storeDescription}
        required
        multiline
        minRows={3}
        fullWidth
        placeholder="What do you sell? Who is your store for?"
      />
    </Stack>,

    /* 2: Store Location */
    <Stack key="s2" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Where is your store based? This helps buyers know where orders ship from.
      </Typography>
      <TextField
        label="Store address"
        value={data.storeAddressLine1}
        onChange={(e) => { updateField("storeAddressLine1")(e); clearError("storeAddressLine1"); }}
        error={!!errors.storeAddressLine1}
        helperText={errors.storeAddressLine1}
        required
        fullWidth
        autoFocus
      />
      <TextField
        label="City"
        value={data.storeCity}
        onChange={(e) => { updateField("storeCity")(e); clearError("storeCity"); }}
        error={!!errors.storeCity}
        helperText={errors.storeCity}
        required
        fullWidth
      />
      <CountrySelect
        value={data.storeCountry}
        onChange={(v) => {
          setData((d) => ({ ...d, storeCountry: v, storeState: "" }));
          clearError("storeCountry");
        }}
        error={errors.storeCountry}
        required
      />
      <RegionSelect
        country={data.storeCountry || "Ghana"}
        value={data.storeState}
        onChange={(v) => { setData((d) => ({ ...d, storeState: v })); clearError("storeState"); }}
        error={errors.storeState}
        required
      />
      <TextField
        label="Postal code (optional)"
        value={data.storePostalCode}
        onChange={updateField("storePostalCode")}
        fullWidth
      />
    </Stack>,

    /* 3: Business Details */
    <Stack key="s3" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        How should buyers and Spree reach you for business matters?
      </Typography>
      <TextField
        label="Business email (optional)"
        type="email"
        value={data.businessEmail}
        onChange={updateField("businessEmail")}
        fullWidth
        autoFocus
      />
      <Box>
        <PhoneInput
          label="Business phone"
          value={data.businessPhone}
          onChange={(v) => { setData((d) => ({ ...d, businessPhone: v })); clearError("businessPhone"); }}
          required
        />
        {errors.businessPhone && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
            {errors.businessPhone}
          </Typography>
        )}
      </Box>
      <PhoneInput
        label="WhatsApp (optional)"
        value={data.whatsapp}
        onChange={(v) => setData((d) => ({ ...d, whatsapp: v }))}
      />
      <TextField
        label="Business registration number (optional)"
        value={data.registrationNumber}
        onChange={updateField("registrationNumber")}
        fullWidth
        helperText="Leave blank for sole traders"
      />
    </Stack>,

    /* 4: Shipping Information */
    <Stack key="s4" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Where should orders be sent for dispatching? You can update this later.
      </Typography>
      <TextField label="Full name" value={data.shipFullName} onChange={updateField("shipFullName")} fullWidth autoFocus />
      <TextField label="Address line 1" value={data.shipAddressLine1} onChange={updateField("shipAddressLine1")} fullWidth />
      <TextField label="Address line 2 (optional)" value={data.shipAddressLine2} onChange={updateField("shipAddressLine2")} fullWidth />
      <TextField label="City" value={data.shipCity} onChange={updateField("shipCity")} fullWidth />
      <CountrySelect
        value={data.shipCountry}
        onChange={(v) => setData((d) => ({ ...d, shipCountry: v, shipState: "" }))}
      />
      <RegionSelect
        country={data.shipCountry || "Ghana"}
        value={data.shipState}
        onChange={(v) => setData((d) => ({ ...d, shipState: v }))}
      />
      <TextField label="Postal code (optional)" value={data.shipPostalCode} onChange={updateField("shipPostalCode")} fullWidth />
    </Stack>,

    /* 5: Payment Information */
    <Stack key="s5" spacing={2.5}>
      <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
        Save reference details only — Spree never stores full card numbers or secrets. Payouts are handled via Paystack.
      </Alert>
      <FormControl fullWidth>
        <InputLabel>Preferred payment method</InputLabel>
        <Select
          label="Preferred payment method"
          value={data.paymentMethod}
          onChange={(e) => setField("paymentMethod", e.target.value as WizardData["paymentMethod"])}
          MenuProps={{ sx: MENU_SX }}
        >
          <MenuItem value="card">Card</MenuItem>
          <MenuItem value="paypal">PayPal</MenuItem>
          <MenuItem value="bank-transfer">Bank transfer</MenuItem>
        </Select>
      </FormControl>
      <TextField label="Cardholder / account name" value={data.cardholderName} onChange={updateField("cardholderName")} fullWidth />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(2, 1fr)" }}>
        <TextField label="Card last 4" value={data.cardLast4} onChange={updateField("cardLast4")} inputProps={{ maxLength: 4 }} />
        <TextField label="Billing postal code" value={data.billingPostalCode} onChange={updateField("billingPostalCode")} />
        <TextField label="Expiry month" value={data.expiryMonth} onChange={updateField("expiryMonth")} inputProps={{ maxLength: 2 }} placeholder="MM" />
        <TextField label="Expiry year" value={data.expiryYear} onChange={updateField("expiryYear")} inputProps={{ maxLength: 4 }} placeholder="YYYY" />
      </Box>
    </Stack>,

    /* 6: Identity Verification */
    <Stack key="s6" spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        We verify every seller before product publishing is enabled. Documents are reviewed privately by our team.
      </Typography>
      <FormControl fullWidth required error={!!errors.governmentIdType}>
        <InputLabel>Government ID type</InputLabel>
        <Select
          label="Government ID type"
          value={data.governmentIdType}
          onChange={(e) => {
            setField("governmentIdType", e.target.value as GovernmentIdType);
            clearError("governmentIdType");
          }}
          MenuProps={{ sx: MENU_SX }}
        >
          {GHANA_ID_TYPES.map((id) => (
            <MenuItem key={id.value} value={id.value}>{id.label}</MenuItem>
          ))}
        </Select>
        {errors.governmentIdType && <FormHelperText>{errors.governmentIdType}</FormHelperText>}
      </FormControl>

      <TextField
        label="ID number"
        value={data.governmentIdNumber}
        onChange={(e) => { updateField("governmentIdNumber")(e); clearError("governmentIdNumber"); }}
        error={!!errors.governmentIdNumber}
        helperText={errors.governmentIdNumber || "Kept private — visible to admins only."}
        required
        fullWidth
        inputProps={{ "aria-invalid": !!errors.governmentIdNumber }}
      />

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
        <IdDropzone
          label="ID front"
          icon={<BadgeRounded fontSize="inherit" />}
          file={idFront}
          thumbnail={thumbFront}
          checking={checkingFront}
          error={errors.idFront ?? (errFront.blocking[0] ?? undefined)}
          warning={errFront.warnings[0] ?? undefined}
          onFile={(f) => handleIdFile("front", f)}
          onClear={() => clearIdFile("front")}
        />
        <IdDropzone
          label="ID back"
          icon={<BadgeRounded fontSize="inherit" />}
          file={idBack}
          thumbnail={thumbBack}
          checking={checkingBack}
          error={errors.idBack ?? (errBack.blocking[0] ?? undefined)}
          warning={errBack.warnings[0] ?? undefined}
          onFile={(f) => handleIdFile("back", f)}
          onClear={() => clearIdFile("back")}
        />
        <IdDropzone
          label="Selfie with ID"
          icon={<CloudUploadRounded fontSize="inherit" />}
          file={idSelfie}
          thumbnail={thumbSelfie}
          checking={checkingSelfie}
          error={errors.selfie ?? (errSelfie.blocking[0] ?? undefined)}
          warning={errSelfie.warnings[0] ?? undefined}
          onFile={(f) => handleIdFile("selfie", f)}
          onClear={() => clearIdFile("selfie")}
        />
      </Box>

      {(errFront.warnings.length > 0 || errBack.warnings.length > 0 || errSelfie.warnings.length > 0) &&
       !errFront.blocking.length && !errBack.blocking.length && !errSelfie.blocking.length && (
        <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ borderRadius: 2 }}>
          Some photos have quality warnings. Sharper, well-lit images speed up the review process.
        </Alert>
      )}
    </Stack>,

    /* 7: Review & Submit */
    <Stack key="s7" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Review your application below. Click any section to make changes before submitting.
      </Typography>

      {serverError && <Alert severity="error" sx={{ borderRadius: 2 }}>{serverError}</Alert>}
      {submitSuccess && <Alert severity="success" sx={{ borderRadius: 2 }}>Application submitted! Taking you back to your profile…</Alert>}

      {([
        {
          title: "Account", stepIdx: 0,
          rows: [["Display name", data.name], ["Email", data.email]],
        },
        {
          title: "Store", stepIdx: 1,
          rows: [
            ["Store name", data.storeName],
            ["Tagline", data.storeTagline],
            ["Sell as", data.sellerType === "retail" ? "Retail seller" : "Wholesale seller"],
            ["Description", data.storeDescription.slice(0, 80) + (data.storeDescription.length > 80 ? "…" : "")],
          ],
        },
        {
          title: "Location", stepIdx: 2,
          rows: [
            ["Address", data.storeAddressLine1],
            ["City", data.storeCity],
            ["Region", data.storeState],
            ["Country", data.storeCountry],
          ],
        },
        {
          title: "Business", stepIdx: 3,
          rows: [
            ["Business phone", data.businessPhone],
            ["Business email", data.businessEmail],
            ["WhatsApp", data.whatsapp],
          ],
        },
        {
          title: "Identity", stepIdx: 6,
          rows: [
            ["ID type", GHANA_ID_TYPES.find((t) => t.value === data.governmentIdType)?.label ?? ""],
            ["ID number", data.governmentIdNumber ? "••••••••" : ""],
            ["Documents", [idFront && "ID front", idBack && "ID back", idSelfie && "Selfie"].filter(Boolean).join(", ") || "None uploaded"],
          ],
        },
      ] as const).map(({ title, stepIdx, rows }) => (
        <Box
          key={title}
          sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}
        >
          <Stack
            direction="row" justifyContent="space-between" alignItems="center"
            sx={{ px: 2, py: 1, bgcolor: "action.hover" }}
          >
            <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
            <Button
              size="small"
              onClick={() => handleStepClick(stepIdx)}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Edit
            </Button>
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog
        open={open}
        onClose={attemptClose}
        fullScreen={fullScreen}
        maxWidth="sm"
        fullWidth
        aria-modal="true"
        aria-labelledby="wizard-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            maxHeight: fullScreen ? "100%" : "90vh",
          },
        }}
      >
        {/* Header + Stepper */}
        <DialogTitle
          id="wizard-dialog-title"
          component="div"
          sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5 }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={800} lineHeight={1} display="block">
                Seller Application
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ mt: 0.25 }}>
                {STEP_LABELS[step]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Step {step + 1} of {STEP_LABELS.length}
              </Typography>
            </Box>
            <IconButton aria-label="Close wizard" onClick={attemptClose} size="small" sx={{ mt: -0.25, mr: -0.5 }}>
              <CloseRounded />
            </IconButton>
          </Stack>

          {/* Horizontal stepper — scrolls on narrow screens */}
          <Box sx={{ overflowX: "auto", pb: 0.5, mx: -0.5 }}>
            <Stepper
              activeStep={step}
              nonLinear
              sx={{ minWidth: 500, px: 0.5 }}
            >
              {STEP_LABELS.map((label, idx) => (
                <Step key={label} completed={completedSteps.has(idx)}>
                  <StepButton
                    onClick={() => handleStepClick(idx)}
                    disabled={!completedSteps.has(idx) && idx !== step}
                    sx={{ py: 0.5, px: 0 }}
                  >
                    <StepLabel
                      sx={{
                        "& .MuiStepLabel-label": { fontSize: "0.62rem", whiteSpace: "nowrap" },
                      }}
                    >
                      {label}
                    </StepLabel>
                  </StepButton>
                </Step>
              ))}
            </Stepper>
          </Box>
        </DialogTitle>

        {/* Step body */}
        <DialogContent
          sx={{ px: { xs: 2, sm: 3 }, pt: 1, pb: 0, overflowX: "hidden" }}
          role="region"
          aria-live="polite"
        >
          {steps[step]}
        </DialogContent>

        {/* Navigation */}
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 1.75, sm: 2 },
            borderTop: "1px solid",
            borderColor: "divider",
            justifyContent: "space-between",
          }}
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackRounded />}
            onClick={handleBack}
            disabled={step === 0 || submitting}
            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
          >
            Back
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
          ) : (
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
        </DialogActions>
      </Dialog>

      {/* Discard confirmation */}
      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        aria-labelledby="discard-dialog-title"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle id="discard-dialog-title" sx={{ fontWeight: 800 }}>
          Leave seller application?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Your draft is saved locally. If you discard now, all progress will be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setDiscardOpen(false)}
            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
          >
            Continue editing
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={() => { clearDraft(); setDiscardOpen(false); onClose(); }}
            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700 }}
          >
            Discard draft
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
