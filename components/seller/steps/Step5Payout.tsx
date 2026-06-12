'use client';

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CheckRounded } from "@mui/icons-material";

import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep5Payload } from "@/lib/api/types";

const MOBILE_NETWORKS = ["MTN Mobile Money", "Vodafone Cash", "AirtelTigo Money"];

const GHANA_BANKS = [
  "Ghana Commercial Bank (GCB)",
  "Ecobank Ghana",
  "Absa Bank Ghana",
  "Standard Chartered Ghana",
  "Fidelity Bank Ghana",
  "Zenith Bank Ghana",
  "Access Bank Ghana",
  "CalBank",
  "Republic Bank Ghana",
  "Agricultural Development Bank (ADB)",
  "National Investment Bank (NIB)",
  "Consolidated Bank Ghana (CBG)",
  "UBA Ghana",
  "GT Bank Ghana",
  "Societe Generale Ghana",
  "First Atlantic Bank",
  "Universal Merchant Bank (UMB)",
  "Prudential Bank",
  "OmniBSIC Bank",
  "ARB Apex Bank",
  "Other",
];

export function Step5Payout({ profile, onSubmit, submitting }: StepProps) {
  const payout = profile?.payoutInfo;
  const [method, setMethod] = React.useState<"bank" | "mobile_money">(
    (payout?.method as "bank" | "mobile_money") || "mobile_money"
  );
  const [accountName, setAccountName] = React.useState(payout?.accountName || profile?.name || "");
  // Bank fields
  const [bankName, setBankName] = React.useState(payout?.bankName || "");
  const [accountNumber, setAccountNumber] = React.useState(payout?.accountNumber || "");
  const [bankCode, setBankCode] = React.useState(payout?.bankCode || "");
  // MoMo fields
  const [network, setNetwork] = React.useState(payout?.mobileMoneyNetwork || "MTN Mobile Money");
  const [momoNumber, setMomoNumber] = React.useState(payout?.mobileMoneyNumber || "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!accountName.trim()) e.accountName = "Account name is required";
    if (method === "bank") {
      if (!bankName) e.bankName = "Select your bank";
      if (!accountNumber.trim()) e.accountNumber = "Account number is required";
    } else {
      if (!network) e.network = "Select a network";
      if (!momoNumber.trim()) e.momoNumber = "Mobile money number is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: OnboardingStep5Payload = {
      method,
      accountName: accountName.trim(),
      currency: "GHS",
      ...(method === "bank"
        ? { bankName, accountNumber: accountNumber.trim(), bankCode: bankCode.trim() || undefined }
        : { mobileMoneyNetwork: network, mobileMoneyNumber: momoNumber.trim() }),
    };
    await onSubmit(payload);
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" fontWeight={700} mb={1}>
        How should we pay you?
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Payouts are released after buyers confirm delivery. You can update this later in settings.
      </Typography>

      <Stack spacing={2.5}>
        <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
          Make sure the account belongs to you — payouts are sent directly to this account.
        </Alert>

        <FormControl>
          <FormLabel sx={{ mb: 1, fontWeight: 600, color: "text.primary" }}>
            Payout method
          </FormLabel>
          <RadioGroup
            row
            value={method}
            onChange={(e) => setMethod(e.target.value as "bank" | "mobile_money")}
          >
            <FormControlLabel value="mobile_money" control={<Radio />} label="Mobile Money" />
            <FormControlLabel value="bank" control={<Radio />} label="Bank transfer" />
          </RadioGroup>
        </FormControl>

        <TextField
          label="Account name"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          error={!!errors.accountName}
          helperText={errors.accountName || "Full name as it appears on the account"}
          fullWidth
          required
        />

        {method === "mobile_money" ? (
          <>
            <TextField
              select
              label="Mobile network"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              error={!!errors.network}
              helperText={errors.network}
              fullWidth
              required
            >
              {MOBILE_NETWORKS.map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Mobile money number"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              error={!!errors.momoNumber}
              helperText={errors.momoNumber || "The number registered to your MoMo wallet"}
              fullWidth
              required
              placeholder="0XX XXX XXXX"
              inputProps={{ inputMode: "tel" }}
            />
          </>
        ) : (
          <>
            <TextField
              select
              label="Bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              error={!!errors.bankName}
              helperText={errors.bankName}
              fullWidth
              required
            >
              {GHANA_BANKS.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              error={!!errors.accountNumber}
              helperText={errors.accountNumber}
              fullWidth
              required
              inputProps={{ inputMode: "numeric" }}
            />

            <TextField
              label="Sort / branch code (optional)"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              fullWidth
              helperText="Some banks require this for transfers"
            />
          </>
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          endIcon={<CheckRounded />}
          disabled={submitting}
          fullWidth
          sx={{ mt: 1 }}
        >
          {submitting ? "Submitting…" : "Submit application"}
        </Button>
      </Stack>
    </Box>
  );
}
