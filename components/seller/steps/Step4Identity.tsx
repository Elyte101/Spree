'use client';

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  FormHelperText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowForwardRounded,
  BadgeRounded,
  CameraAltRounded,
  CheckCircleRounded,
  UploadFileRounded,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import { GHANA_ID_TYPES } from "@/lib/ghana";
import type { GovernmentIdType } from "@/types/types";
import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep4Payload } from "@/lib/api/types";

type Slot = "id_front" | "id_back" | "selfie";

interface UploadSlotState {
  path: string | null;
  uploading: boolean;
  error: string | null;
}

const SLOT_LABELS: Record<Slot, { label: string; hint: string; icon: React.ReactNode }> = {
  id_front: {
    label: "ID front",
    hint: "Clear photo of the front of your ID",
    icon: <BadgeRounded sx={{ fontSize: 32, color: "text.disabled" }} />,
  },
  id_back: {
    label: "ID back",
    hint: "Clear photo of the back of your ID",
    icon: <BadgeRounded sx={{ fontSize: 32, color: "text.disabled", transform: "scaleX(-1)" }} />,
  },
  selfie: {
    label: "Selfie with ID",
    hint: "Hold your ID next to your face",
    icon: <CameraAltRounded sx={{ fontSize: 32, color: "text.disabled" }} />,
  },
};

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
  const meta = SLOT_LABELS[slot];
  const done = !!state.path && !state.uploading;

  return (
    <Box>
      <ButtonBase
        sx={{
          width: "100%",
          border: "2px dashed",
          borderColor: done ? "success.main" : state.error ? "error.main" : "divider",
          borderRadius: 2,
          p: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          bgcolor: done ? "success.50" : "transparent",
          cursor: "pointer",
          transition: "border-color 0.2s",
          "&:hover": { borderColor: "primary.main" },
        }}
        onClick={() => inputRef.current?.click()}
        disabled={state.uploading}
      >
        {state.uploading ? (
          <CircularProgress size={32} />
        ) : done ? (
          <CheckCircleRounded sx={{ fontSize: 32, color: "success.main" }} />
        ) : (
          meta.icon
        )}
        <Typography variant="body2" fontWeight={600}>
          {done ? "Uploaded" : meta.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" textAlign="center">
          {done ? "Tap to replace" : meta.hint}
        </Typography>
        {!done && !state.uploading && (
          <Button
            component="span"
            variant="outlined"
            size="small"
            startIcon={<UploadFileRounded />}
            sx={{ mt: 0.5, pointerEvents: "none" }}
          >
            Choose file
          </Button>
        )}
      </ButtonBase>
      {state.error && <FormHelperText error>{state.error}</FormHelperText>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
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

export function Step4Identity({ profile, onSubmit, submitting }: StepProps) {
  const [idType, setIdType] = React.useState<GovernmentIdType>(
    (profile?.governmentIdType as GovernmentIdType) || "ghana-card"
  );
  const [idNumber, setIdNumber] = React.useState(profile?.governmentIdNumber || "");
  const [uploads, setUploads] = React.useState<Record<Slot, UploadSlotState>>({
    id_front: { path: profile?.idFrontUrl || null, uploading: false, error: null },
    id_back: { path: profile?.idBackUrl || null, uploading: false, error: null },
    selfie: { path: profile?.selfieUrl || null, uploading: false, error: null },
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  async function handleFileSelect(slot: Slot, file: File) {
    setUploads((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], uploading: true, error: null },
    }));
    try {
      const { uploadUrl, path } = await api.getUploadUrl(slot);
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error("Upload failed");
      setUploads((prev) => ({
        ...prev,
        [slot]: { path, uploading: false, error: null },
      }));
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
    if (!idNumber.trim()) e.idNumber = "ID number is required";
    if (!uploads.id_front.path) e.id_front = "Please upload the front of your ID";
    if (!uploads.id_back.path) e.id_back = "Please upload the back of your ID";
    if (!uploads.selfie.path) e.selfie = "Please upload a selfie with your ID";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: OnboardingStep4Payload = {
      governmentIdType: idType,
      governmentIdNumber: idNumber.trim(),
      idFrontUrl: uploads.id_front.path!,
      idBackUrl: uploads.id_back.path!,
      selfieUrl: uploads.selfie.path!,
    };
    await onSubmit(payload);
  }

  const anyUploading = Object.values(uploads).some((u) => u.uploading);

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" fontWeight={700} mb={1}>
        Identity verification
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        We verify every seller to keep Spree safe. Your documents are stored securely and only
        seen by our review team.
      </Typography>

      <Stack spacing={2.5}>
        <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
          Make sure your ID is valid and the photos are clear and well-lit.
        </Alert>

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

        <TextField
          label="ID number"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
          error={!!errors.idNumber}
          helperText={errors.idNumber || (idType === "ghana-card" ? "e.g. GHA-123456789-0" : undefined)}
          fullWidth
          required
          inputProps={{ style: { textTransform: "uppercase" } }}
        />

        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
            Upload photos
          </Typography>
          <Stack spacing={1.5}>
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
              Please upload all three photos to continue
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
