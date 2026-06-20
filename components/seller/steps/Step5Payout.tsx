'use client';

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AccountBalanceRounded, CheckRounded, PhoneAndroidRounded } from "@mui/icons-material";

import { MOMO_NETWORKS, validateMoMoNumber } from "@/lib/ghana";
import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep5Payload } from "@/lib/api/types";

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
  const [bankName, setBankName]           = React.useState(payout?.bankName || "");
  const [accountNumber, setAccountNumber] = React.useState(payout?.accountNumber || "");
  const [bankCode, setBankCode]           = React.useState(payout?.bankCode || "");
  // MoMo fields
  const [network, setNetwork]   = React.useState(payout?.mobileMoneyNetwork || MOMO_NETWORKS[0].value);
  const [momoNumber, setMomoNumber] = React.useState(payout?.mobileMoneyNumber || "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!accountName.trim()) e.accountName = "Account name is required";
    if (method === "bank") {
      if (!bankName)              e.bankName      = "Select your bank";
      if (!accountNumber.trim())  e.accountNumber = "Account number is required";
    } else {
      if (!network)               e.network    = "Select a network";
      if (!momoNumber.trim()) {
        e.momoNumber = "Mobile money number is required";
      } else {
        const momoErr = validateMoMoNumber(momoNumber);
        if (momoErr) e.momoNumber = momoErr;
      }
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
        Payouts are released after buyers confirm delivery. You can update this any time in your profile settings.
      </Typography>

      <Stack spacing={2.5}>
        <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
          Make sure the account belongs to you — payouts are sent directly to this account.
        </Alert>

        <FormControl>
          <FormLabel sx={{ mb: 1, fontWeight: 700, color: "text.primary" }}>
            Payout method
          </FormLabel>
          <RadioGroup
            row
            value={method}
            onChange={(e) => setMethod(e.target.value as "bank" | "mobile_money")}
          >
            <FormControlLabel
              value="mobile_money"
              control={<Radio />}
              label={
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <PhoneAndroidRounded fontSize="small" color="primary" />
                  <span>Mobile Money</span>
                </Stack>
              }
            />
            <FormControlLabel
              value="bank"
              control={<Radio />}
              label={
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <AccountBalanceRounded fontSize="small" />
                  <span>Bank transfer</span>
                </Stack>
              }
            />
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
              {MOMO_NETWORKS.map((n) => (
                <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Mobile money number"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              onBlur={() => {
                if (momoNumber.trim()) {
                  const err = validateMoMoNumber(momoNumber.trim());
                  setErrors((prev) => ({ ...prev, momoNumber: err ?? "" }));
                }
              }}
              error={!!errors.momoNumber}
              helperText={errors.momoNumber || "Ghana number: 0XX XXX XXXX (10 digits)"}
              fullWidth
              required
              placeholder="0241234567"
              inputProps={{ inputMode: "tel", maxLength: 13 }}
            />

            {network && momoNumber && !errors.momoNumber && (
              <Alert severity="success" icon={false} sx={{ borderRadius: 2, py: 1 }}>
                Payouts will be sent to <strong>{momoNumber}</strong> via <strong>{network}</strong>.
              </Alert>
            )}
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

        {method === "mobile_money" && (
          <Box sx={(theme) => ({ p: 2, borderRadius: 2, bgcolor: theme.palette.action.hover })}>
            <Typography variant="caption" color="text.secondary" lineHeight={1.7}>
              <strong>MTN Mobile Money:</strong> numbers starting with 024, 054, 055, 059<br />
              <strong>Vodafone Cash:</strong> numbers starting with 020, 050<br />
              <strong>AirtelTigo Money:</strong> numbers starting with 026, 027, 056, 057
            </Typography>
          </Box>
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
