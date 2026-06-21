'use client';

import * as React from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowForwardRounded } from "@mui/icons-material";

import { COUNTRY_LIST, COUNTRY_REGIONS } from "@/lib/ghana";
import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep2Payload } from "@/lib/api/types";

export function Step2Location({ profile, onSubmit, submitting }: StepProps) {
  const loc = profile?.storeLocation;
  const [country, setCountry] = React.useState(loc?.country || "Ghana");
  const [state, setState] = React.useState(loc?.state || "");
  const [city, setCity] = React.useState(loc?.city || "");
  const [addressLine1, setAddressLine1] = React.useState(loc?.addressLine1 || "");
  const [postalCode, setPostalCode] = React.useState(loc?.postalCode || "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const regions = COUNTRY_REGIONS[country] ?? [];

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!country) e.country = "Country is required";
    if (!state.trim()) e.state = "Region / state is required";
    if (!city.trim()) e.city = "City is required";
    if (!addressLine1.trim()) e.addressLine1 = "Address is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: OnboardingStep2Payload = {
      country,
      state: state.trim(),
      city: city.trim(),
      addressLine1: addressLine1.trim(),
      postalCode: postalCode.trim() || undefined,
    };
    await onSubmit(payload);
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        Where are you located?
      </Typography>

      <Stack spacing={2.5}>
        <TextField
          select
          label="Country"
          value={country}
          onChange={(e) => { setCountry(e.target.value); setState(""); }}
          error={!!errors.country}
          helperText={errors.country}
          fullWidth
        >
          {COUNTRY_LIST.map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>

        {regions.length > 0 ? (
          <TextField
            select
            label="Region / State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            error={!!errors.state}
            helperText={errors.state}
            fullWidth
            required
          >
            {regions.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </TextField>
        ) : (
          <TextField
            label="Region / State / Province"
            value={state}
            onChange={(e) => setState(e.target.value)}
            error={!!errors.state}
            helperText={errors.state}
            fullWidth
            required
          />
        )}

        <TextField
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={!!errors.city}
          helperText={errors.city}
          fullWidth
          required
        />

        <TextField
          label="Address"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          error={!!errors.addressLine1}
          helperText={errors.addressLine1 || "Street address, area, landmark"}
          fullWidth
          required
        />

        <TextField
          label="Postal / ZIP code (optional)"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          fullWidth
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          endIcon={<ArrowForwardRounded />}
          disabled={submitting}
          fullWidth
          sx={{ mt: 1 }}
        >
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </Stack>
    </Box>
  );
}
