'use client';

import * as React from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowForwardRounded } from "@mui/icons-material";

import { PhoneInput } from "@/components/ui/phoneInput";
import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep1Payload } from "@/lib/api/types";

export function Step1BasicInfo({ profile, onSubmit, submitting }: StepProps) {
  const [name, setName] = React.useState(profile?.name ?? "");
  const [phone, setPhone] = React.useState(profile?.phone ?? "");
  const [terms, setTerms] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!phone.trim() || phone.trim().length < 8) e.phone = "Enter a valid phone number";
    if (!terms) e.terms = "You must accept the vendor terms to continue";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: OnboardingStep1Payload = {
      name: name.trim(),
      phone: phone.trim(),
      termsAccepted: terms,
    };
    await onSubmit(payload);
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        Let&apos;s start with the basics
      </Typography>

      <Stack spacing={2.5}>
        <TextField
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!errors.name}
          helperText={errors.name}
          fullWidth
          required
          autoComplete="name"
        />

        <PhoneInput
          value={phone}
          onChange={setPhone}
          label="Phone number"
          required
        />
        {errors.phone && (
          <FormHelperText error sx={{ mt: -1.5 }}>{errors.phone}</FormHelperText>
        )}

        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                I agree to Spree&apos;s{" "}
                <Link href="/terms/sellers" target="_blank" rel="noopener">
                  vendor Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" rel="noopener">
                  Privacy Policy
                </Link>
              </Typography>
            }
          />
          {errors.terms && (
            <FormHelperText error>{errors.terms}</FormHelperText>
          )}
        </Box>

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
