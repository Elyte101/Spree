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
import { CreditCardRounded, CheckRounded, PhoneAndroidRounded } from "@mui/icons-material";

import { MOMO_NETWORKS, validateMoMoNumber } from "@/lib/ghana";
import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep5Payload } from "@/lib/api/types";

// Spec: payout is card OR MoMo (MTN/Telecel only). NO bank account fields.
export function Step5Payout({ profile, onSubmit, submitting }: StepProps) {
  const payout = profile?.payoutInfo;
  const [method, setMethod] = React.useState<"card" | "mobile_money">(
    (payout?.method as "card" | "mobile_money") || "mobile_money"
  );
  const [accountName, setAccountName] = React.useState(payout?.accountName || profile?.name || "");
  // MoMo fields
  const [network, setNetwork]   = React.useState(payout?.mobileMoneyNetwork || MOMO_NETWORKS[0].value);
  const [momoNumber, setMomoNumber] = React.useState(payout?.mobileMoneyNumber || "");
  // Card fields (reference info only — not raw card data)
  const [cardLast4, setCardLast4] = React.useState(payout?.cardLast4 || "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!accountName.trim()) e.accountName = "Account name is required";
    if (method === "mobile_money") {
      if (!network)               e.network    = "Select a network";
      if (!momoNumber.trim()) {
        e.momoNumber = "Mobile money number is required";
      } else {
        const momoErr = validateMoMoNumber(momoNumber);
        if (momoErr) e.momoNumber = momoErr;
      }
    } else {
      // card
      if (!cardLast4.trim()) e.cardLast4 = "Card last 4 digits are required";
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
      ...(method === "mobile_money"
        ? { mobileMoneyNetwork: network, mobileMoneyNumber: momoNumber.trim() }
        : { cardLast4: cardLast4.trim() }),
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
            onChange={(e) => setMethod(e.target.value as "card" | "mobile_money")}
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
              value="card"
              control={<Radio />}
              label={
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <CreditCardRounded fontSize="small" />
                  <span>Card</span>
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
              slotProps={{ htmlInput: { inputMode: "tel", maxLength: 13 } }}
            />

            {network && momoNumber && !errors.momoNumber && (
              <Alert severity="success" icon={false} sx={{ borderRadius: 2, py: 1 }}>
                Payouts will be sent to <strong>{momoNumber}</strong> via <strong>{network}</strong>.
              </Alert>
            )}

            <Box sx={(theme) => ({ p: 2, borderRadius: 2, bgcolor: theme.palette.action.hover })}>
              <Typography variant="caption" color="text.secondary" lineHeight={1.7}>
                <strong>MTN Mobile Money:</strong> numbers starting with 024, 054, 055, 059<br />
                <strong>Telecel Cash:</strong> numbers starting with 020, 050
              </Typography>
            </Box>
          </>
        ) : (
          <>
            <TextField
              label="Card last 4 digits"
              value={cardLast4}
              onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              error={!!errors.cardLast4}
              helperText={errors.cardLast4 || "Last 4 digits of your Spree-registered card"}
              fullWidth
              required
              slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 4 } }}
            />
            <Alert severity="info" icon={false} sx={{ borderRadius: 2, py: 1 }}>
              Payouts to cards are processed via your registered Paystack account. Make sure your card is active.
            </Alert>
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
