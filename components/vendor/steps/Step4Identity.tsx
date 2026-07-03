'use client';

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  BadgeRounded,
  CheckCircleRounded,
  ErrorOutlineRounded,
  FaceRounded,
  LockRounded,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import { applyIdFormat, GHANA_ID_SPECS, initialIdValue } from "@/lib/ghana";
import type { StepProps } from "../SellerOnboardingWizard";

type Screen = "id_entry" | "nia_confirm" | "face_capture" | "locked";

interface NIAData {
  sessionId: string;
  fullName: string;
  dob: string;
  gender: string;
  mock: boolean;
}

interface FaceVerifyResult {
  verified: boolean;
  confidence: number;
  message: string;
}

// ---------------------------------------------------------------------------
// SmartSelfie wrapper
// ---------------------------------------------------------------------------

function SmileSelfieCapture({
  onImages,
  onError,
}: {
  onImages: (images: { image_type_id: number; image: string }[]) => void;
  onError: (msg: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tokenData, setTokenData] = React.useState<{
    partnerId: string;
    timestamp: string;
    signature: string;
    environment: string;
    mock: boolean;
  } | null>(null);
  const [tokenError, setTokenError] = React.useState("");

  React.useEffect(() => {
    api.getSmileIdToken()
      .then(setTokenData)
      .catch(() => setTokenError("Failed to load camera component — please refresh and try again."));
  }, []);

  React.useEffect(() => {
    if (!tokenData || !containerRef.current) return;

    if (tokenData.mock) {
      // In mock mode, skip the SDK entirely and emit a fake image.
      const timer = setTimeout(() => {
        onImages([{ image_type_id: 0, image: "ZmFrZS1zZWxmaWU=" }]);
      }, 1200);
      return () => clearTimeout(timer);
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — no type declarations for this web component bundle
    import("@smileid/web-components/dist/smart-camera-web.js").then(() => {
      const el = document.createElement("smart-camera-web") as HTMLElement & {
        partnerId: string;
        authToken: string;
        environment: string;
      };
      el.setAttribute("document-capture-modes", "selfie");
      el.setAttribute("hide-back-to-host", "");
      el.partnerId = tokenData.partnerId;
      el.authToken = tokenData.signature;
      el.environment = tokenData.environment;
      el.addEventListener("imagesComputed", (e: Event) => {
        const detail = (e as CustomEvent<{ images: { image_type_id: number; image: string }[] }>).detail;
        onImages(detail.images ?? []);
      });
      el.addEventListener("exit", () => {
        onError("Camera capture was cancelled. Please try again.");
      });
      containerRef.current!.replaceChildren(el);
    }).catch(() => {
      onError("Failed to load the selfie component — please try again.");
    });
  }, [tokenData]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tokenError) {
    return <Alert severity="error">{tokenError}</Alert>;
  }

  if (!tokenData) {
    return (
      <Stack alignItems="center" spacing={1.5} py={4}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">Loading camera…</Typography>
      </Stack>
    );
  }

  if (tokenData.mock) {
    return (
      <Stack alignItems="center" spacing={2} py={4}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Simulating selfie capture (mock mode)…
        </Typography>
      </Stack>
    );
  }

  return (
    <Box ref={containerRef} sx={{ width: "100%", minHeight: 320 }} />
  );
}

// ---------------------------------------------------------------------------
// Screen A — Ghana Card number entry
// ---------------------------------------------------------------------------

function IdEntryScreen({
  idNumber,
  onChange,
  onLookup,
  loading,
  error,
}: {
  idNumber: string;
  onChange: (v: string) => void;
  onLookup: () => void;
  loading: boolean;
  error: string;
}) {
  const spec = GHANA_ID_SPECS["ghana-card"];
  const trimmed = idNumber.trim();
  const isValid = trimmed.length > 0 && trimmed !== "GHA-" && !spec?.validate(trimmed);

  return (
    <Stack spacing={2.5}>
      <Alert severity="info" icon={<BadgeRounded />} sx={{ borderRadius: 2 }}>
        Enter your Ghana Card number exactly as shown on your card.
        We'll verify it with the National Identification Authority.
      </Alert>

      <Box>
        {spec && (
          <Box
            sx={(theme) => ({
              mb: 1,
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.info.main, 0.07),
              border: "1px solid",
              borderColor: alpha(theme.palette.info.main, 0.2),
            })}
          >
            <Typography variant="caption" color="text.secondary" display="block" mb={0.25}>
              Format
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.06em", fontSize: "0.8rem" }}
            >
              {spec.placeholder}
            </Typography>
          </Box>
        )}

        <TextField
          label="Ghana Card number"
          value={idNumber}
          onChange={(e) => onChange(applyIdFormat(e.target.value, "ghana-card"))}
          error={!!error}
          helperText={error || spec?.formatHint}
          fullWidth
          required
          disabled={loading}
          slotProps={{
            htmlInput: {
              style: { textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.06em" },
              spellCheck: false,
              autoCorrect: "off",
              autoCapitalize: "characters",
            },
          }}
        />
      </Box>

      <Button
        variant="contained"
        size="large"
        endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardRounded />}
        onClick={onLookup}
        disabled={!isValid || loading}
        fullWidth
      >
        {loading ? "Looking up…" : "Verify my Ghana Card"}
      </Button>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Screen B — NIA confirm card
// ---------------------------------------------------------------------------

function NiaConfirmScreen({
  data,
  onConfirm,
  onBack,
}: {
  data: NIAData;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <Stack spacing={2.5}>
      <Alert severity="success" sx={{ borderRadius: 2 }}>
        We found your Ghana Card record. Please confirm the details below are yours.
      </Alert>

      {data.mock && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Running in test mode — this is simulated NIA data.
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <DataRow label="Full name" value={data.fullName} />
            <Divider />
            <DataRow label="Date of birth" value={formatDob(data.dob)} />
            <Divider />
            <DataRow label="Gender" value={data.gender} />
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary">
        If these details are correct and match the person on the card, tap{" "}
        <strong>Yes, that's me</strong> to continue to the face match step.
      </Typography>

      <Stack direction="row" spacing={1.5}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackRounded />}
          onClick={onBack}
          sx={{ flex: 1 }}
        >
          Not me
        </Button>
        <Button
          variant="contained"
          endIcon={<FaceRounded />}
          onClick={onConfirm}
          sx={{ flex: 2 }}
        >
          Yes, that's me
        </Button>
      </Stack>
    </Stack>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={700}>{value || "—"}</Typography>
    </Stack>
  );
}

function formatDob(dob: string): string {
  if (!dob) return "—";
  try {
    return new Date(dob).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return dob;
  }
}

// ---------------------------------------------------------------------------
// Screen C — Face capture
// ---------------------------------------------------------------------------

function FaceCaptureScreen({
  sessionId,
  onComplete,
  onError,
  attemptCount,
  maxAttempts,
}: {
  sessionId: string;
  onComplete: (result: FaceVerifyResult) => void;
  onError: (msg: string) => void;
  attemptCount: number;
  maxAttempts: number;
}) {
  const [verifying, setVerifying] = React.useState(false);
  const [captureError, setCaptureError] = React.useState("");

  async function handleImages(images: { image_type_id: number; image: string }[]) {
    setVerifying(true);
    setCaptureError("");
    try {
      const result = await api.faceVerify(sessionId, images);
      onComplete(result);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Verification failed — please try again.";
      setCaptureError(msg);
    } finally {
      setVerifying(false);
    }
  }

  const remaining = maxAttempts - attemptCount;

  return (
    <Stack spacing={2}>
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        <Typography variant="body2" fontWeight={600}>Live selfie required</Typography>
        <Typography variant="body2">
          Look directly at the camera in good lighting. We'll match your face to
          your Ghana Card record to complete verification.
        </Typography>
      </Alert>

      {remaining < maxAttempts && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          {remaining} attempt{remaining !== 1 ? "s" : ""} remaining.
        </Alert>
      )}

      {captureError && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>{captureError}</Alert>
      )}

      {verifying ? (
        <Stack alignItems="center" spacing={1.5} py={4}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">Checking your face match…</Typography>
        </Stack>
      ) : (
        <SmileSelfieCapture
          onImages={handleImages}
          onError={(msg) => { setCaptureError(msg); onError(msg); }}
        />
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Locked screen
// ---------------------------------------------------------------------------

function LockedScreen() {
  return (
    <Stack alignItems="center" spacing={2} py={4} textAlign="center">
      <LockRounded sx={{ fontSize: 52, color: "error.main" }} />
      <Typography variant="h6" fontWeight={700}>Verification locked</Typography>
      <Typography variant="body2" color="text.secondary">
        You've reached the maximum number of verification attempts.
        Please contact Spree support to continue your application.
      </Typography>
      <Button variant="outlined" href="mailto:support@spree.com">
        Contact support
      </Button>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main Step4Identity component
// ---------------------------------------------------------------------------

export function Step4Identity({ profile, onSubmit, submitting }: StepProps) {
  const maxAttempts = 3;

  // If already verified, skip straight to the submit step.
  const alreadyVerified = profile?.governmentIdVerified === true;

  const [screen, setScreen] = React.useState<Screen>(() => {
    if (alreadyVerified) return "face_capture"; // will show verified state
    if ((profile?.verificationAttemptCount ?? 0) >= maxAttempts) return "locked";
    return "id_entry";
  });

  const [idNumber, setIdNumber] = React.useState(
    initialIdValue("ghana-card", profile?.governmentIdNumber || "")
  );
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [lookupError, setLookupError] = React.useState("");
  const [niaData, setNiaData] = React.useState<NIAData | null>(null);
  const [attemptCount, setAttemptCount] = React.useState(profile?.verificationAttemptCount ?? 0);
  const [faceResult, setFaceResult] = React.useState<FaceVerifyResult | null>(null);
  const [faceError, setFaceError] = React.useState("");

  // If already verified, advance to next step immediately.
  React.useEffect(() => {
    if (alreadyVerified) {
      onSubmit({ governmentIdType: "ghana-card", governmentIdNumber: profile?.governmentIdNumber || "" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLookup() {
    const trimmed = idNumber.trim().toUpperCase();
    setLookupLoading(true);
    setLookupError("");
    try {
      const data = await api.lookupGhanaCard(trimmed);
      setNiaData(data);
      setScreen("nia_confirm");
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 429) {
          setLookupError("Too many attempts — please wait a while before trying again.");
        } else if (err.status === 404) {
          setLookupError("Ghana Card number not found. Please check the number and try again.");
        } else if (err.status === 503) {
          setLookupError("Identity service is temporarily unavailable. Please try again in a few minutes.");
        } else {
          setLookupError(err.message || "Verification failed — please try again.");
        }
      } else {
        setLookupError("Verification failed — please try again.");
      }
    } finally {
      setLookupLoading(false);
    }
  }

  function handleFaceComplete(result: FaceVerifyResult) {
    setFaceResult(result);
    setAttemptCount((c: number) => c + 1);

    if (result.verified) {
      onSubmit({ governmentIdType: "ghana-card", governmentIdNumber: idNumber.trim().toUpperCase() });
    } else {
      const newCount = attemptCount + 1;
      if (newCount >= maxAttempts) {
        setScreen("locked");
      } else {
        setFaceError(result.message || "Face match failed. Please try again.");
      }
    }
  }

  if (alreadyVerified) {
    return (
      <Stack alignItems="center" spacing={2} py={4} textAlign="center">
        <CheckCircleRounded sx={{ fontSize: 52, color: "success.main" }} />
        <Typography variant="h6" fontWeight={700}>Identity already verified</Typography>
        <Typography variant="body2" color="text.secondary">
          Your Ghana Card has been verified. Continuing to the next step…
        </Typography>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={0.5}>
        Identity verification
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        We verify every vendor with the National Identification Authority to keep Spree safe.
      </Typography>

      {screen === "id_entry" && (
        <IdEntryScreen
          idNumber={idNumber}
          onChange={setIdNumber}
          onLookup={handleLookup}
          loading={lookupLoading}
          error={lookupError}
        />
      )}

      {screen === "nia_confirm" && niaData && (
        <NiaConfirmScreen
          data={niaData}
          onConfirm={() => { setFaceError(""); setScreen("face_capture"); }}
          onBack={() => { setNiaData(null); setScreen("id_entry"); }}
        />
      )}

      {screen === "face_capture" && niaData && (
        <>
          {faceResult && !faceResult.verified && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {faceError || "Face match failed. Please try again."}
            </Alert>
          )}
          <FaceCaptureScreen
            sessionId={niaData.sessionId}
            onComplete={handleFaceComplete}
            onError={(msg) => setFaceError(msg)}
            attemptCount={attemptCount}
            maxAttempts={maxAttempts}
          />
        </>
      )}

      {screen === "locked" && <LockedScreen />}
    </Box>
  );
}
