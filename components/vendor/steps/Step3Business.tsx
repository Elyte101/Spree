'use client';

import * as React from "react";
import {
  Avatar,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { ArrowForwardRounded, AddPhotoAlternateRounded } from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep3Payload } from "@/lib/api/types";

export function Step3Business({ profile, onSubmit, submitting }: StepProps) {
  const contact = profile?.sellerContact as Record<string, string> | undefined;
  const [storeName, setStoreName] = React.useState(profile?.storeName || "");
  const [storeTagline, setStoreTagline] = React.useState(profile?.storeTagline || "");
  const [storeDescription, setStoreDescription] = React.useState(profile?.storeDescription || "");
  const [sellerType, setSellerType] = React.useState<"retail" | "wholesale">(profile?.sellerType || "retail");
  const [businessType, setBusinessType] = React.useState<"individual" | "registered">("individual");
  const [registrationNumber, setRegistrationNumber] = React.useState(contact?.registrationNumber || "");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(contact?.logoUrl || null);
  const [logoUploading, setLogoUploading] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please select an image file");
      return;
    }
    setLogoUploading(true);
    setLogoError(null);
    try {
      const { uploadUrl, path } = await api.getUploadUrl("logo");
      const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setLogoUrl(path);
    } catch (err) {
      setLogoError(err instanceof ApiClientError ? err.message : "Logo upload failed");
    } finally {
      setLogoUploading(false);
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!storeName.trim()) e.storeName = "Store name is required";
    if (storeName.trim().length < 3) e.storeName = "Store name must be at least 3 characters";
    if (!storeDescription.trim()) e.storeDescription = "Please add a brief store description";
    if (businessType === "registered" && !registrationNumber.trim()) {
      e.registrationNumber = "Registration number is required for registered businesses";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: OnboardingStep3Payload = {
      storeName: storeName.trim(),
      storeDescription: storeDescription.trim(),
      storeTagline: storeTagline.trim() || undefined,
      sellerType,
      businessType,
      registrationNumber: businessType === "registered" ? registrationNumber.trim() : undefined,
      logoUrl: logoUrl || undefined,
    };
    await onSubmit(payload);
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        Tell us about your store
      </Typography>

      <Stack spacing={2.5}>
        {/* Logo upload */}
        <Box display="flex" alignItems="center" gap={2}>
          <Box position="relative">
            <Avatar
              src={logoUrl ? undefined : undefined}
              sx={{ width: 72, height: 72, bgcolor: "primary.main", fontSize: 28, cursor: "pointer" }}
              onClick={() => fileRef.current?.click()}
            >
              {storeName[0]?.toUpperCase() || "S"}
            </Avatar>
            {logoUploading && (
              <Box
                position="absolute"
                top={0} left={0} right={0} bottom={0}
                display="flex" alignItems="center"
                justifyContent="center" bgcolor="rgba(0,0,0,0.4)" borderRadius="50%"
              >
                <CircularProgress size={24} sx={{ color: "white" }} />
              </Box>
            )}
          </Box>
          <Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddPhotoAlternateRounded />}
              onClick={() => fileRef.current?.click()}
              disabled={logoUploading}
            >
              {logoUrl ? "Change logo" : "Add logo"}
            </Button>
            {logoError && <FormHelperText error>{logoError}</FormHelperText>}
            <Typography variant="caption" color="text.secondary" display="block">
              Optional · PNG or JPG · up to 5 MB
            </Typography>
          </Box>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleLogoSelect}
          />
        </Box>

        <TextField
          label="Store name"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          error={!!errors.storeName}
          helperText={errors.storeName || "This becomes your public store URL"}
          fullWidth
          required
          inputProps={{ maxLength: 60 }}
        />

        <TextField
          label="Tagline (optional)"
          value={storeTagline}
          onChange={(e) => setStoreTagline(e.target.value)}
          fullWidth
          placeholder="e.g. Quality fashion at affordable prices"
          inputProps={{ maxLength: 120 }}
        />

        <TextField
          label="Store description"
          value={storeDescription}
          onChange={(e) => setStoreDescription(e.target.value)}
          error={!!errors.storeDescription}
          helperText={errors.storeDescription || "What do you sell? Who are your customers?"}
          fullWidth
          required
          multiline
          minRows={3}
          inputProps={{ maxLength: 500 }}
        />

        <FormControl>
          <FormLabel sx={{ mb: 1, fontWeight: 600, color: "text.primary" }}>
            What do you sell?
          </FormLabel>
          <RadioGroup
            row
            value={sellerType}
            onChange={(e) => setSellerType(e.target.value as "retail" | "wholesale")}
          >
            <FormControlLabel value="retail" control={<Radio />} label="Retail (individual buyers)" />
            <FormControlLabel value="wholesale" control={<Radio />} label="Wholesale (bulk / businesses)" />
          </RadioGroup>
        </FormControl>

        <FormControl>
          <FormLabel sx={{ mb: 1, fontWeight: 600, color: "text.primary" }}>
            Business type
          </FormLabel>
          <RadioGroup
            row
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value as "individual" | "registered")}
          >
            <FormControlLabel value="individual" control={<Radio />} label="Individual / sole trader" />
            <FormControlLabel value="registered" control={<Radio />} label="Registered business" />
          </RadioGroup>
        </FormControl>

        {businessType === "registered" && (
          <TextField
            label="Business registration number"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            error={!!errors.registrationNumber}
            helperText={errors.registrationNumber || "e.g. Registrar General's Department number"}
            fullWidth
            required
          />
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          endIcon={<ArrowForwardRounded />}
          disabled={submitting || logoUploading}
          fullWidth
          sx={{ mt: 1 }}
        >
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </Stack>
    </Box>
  );
}
