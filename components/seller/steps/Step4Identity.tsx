'use client';

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormHelperText,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ArrowForwardRounded,
  BadgeRounded,
  CameraAltRounded,
  CheckCircleRounded,
  CloseRounded,
  FlipCameraAndroidRounded,
  PhotoCameraRounded,
  UploadFileRounded,
  VideocamOffRounded,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import { GHANA_ID_TYPES, GHANA_ID_SPECS } from "@/lib/ghana";
import type { GovernmentIdType } from "@/types/types";
import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep4Payload } from "@/lib/api/types";

type Slot = "id_front" | "id_back" | "selfie";

interface UploadSlotState {
  path: string | null;
  uploading: boolean;
  error: string | null;
}

const SLOT_META: Record<Slot, { label: string; hint: string; icon: React.ReactNode; facing: "environment" | "user" }> = {
  id_front: {
    label: "ID card — front",
    hint: "Clear photo of the front of your ID. Make sure all text is readable.",
    icon: <BadgeRounded sx={{ fontSize: 36, color: "text.disabled" }} />,
    facing: "environment",
  },
  id_back: {
    label: "ID card — back",
    hint: "Clear photo of the back of your ID.",
    icon: <BadgeRounded sx={{ fontSize: 36, color: "text.disabled", transform: "scaleX(-1)" }} />,
    facing: "environment",
  },
  selfie: {
    label: "Selfie with ID",
    hint: "Hold your ID next to your face so both are clearly visible.",
    icon: <CameraAltRounded sx={{ fontSize: 36, color: "text.disabled" }} />,
    facing: "user",
  },
};

/**
 * Filter and auto-format ID input per type.
 * Strips invalid characters, enforces character class rules,
 * and auto-inserts Ghana Card dashes so the user only types digits.
 */
function applyIdFormat(raw: string, type: string): string {
  const up = raw.toUpperCase();
  switch (type) {
    case "ghana-card": {
      // Rebuild GHA-XXXXXXXXX-X: strip non-alphanumeric, extract digit body
      const stripped = up.replace(/[^A-Z0-9]/g, "");
      const body = stripped.startsWith("GHA") ? stripped.slice(3) : stripped;
      const digits = body.replace(/\D/g, "").slice(0, 10);
      if (!digits) return "GHA-";
      if (digits.length <= 9) return `GHA-${digits}`;
      return `GHA-${digits.slice(0, 9)}-${digits.slice(9)}`;
    }
    case "passport":
      // 1 letter + 7-8 digits, max 9 chars
      const ps = up.replace(/[^A-Z0-9]/g, "");
      if (!ps) return "";
      const pl = /^[A-Z]$/.test(ps[0]) ? ps[0] : "";
      return pl + ps.slice(pl ? 1 : 0).replace(/\D/g, "").slice(0, 8);
    case "ssnit": {
      // C or P followed by 10-11 digits
      const ss = up.replace(/[^A-Z0-9]/g, "");
      if (!ss) return "";
      const sp = /^[CP]$/.test(ss[0]) ? ss[0] : "";
      return sp + ss.slice(sp ? 1 : 0).replace(/\D/g, "").slice(0, 11);
    }
    case "voters-id":
      return up.replace(/[^A-Z0-9]/g, "").slice(0, 14);
    case "ecowas-card":
      return up.replace(/[^A-Z0-9-]/g, "").slice(0, 20);
    case "drivers-license":
      return up.replace(/[^A-Z0-9/ -]/g, "").slice(0, 20);
    default:
      return up;
  }
}

/** Starting value for the ID number field — pre-fills Ghana Card prefix. */
function initialIdValue(type: string, existing: string): string {
  if (existing) return existing;
  return type === "ghana-card" ? "GHA-" : "";
}

// ---------------------------------------------------------------------------
// Camera view component
// ---------------------------------------------------------------------------

function CameraView({
  facingMode: initialFacing,
  onCapture,
  onClose,
}: {
  facingMode: "environment" | "user";
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [camState, setCamState] = React.useState<"starting" | "ready" | "error">("starting");
  const [errMsg, setErrMsg] = React.useState("");
  const [facing, setFacing] = React.useState(initialFacing);

  const startCamera = React.useCallback(async (mode: "environment" | "user") => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamState("starting");
    setErrMsg("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState("ready");
    } catch (err) {
      let msg = "Unable to access camera. Please use the file upload option instead.";
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          msg = "Camera access denied. Please allow camera access in your browser or device settings, then try again.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          msg = "No camera found on this device. Please use the file upload option.";
        } else if (err.name === "NotSupportedError" || err.name === "InsecureContextError") {
          msg = "Camera access requires a secure (HTTPS) connection.";
        } else if (err.name === "OverconstrainedError") {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
            }
            setCamState("ready");
            return;
          } catch {
            msg = "Unable to start camera. Please use the file upload option.";
          }
        }
      }
      setErrMsg(msg);
      setCamState("error");
    }
  }, []);

  React.useEffect(() => {
    startCamera(facing);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFlip() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    startCamera(next);
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video || camState !== "ready") return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <Box sx={{ position: "relative", borderRadius: 2, overflow: "hidden", bgcolor: "#000", aspectRatio: "4/3", width: "100%" }}>
      {camState === "starting" && (
        <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ position: "absolute", inset: 0 }}>
          <CircularProgress sx={{ color: "white" }} size={36} />
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>Starting camera…</Typography>
        </Stack>
      )}

      {camState === "error" && (
        <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ position: "absolute", inset: 0, p: 3 }}>
          <VideocamOffRounded sx={{ fontSize: 44, color: "grey.500" }} />
          <Typography variant="body2" textAlign="center" sx={{ color: "rgba(255,255,255,0.75)" }}>
            {errMsg}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={onClose}
            sx={{ color: "white", borderColor: "rgba(255,255,255,0.4)", "&:hover": { borderColor: "white" } }}
          >
            Use file upload instead
          </Button>
        </Stack>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: camState === "ready" ? "block" : "none",
          transform: facing === "user" ? "scaleX(-1)" : "none",
        }}
      />

      {camState === "ready" && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            p: { xs: 2, sm: 2.5 },
            background: "linear-gradient(transparent, rgba(0,0,0,0.72))",
          }}
        >
          <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
            <Button
              variant="text"
              size="small"
              onClick={onClose}
              sx={{ color: "rgba(255,255,255,0.75)", minWidth: 72 }}
            >
              Cancel
            </Button>
            <IconButton
              onClick={handleCapture}
              sx={{
                width: 64,
                height: 64,
                bgcolor: "white",
                color: "grey.900",
                border: "4px solid rgba(255,255,255,0.5)",
                "&:hover": { bgcolor: "grey.100", transform: "scale(1.05)" },
                transition: "transform 0.15s ease",
              }}
            >
              <PhotoCameraRounded sx={{ fontSize: 28 }} />
            </IconButton>
            <Tooltip title="Flip camera">
              <IconButton
                size="small"
                onClick={handleFlip}
                sx={{ color: "rgba(255,255,255,0.75)", minWidth: 72 }}
              >
                <FlipCameraAndroidRounded />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      <IconButton
        size="small"
        onClick={onClose}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          color: "white",
          bgcolor: "rgba(0,0,0,0.45)",
          "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
        }}
      >
        <CloseRounded fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Upload tile component — drag & drop + file pick + camera
// ---------------------------------------------------------------------------

function UploadTile({
  slot,
  state,
  onFileSelect,
}: {
  slot: Slot;
  state: UploadSlotState;
  onFileSelect: (slot: Slot, file: File) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  // Start false to match SSR; set to true after mount so the button renders correctly
  const [hasCamera, setHasCamera] = React.useState(false);
  const meta = SLOT_META[slot];
  const done = !!state.path && !state.uploading;

  React.useEffect(() => {
    setHasCamera(
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function",
    );
  }, []);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) onFileSelect(slot, file);
  }

  if (showCamera) {
    return (
      <Box>
        <Typography variant="body2" fontWeight={700} color="text.secondary" mb={1}>
          {meta.label}
        </Typography>
        <CameraView
          facingMode={meta.facing}
          onCapture={(file) => { setShowCamera(false); onFileSelect(slot, file); }}
          onClose={() => setShowCamera(false)}
        />
      </Box>
    );
  }

  return (
    <Box onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <Box
        sx={(theme) => ({
          border: "2px dashed",
          borderColor: done
            ? "success.main"
            : isDragging
              ? "primary.main"
              : state.error
                ? "error.main"
                : theme.palette.divider,
          borderRadius: 2,
          p: { xs: 2, sm: 2.5 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          bgcolor: isDragging
            ? alpha(theme.palette.primary.main, 0.06)
            : done
              ? alpha(theme.palette.success.main, 0.05)
              : "transparent",
          transition: "border-color 0.15s ease, background-color 0.15s ease",
          cursor: state.uploading ? "default" : "pointer",
        })}
        onClick={() => { if (!state.uploading && !done) inputRef.current?.click(); }}
      >
        {state.uploading ? (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">Uploading…</Typography>
          </>
        ) : done ? (
          <>
            <CheckCircleRounded sx={{ fontSize: 36, color: "success.main" }} />
            <Typography variant="body2" fontWeight={700}>Uploaded ✓</Typography>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              {isDragging ? "Drop to replace" : "Drag a new photo here, or use the buttons below to replace"}
            </Typography>
          </>
        ) : (
          <>
            {meta.icon}
            <Typography variant="body2" fontWeight={700}>{meta.label}</Typography>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              {isDragging ? "Drop to upload" : meta.hint}
            </Typography>
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              {isDragging ? "" : "Drag & drop, choose file, or take a photo"}
            </Typography>
          </>
        )}

        {!state.uploading && (
          <Stack direction="row" spacing={1} mt={0.5} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileRounded />}
              onClick={() => inputRef.current?.click()}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
            >
              {done ? "Replace" : "Choose file"}
            </Button>
            {hasCamera && (
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<CameraAltRounded />}
                onClick={() => setShowCamera(true)}
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
              >
                Take photo
              </Button>
            )}
          </Stack>
        )}
      </Box>

      {state.error && (
        <FormHelperText error sx={{ mt: 0.5, mx: 0.25 }}>{state.error}</FormHelperText>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(slot, f);
          e.target.value = "";
        }}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main Step4Identity component
// ---------------------------------------------------------------------------

export function Step4Identity({ profile, onSubmit, submitting }: StepProps) {
  const [idType, setIdType] = React.useState<GovernmentIdType>(
    (profile?.governmentIdType as GovernmentIdType) || "ghana-card"
  );
  const [idNumber, setIdNumber] = React.useState(
    initialIdValue((profile?.governmentIdType as string) || "ghana-card", profile?.governmentIdNumber || "")
  );
  const [uploads, setUploads] = React.useState<Record<Slot, UploadSlotState>>({
    id_front: { path: profile?.idFrontUrl || null, uploading: false, error: null },
    id_back:  { path: profile?.idBackUrl  || null, uploading: false, error: null },
    selfie:   { path: profile?.selfieUrl  || null, uploading: false, error: null },
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [idTouched, setIdTouched] = React.useState(false);

  const prevIdType = React.useRef(idType);
  React.useEffect(() => {
    if (idType !== prevIdType.current) {
      setIdNumber(initialIdValue(idType, ""));
      setErrors((e) => ({ ...e, idNumber: "" }));
      setIdTouched(false);
      prevIdType.current = idType;
    }
  }, [idType]);

  const spec = GHANA_ID_SPECS[idType];

  function validateIdNumber(value: string): string {
    const trimmed = value.trim();
    // Ghana Card prefix-only counts as empty
    if (!trimmed || trimmed === "GHA-") return "ID number is required";
    return spec?.validate(trimmed) ?? "";
  }

  function handleIdNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = applyIdFormat(e.target.value, idType);
    setIdNumber(formatted);
    setIdTouched(true);
    // Validate immediately on every keystroke once the user has started typing
    const trimmed = formatted.trim();
    if (!trimmed || trimmed === "GHA-") {
      setErrors((prev) => ({ ...prev, idNumber: "" }));
    } else {
      const err = spec?.validate(trimmed) ?? "";
      setErrors((prev) => ({ ...prev, idNumber: err }));
    }
  }

  function handleIdNumberBlur() {
    setIdTouched(true);
    const err = validateIdNumber(idNumber);
    setErrors((prev) => ({ ...prev, idNumber: err }));
  }

  async function handleFileSelect(slot: Slot, file: File) {
    setUploads((prev) => ({ ...prev, [slot]: { ...prev[slot], uploading: true, error: null } }));
    try {
      const { uploadUrl, path } = await api.getUploadUrl(slot);
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!res.ok) throw new Error("Upload failed");
      setUploads((prev) => ({ ...prev, [slot]: { path, uploading: false, error: null } }));
    } catch (err) {
      setUploads((prev) => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          uploading: false,
          error: err instanceof ApiClientError ? err.message : "Upload failed — please try again",
        },
      }));
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    const idErr = validateIdNumber(idNumber);
    if (idErr) e.idNumber = idErr;
    if (!uploads.id_front.path) e.id_front = "Please upload the front of your ID";
    if (!uploads.id_back.path)  e.id_back  = "Please upload the back of your ID";
    if (!uploads.selfie.path)   e.selfie   = "Please upload a selfie holding your ID";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: OnboardingStep4Payload = {
      governmentIdType: idType,
      governmentIdNumber: idNumber.trim().toUpperCase(),
      idFrontUrl: uploads.id_front.path!,
      idBackUrl:  uploads.id_back.path!,
      selfieUrl:  uploads.selfie.path!,
    };
    await onSubmit(payload);
  }

  const anyUploading = Object.values(uploads).some((u) => u.uploading);

  // Determine whether to show a live "looks good" indicator
  const idNumberValid = idTouched && !errors.idNumber && idNumber.trim() !== "" && idNumber.trim() !== "GHA-";

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" fontWeight={700} mb={1}>
        Identity verification
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        We verify every seller to keep Spree safe. Your documents are stored securely
        and seen only by our review team.
      </Typography>

      <Stack spacing={2.5}>
        <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
          Make sure your ID is valid, not expired, and the photos are clear and well-lit.
        </Alert>

        {/* ID type selector */}
        <TextField
          select
          label="ID type"
          value={idType}
          onChange={(e) => setIdType(e.target.value as GovernmentIdType)}
          fullWidth
          required
        >
          {GHANA_ID_TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </TextField>

        {/* ID number — per-type format guidance + real-time validation */}
        <Box>
          {spec && (
            <Box
              sx={(theme) => ({
                mb: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: idNumberValid
                  ? alpha(theme.palette.success.main, 0.08)
                  : alpha(theme.palette.info.main, 0.07),
                border: "1px solid",
                borderColor: idNumberValid
                  ? alpha(theme.palette.success.main, 0.3)
                  : alpha(theme.palette.info.main, 0.2),
              })}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                Expected format
              </Typography>
              <Typography
                variant="caption"
                component="span"
                sx={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: idNumberValid ? "success.main" : "text.primary",
                  fontSize: "0.8rem",
                }}
              >
                {spec.placeholder}
              </Typography>
            </Box>
          )}

          <TextField
            label="ID number"
            value={idNumber}
            onChange={handleIdNumberChange}
            onBlur={handleIdNumberBlur}
            error={idTouched && !!errors.idNumber}
            helperText={
              idTouched && errors.idNumber
                ? errors.idNumber
                : idNumberValid
                  ? "✓ Format looks correct"
                  : spec?.formatHint
            }
            FormHelperTextProps={{
              sx: idNumberValid ? { color: "success.main", fontWeight: 600 } : {},
            }}
            fullWidth
            required
            slotProps={{
              htmlInput: {
                style: {
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                  letterSpacing: "0.06em",
                },
                spellCheck: false,
                autoCorrect: "off",
                autoCapitalize: "characters",
              },
            }}
          />
        </Box>

        {/* Photo uploads */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
            Upload photos
          </Typography>
          <Stack spacing={2}>
            {(["id_front", "id_back", "selfie"] as Slot[]).map((slot) => (
              <UploadTile
                key={slot}
                slot={slot}
                state={uploads[slot]}
                onFileSelect={handleFileSelect}
              />
            ))}
          </Stack>
          {(errors.id_front || errors.id_back || errors.selfie) && (
            <FormHelperText error sx={{ mt: 1 }}>
              All three photos are required to continue
            </FormHelperText>
          )}
        </Box>

        <Button
          type="submit"
          variant="contained"
          size="large"
          endIcon={<ArrowForwardRounded />}
          disabled={submitting || anyUploading}
          fullWidth
          sx={{ mt: 1 }}
        >
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </Stack>
    </Box>
  );
}
