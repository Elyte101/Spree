'use client';

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  BadgeRounded,
  CameraAltRounded,
  CheckRounded,
  CloseRounded,
  CloudUploadRounded,
  ContactPhoneRounded,
  DeleteOutlineRounded,
  LocalShippingRounded,
  PaymentRounded,
  PhoneAndroidRounded,
  PhotoCameraRounded,
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
  Container,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
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

// ── Image validation ───────────────────────────────────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function validateIdImage(file: File, slot: "front" | "back" | "selfie"): Promise<ImgCheckResult> {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    blocking.push("Upload a JPEG, PNG, or WebP image.");
    return { blocking, warnings };
  }
  if (file.size < 30 * 1024) blocking.push("Image is too small (min 30 KB). Use a higher-quality photo.");
  if (file.size > 10 * 1024 * 1024) blocking.push("Image exceeds 10 MB. Please compress it.");
  if (blocking.length) return { blocking, warnings };

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const w = img.naturalWidth, h = img.naturalHeight;

    if (Math.max(w, h) < 1000) {
      blocking.push(`Resolution too low (${w}×${h} px). Long edge must be ≥1000 px.`);
    }
    if (slot !== "selfie") {
      const ratio = Math.max(w, h) / Math.min(w, h);
      if (ratio < 1.2 || ratio > 2.2) warnings.push("Photograph the full ID card in landscape for best results.");
    }

    const scale = Math.min(1, 400 / Math.max(w, h, 1));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blocking, warnings };
    ctx.drawImage(img, 0, 0, cw, ch);
    const { data: px } = ctx.getImageData(0, 0, cw, ch);

    let totalLum = 0;
    const count = cw * ch;
    for (let i = 0; i < px.length; i += 4) {
      totalLum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    }
    const meanLum = totalLum / count;
    if (meanLum < 45) blocking.push("Image is too dark. Retake in better lighting.");
    else if (meanLum > 240) warnings.push("Image may be overexposed — check that text is readable.");

    let lapSum = 0, lapSqSum = 0;
    const lapCount = (cw - 2) * (ch - 2);
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < cw - 1; x++) {
        const g = (idx: number) => 0.299 * px[idx] + 0.587 * px[idx + 1] + 0.114 * px[idx + 2];
        const c = g((y * cw + x) * 4);
        const t = g(((y - 1) * cw + x) * 4);
        const b = g(((y + 1) * cw + x) * 4);
        const l = g((y * cw + (x - 1)) * 4);
        const r = g((y * cw + (x + 1)) * 4);
        const lap = Math.abs(-4 * c + t + b + l + r);
        lapSum += lap; lapSqSum += lap * lap;
      }
    }
    const lapMean = lapSum / lapCount;
    const lapVar = lapSqSum / lapCount - lapMean * lapMean;
    if (lapVar < 40) blocking.push("Image is blurry. Hold the camera still and keep the ID in focus.");
    else if (lapVar < 100) warnings.push("Image may be slightly blurry — sharper photos speed up review.");
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
  if (step === 6) {
    if (!data.governmentIdType) e.governmentIdType = "Select your ID type.";
    const idTrimmed = data.governmentIdNumber.trim();
    if (!idTrimmed || idTrimmed === "GHA-") {
      e.governmentIdNumber = "ID number is required.";
    } else {
      const spec = GHANA_ID_SPECS[data.governmentIdType];
      const fmtErr = spec?.validate(idTrimmed);
      if (fmtErr) e.governmentIdNumber = fmtErr;
    }
    if (!idFiles.front) e.idFront = "Upload the front of your ID.";
    else if (imgErrors.front.blocking.length) e.idFront = imgErrors.front.blocking[0];
    if (!idFiles.back) e.idBack = "Upload the back of your ID.";
    else if (imgErrors.back.blocking.length) e.idBack = imgErrors.back.blocking[0];
    if (!idFiles.selfie) e.selfie = "Upload a selfie holding your ID.";
    else if (imgErrors.selfie.blocking.length) e.selfie = imgErrors.selfie.blocking[0];
  }
  return e;
}

// ── Initial data from profile + draft ─────────────────────────────────────────

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

// ── Camera capture component ───────────────────────────────────────────────────

function CameraCapture({ onCapture, onClose }: { onCapture: (f: File) => void; onClose: () => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [state, setState] = React.useState<"starting" | "ready" | "error">("starting");
  const [errMsg, setErrMsg] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); }
        setState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        let msg = "Unable to access camera. Please use file upload instead.";
        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
            msg = "Camera access denied. Allow camera access in your browser settings and try again.";
          else if (err.name === "NotFoundError")
            msg = "No camera found on this device. Please use file upload instead.";
        }
        setErrMsg(msg);
        setState("error");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      onCapture(new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  return (
    <Box sx={{ position: "relative", borderRadius: 2, overflow: "hidden", bgcolor: "#000", aspectRatio: "4/3" }}>
      {state === "starting" && (
        <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0 }} spacing={1.5}>
          <CircularProgress sx={{ color: "white" }} size={32} />
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>Starting camera…</Typography>
        </Stack>
      )}
      {state === "error" && (
        <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, p: 3 }} spacing={2}>
          <Typography variant="body2" textAlign="center" sx={{ color: "rgba(255,255,255,0.85)" }}>{errMsg}</Typography>
          <Button size="small" variant="outlined" onClick={onClose}
            sx={{ color: "white", borderColor: "rgba(255,255,255,0.4)", "&:hover": { borderColor: "white" } }}>
            Use file upload
          </Button>
        </Stack>
      )}
      <video ref={videoRef} playsInline muted
        style={{ width: "100%", height: "100%", objectFit: "cover", display: state === "ready" ? "block" : "none" }} />
      {state === "ready" && (
        <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, p: 2, background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
          <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
            <Button size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.75)", minWidth: 72 }}>Cancel</Button>
            <IconButton onClick={capture}
              sx={{ width: 56, height: 56, bgcolor: "white", color: "grey.900", border: "3px solid rgba(255,255,255,0.5)", "&:hover": { bgcolor: "grey.100" } }}>
              <PhotoCameraRounded sx={{ fontSize: 24 }} />
            </IconButton>
          </Stack>
        </Box>
      )}
      <IconButton size="small" onClick={onClose}
        sx={{ position: "absolute", top: 8, right: 8, color: "white", bgcolor: "rgba(0,0,0,0.45)", "&:hover": { bgcolor: "rgba(0,0,0,0.65)" } }}>
        <CloseRounded fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Upload dropzone with drag-drop + file-pick + camera ────────────────────────

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
  const [showCamera, setShowCamera] = React.useState(false);
  const [hasCamera, setHasCamera] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setHasCamera(
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function",
    );
  }, []);

  if (showCamera) {
    return (
      <Box>
        <Typography variant="body2" fontWeight={700} color="text.secondary" mb={1}>{label}</Typography>
        <CameraCapture
          onCapture={(f) => { setShowCamera(false); onFile(f); }}
          onClose={() => setShowCamera(false)}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        sx={(theme) => ({
          position: "relative",
          minHeight: 120,
          borderRadius: 2,
          border: "2px dashed",
          borderColor: error ? "error.main" : dragging ? "primary.main" : theme.palette.divider,
          bgcolor: dragging ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          transition: "border-color 0.2s ease, background-color 0.2s ease",
          "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
        })}
      >
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        {thumbnail ? (
          <>
            <Box component="img" src={thumbnail} alt={label}
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.38)", display: "flex", alignItems: "flex-end", p: 1 }}>
              <Typography variant="caption" color="white" fontWeight={700} noWrap sx={{ maxWidth: "100%" }}>{file?.name}</Typography>
            </Box>
          </>
        ) : (
          <Stack alignItems="center" spacing={0.75} sx={{ py: 2, px: 2, pointerEvents: "none" }}>
            {checking ? <CircularProgress size={26} /> : <Box sx={{ fontSize: 34, color: "text.secondary", display: "flex" }}>{icon}</Box>}
            <Typography variant="body2" fontWeight={700} textAlign="center">{label}</Typography>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              Drag & drop · choose file · take photo<br />JPEG · PNG · WebP
            </Typography>
          </Stack>
        )}
      </Box>

      <Stack direction="row" spacing={1} mt={0.75} justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
          <Button size="small" variant="outlined" startIcon={<CloudUploadRounded fontSize="small" />}
            onClick={() => inputRef.current?.click()}
            sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.75rem", borderRadius: 2 }}>
            {thumbnail ? "Replace" : "Choose file"}
          </Button>
          {hasCamera && (
            <Button size="small" variant="outlined" color="secondary" startIcon={<CameraAltRounded fontSize="small" />}
              onClick={() => setShowCamera(true)}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.75rem", borderRadius: 2 }}>
              Take photo
            </Button>
          )}
        </Stack>
        {file && (
          <Button size="small" color="error" startIcon={<DeleteOutlineRounded fontSize="small" />}
            onClick={onClear} sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem" }}>
            Remove
          </Button>
        )}
      </Stack>

      {checking && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>Checking image…</Typography>}
      {!checking && error && <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>{error}</Typography>}
      {!checking && !error && warning && <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>{warning}</Typography>}
    </Box>
  );
}

// ── Wizard page component ─────────────────────────────────────────────────────

export function VendorApplicationWizard({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { update } = useSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState<WizardData>(() => buildInitialData(profile));
  const [errors, setErrors] = React.useState<StepErrors>({});
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

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
  React.useEffect(() => { saveDraft(data); }, [data]);

  // Cleanup object URLs
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

  const handleIdFile = React.useCallback(async (slot: "front" | "back" | "selfie", file: File) => {
    const setFile = slot === "front" ? setIdFront : slot === "back" ? setIdBack : setIdSelfie;
    const setThumb = slot === "front" ? setThumbFront : slot === "back" ? setThumbBack : setThumbSelfie;
    const setChecking = slot === "front" ? setCheckingFront : slot === "back" ? setCheckingBack : setCheckingSelfie;
    const setImgErr = slot === "front" ? setErrFront : slot === "back" ? setErrBack : setErrSelfie;
    const errKey = slot === "front" ? "idFront" : slot === "back" ? "idBack" : "selfie";
    const prevThumb = slot === "front" ? thumbFront : slot === "back" ? thumbBack : thumbSelfie;

    if (prevThumb) URL.revokeObjectURL(prevThumb);
    setFile(file);
    setThumb(URL.createObjectURL(file));
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
    const setImgErr = slot === "front" ? setErrFront : slot === "back" ? setErrBack : setErrSelfie;
    const prevThumb = slot === "front" ? thumbFront : slot === "back" ? thumbBack : thumbSelfie;
    if (prevThumb) URL.revokeObjectURL(prevThumb);
    setFile(null); setThumb(null); setImgErr({ blocking: [], warnings: [] });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const idFiles = { front: idFront, back: idBack, selfie: idSelfie };
  const imgErrors = { front: errFront, back: errBack, selfie: errSelfie };

  const handleNext = () => {
    const errs = validateStep(step, data, idFiles, imgErrors);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setCompletedSteps((s) => new Set([...s, step]));
    setStep((s) => s + 1);
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
        const body = (await res.json()) as { detail?: string; errors?: Record<string, string> };
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
      await update();
      setTimeout(() => router.push("/profile"), 2400);
    } catch (err) {
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
          <TextField label="Account name" value={data.momoAccountName} fullWidth
            onChange={(e) => setData((d) => ({ ...d, momoAccountName: e.target.value }))}
            helperText="Full name as it appears on the MoMo account" />
          {data.momoProvider && data.momoNumber && !errors.momoNumber && (
            <Alert severity="success" icon={false} sx={{ borderRadius: 2, py: 1 }}>
              Payouts will be sent to <strong>{data.momoNumber}</strong> via <strong>{data.momoProvider}</strong>.
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

    /* 6 */
    <Stack key="s6" spacing={2.5}>
      {(() => {
        const idSpec = GHANA_ID_SPECS[data.governmentIdType];
        const idTrimmed = data.governmentIdNumber.trim();
        const idValid = !!idTrimmed && idTrimmed !== "GHA-" && !errors.governmentIdNumber;
        return (
          <>
            <Typography variant="body2" color="text.secondary">
              We verify every vendor before product publishing is enabled. Documents are reviewed privately by our team.
            </Typography>
            <FormControl fullWidth required error={!!errors.governmentIdType}>
              <InputLabel>Government ID type</InputLabel>
              <Select label="Government ID type" value={data.governmentIdType}
                onChange={(e) => {
                  const newType = e.target.value as GovernmentIdType;
                  setData((d) => ({ ...d, governmentIdType: newType, governmentIdNumber: initialIdValue(newType, "") }));
                  clearError("governmentIdType");
                  clearError("governmentIdNumber");
                }}
                MenuProps={{ sx: MENU_SX }}>
                {GHANA_ID_TYPES.map((id) => <MenuItem key={id.value} value={id.value}>{id.label}</MenuItem>)}
              </Select>
              {errors.governmentIdType && <FormHelperText>{errors.governmentIdType}</FormHelperText>}
            </FormControl>

            <Box>
              {idSpec && (
                <Box sx={(theme) => ({
                  mb: 1, px: 1.5, py: 0.75, borderRadius: 1.5,
                  bgcolor: idValid ? alpha(theme.palette.success.main, 0.08) : alpha(theme.palette.info.main, 0.07),
                  border: "1px solid",
                  borderColor: idValid ? alpha(theme.palette.success.main, 0.3) : alpha(theme.palette.info.main, 0.2),
                })}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                    Expected format
                  </Typography>
                  <Typography variant="caption" sx={{
                    fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.06em",
                    color: idValid ? "success.main" : "text.primary", fontSize: "0.8rem",
                  }}>
                    {idSpec.placeholder}
                  </Typography>
                </Box>
              )}
              <TextField
                label="ID number"
                value={data.governmentIdNumber}
                required
                fullWidth
                onChange={(e) => {
                  const formatted = applyIdFormat(e.target.value, data.governmentIdType);
                  setData((d) => ({ ...d, governmentIdNumber: formatted }));
                  const trimmed = formatted.trim();
                  if (trimmed && trimmed !== "GHA-") {
                    const err = idSpec?.validate(trimmed) ?? "";
                    setErrors((prev) => ({ ...prev, governmentIdNumber: err }));
                  } else {
                    clearError("governmentIdNumber");
                  }
                }}
                error={!!errors.governmentIdNumber}
                helperText={
                  errors.governmentIdNumber
                    ? errors.governmentIdNumber
                    : idValid
                      ? "✓ Format looks correct"
                      : idSpec?.formatHint
                }
                slotProps={{
                  formHelperText: { sx: idValid ? { color: "success.main", fontWeight: 600 } : {} },
                  htmlInput: {
                    style: { textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.06em" },
                    spellCheck: false,
                    autoCorrect: "off",
                    autoCapitalize: "characters",
                    "aria-invalid": !!errors.governmentIdNumber,
                  },
                }}
              />
            </Box>
          </>
        );
      })()}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
        <IdDropzone label="ID front" icon={<BadgeRounded fontSize="inherit" />}
          file={idFront} thumbnail={thumbFront} checking={checkingFront}
          error={errors.idFront ?? (errFront.blocking[0] ?? undefined)}
          warning={errFront.warnings[0] ?? undefined}
          onFile={(f) => handleIdFile("front", f)} onClear={() => clearIdFile("front")} />
        <IdDropzone label="ID back" icon={<BadgeRounded fontSize="inherit" />}
          file={idBack} thumbnail={thumbBack} checking={checkingBack}
          error={errors.idBack ?? (errBack.blocking[0] ?? undefined)}
          warning={errBack.warnings[0] ?? undefined}
          onFile={(f) => handleIdFile("back", f)} onClear={() => clearIdFile("back")} />
        <IdDropzone label="Selfie with ID" icon={<CloudUploadRounded fontSize="inherit" />}
          file={idSelfie} thumbnail={thumbSelfie} checking={checkingSelfie}
          error={errors.selfie ?? (errSelfie.blocking[0] ?? undefined)}
          warning={errSelfie.warnings[0] ?? undefined}
          onFile={(f) => handleIdFile("selfie", f)} onClear={() => clearIdFile("selfie")} />
      </Box>
      {(errFront.warnings.length > 0 || errBack.warnings.length > 0 || errSelfie.warnings.length > 0) &&
       !errFront.blocking.length && !errBack.blocking.length && !errSelfie.blocking.length && (
        <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ borderRadius: 2 }}>
          Some photos have quality warnings. Sharper, well-lit images speed up the review process.
        </Alert>
      )}
    </Stack>,

    /* 7 — Review */
    <Stack key="s7" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Review your application before submitting. Click any section to make changes.
      </Typography>
      {serverError && <Alert severity="error" sx={{ borderRadius: 2 }}>{serverError}</Alert>}
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
        { title: "Identity", idx: 6, rows: [["ID type", GHANA_ID_TYPES.find((t) => t.value === data.governmentIdType)?.label ?? ""], ["ID number", data.governmentIdNumber ? "••••••••" : ""], ["Documents", [idFront && "Front", idBack && "Back", idSelfie && "Selfie"].filter(Boolean).join(", ") || "None uploaded"]] },
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
