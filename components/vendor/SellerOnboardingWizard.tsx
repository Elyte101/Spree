'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { ArrowBackRounded, CheckRounded } from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import type { OnboardingState } from "@/types/types";
import type {
  OnboardingStep1Payload,
  OnboardingStep2Payload,
  OnboardingStep3Payload,
  OnboardingStep4Payload,
  OnboardingStep5Payload,
} from "@/lib/api/types";

import { Step1BasicInfo } from "./steps/Step1BasicInfo";
import { Step2Location } from "./steps/Step2Location";
import { Step3Business } from "./steps/Step3Business";
import { Step4Identity } from "./steps/Step4Identity";
import { Step5Payout } from "./steps/Step5Payout";

const STEP_LABELS = [
  "Your info",
  "Location",
  "Your store",
  "Identity",
  "Payout",
];

export type StepPayload =
  | OnboardingStep1Payload
  | OnboardingStep2Payload
  | OnboardingStep3Payload
  | OnboardingStep4Payload
  | OnboardingStep5Payload;

export interface StepProps {
  profile: OnboardingState["profile"] | null;
  onSubmit: (data: StepPayload) => Promise<void>;
  submitting: boolean;
}

export function VendorOnboardingWizard() {
  const router = useRouter();
  const [state, setState] = React.useState<OnboardingState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [activeStep, setActiveStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  React.useEffect(() => {
    api.getOnboardingState()
      .then((s) => {
        setState(s);
        // Resume at last incomplete step (0-indexed, so step N means they finished N)
        const resumeAt = Math.min(s.step, 4);
        setActiveStep(resumeAt);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiClientError ? err.message : "Failed to load your profile");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleStepSubmit(data: StepPayload) {
    setSubmitting(true);
    setStepError(null);
    const stepNumber = (activeStep + 1) as 1 | 2 | 3 | 4 | 5;
    try {
      const updatedProfile = await api.saveOnboardingStep(stepNumber, data);
      setState((prev) => prev ? { ...prev, step: stepNumber, profile: updatedProfile } : prev);

      if (activeStep < 4) {
        setActiveStep((s) => s + 1);
      } else {
        // Step 5 complete — submit
        await api.submitOnboarding();
        setSubmitSuccess(true);
        setTimeout(() => router.push("/settings?tab=store&msg=under_review"), 1800);
      }
    } catch (err) {
      setStepError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Container maxWidth="sm" sx={{ pt: 8 }}>
        <Alert severity="error">{loadError}</Alert>
      </Container>
    );
  }

  if (submitSuccess) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" gap={2}>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            bgcolor: "success.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckRounded sx={{ color: "white", fontSize: 40 }} />
        </Box>
        <Typography variant="h5" fontWeight={700}>Application submitted!</Typography>
        <Typography color="text.secondary" textAlign="center">
          We&apos;ll review your documents within 1–2 business days.
        </Typography>
      </Box>
    );
  }

  const stepProps: StepProps = {
    profile: state?.profile ?? null,
    onSubmit: handleStepSubmit,
    submitting,
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      {/* Header */}
      <Box mb={4} textAlign="center">
        <Typography variant="h4" fontWeight={800} color="text.primary" gutterBottom>
          Become a vendor
        </Typography>
        <Typography color="text.secondary">
          Complete your profile to start listing products on Spree.
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEP_LABELS.map((label, i) => (
          <Step key={label} completed={i < (state?.step ?? 0)}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step content */}
      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
        {stepError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setStepError(null)}>
            {stepError}
          </Alert>
        )}

        {activeStep === 0 && <Step1BasicInfo {...stepProps} />}
        {activeStep === 1 && <Step2Location {...stepProps} />}
        {activeStep === 2 && <Step3Business {...stepProps} />}
        {activeStep === 3 && <Step4Identity {...stepProps} />}
        {activeStep === 4 && <Step5Payout {...stepProps} />}
      </Paper>

      {/* Back navigation (shown after step 0) */}
      {activeStep > 0 && (
        <Box mt={2}>
          <Button
            startIcon={<ArrowBackRounded />}
            onClick={handleBack}
            disabled={submitting}
            color="primary"
          >
            Back
          </Button>
        </Box>
      )}
    </Container>
  );
}
