'use client';

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import {
  AccountBalanceRounded,
  CheckRounded,
  CheckCircleRounded,
  PhoneAndroidRounded,
} from "@mui/icons-material";

import { MOMO_NETWORKS, validateMoMoNumber } from "@/lib/ghana";
import { useMomoResolve } from "@/lib/hooks/useMomoResolve";
import { useBankResolve } from "@/lib/hooks/useBankResolve";
import type { StepProps } from "../SellerOnboardingWizard";
import type { OnboardingStep5Payload } from "@/lib/api/types";

interface BankOption {
  id: number;
  name: string;
  code: string;
}

export function Step5Payout({ profile, onSubmit, submitting }: StepProps) {
  const payout = profile?.payoutInfo;
  const [method, setMethod] = React.useState<"mobile_money" | "bank">(
    payout?.method === "bank" ? "bank" : "mobile_money"
  );
  const [accountName, setAccountName] = React.useState(payout?.accountName || profile?.name || "");
  // MoMo fields
  const [network, setNetwork] = React.useState(payout?.mobileMoneyNetwork || MOMO_NETWORKS[0].value);
  const [momoNumber, setMomoNumber] = React.useState(payout?.mobileMoneyNumber || "");
  // Bank fields
  const [bankCode, setBankCode] = React.useState(payout?.bankCode || "");
  const [bankName, setBankName] = React.useState(payout?.bankName || "");
  const [accountNumber, setAccountNumber] = React.useState(payout?.accountNumber || "");
  const [banks, setBanks] = React.useState<BankOption[]>([]);
  const [nameVerified, setNameVerified] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Fetch bank list once on mount
  React.useEffect(() => {
    fetch("/api/banks")
      .then((r) => r.json())
      .then((d: { data?: BankOption[] }) => {
        if (d.data) setBanks(d.data);
      })
      .catch(() => {/* non-fatal — user can still type bank name */});
  }, []);

  // Auto-resolve names
  const momoResolve = useMomoResolve(momoNumber, network);
  const bankResolve = useBankResolve(accountNumber, bankCode);

  React.useEffect(() => {
    if (momoResolve.status === "resolved" && momoResolve.resolvedName) {
      setAccountName(momoResolve.resolvedName);
      setNameVerified(true);
    } else if (momoResolve.status === "failed") {
      setNameVerified(false);
    }
  }, [momoResolve.status, momoResolve.resolvedName]);

  React.useEffect(() => {
    if (bankResolve.status === "resolved" && bankResolve.resolvedName) {
      setAccountName(bankResolve.resolvedName);
      setNameVerified(true);
    } else if (bankResolve.status === "failed") {
      setNameVerified(false);
    }
  }, [bankResolve.status, bankResolve.resolvedName]);

  // Reset verified state when inputs change
  const resolving = method === "mobile_money"
    ? momoResolve.status === "loading"
    : bankResolve.status === "loading";

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!accountName.trim()) e.accountName = "Account name is required";
    if (method === "mobile_money") {
      if (!network) e.network = "Select a network";
      if (!momoNumber.trim()) {
        e.momoNumber = "Mobile money number is required";
      } else {
        const err = validateMoMoNumber(momoNumber);
        if (err) e.momoNumber = err;
      }
    } else {
      if (!bankCode) e.bankCode = "Select a bank";
      if (!accountNumber.trim()) e.accountNumber = "Account number is required";
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
        : { bankCode, bankName, accountNumber: accountNumber.trim() }),
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
            onChange={(e) => {
              setMethod(e.target.value as "mobile_money" | "bank");
              setNameVerified(false);
            }}
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
                  <span>Bank Account</span>
                </Stack>
              }
            />
          </RadioGroup>
        </FormControl>

        {method === "mobile_money" ? (
          <>
            <TextField
              select
              label="Mobile network"
              value={network}
              onChange={(e) => { setNetwork(e.target.value); setNameVerified(false); }}
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
              onChange={(e) => { setMomoNumber(e.target.value); setNameVerified(false); }}
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
          </>
        ) : (
          <>
            <TextField
              select={banks.length > 0}
              label="Bank"
              value={bankCode}
              onChange={(e) => {
                const code = e.target.value;
                setBankCode(code);
                const found = banks.find((b) => b.code === code);
                setBankName(found?.name ?? code);
                setNameVerified(false);
              }}
              error={!!errors.bankCode}
              helperText={errors.bankCode}
              fullWidth
              required
            >
              {banks.map((b) => (
                <MenuItem key={b.code} value={b.code}>{b.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Account number"
              value={accountNumber}
              onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "")); setNameVerified(false); }}
              error={!!errors.accountNumber}
              helperText={errors.accountNumber || "10-digit bank account number"}
              fullWidth
              required
              placeholder="0123456789"
              slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 13 } }}
            />
          </>
        )}

        <TextField
          label="Account name"
          value={accountName}
          onChange={(e) => { setAccountName(e.target.value); setNameVerified(false); }}
          error={!!errors.accountName}
          helperText={
            resolving
              ? "Verifying account…"
              : (method === "mobile_money" ? momoResolve : bankResolve).status === "failed"
              ? "Auto-verify unavailable — enter name manually"
              : errors.accountName || (nameVerified ? "Name verified" : "Full name as it appears on the account")
          }
          fullWidth
          required
          slotProps={{
            input: {
              readOnly: nameVerified,
              endAdornment: resolving ? (
                <CircularProgress size={18} />
              ) : nameVerified ? (
                <CheckCircleRounded color="success" fontSize="small" />
              ) : null,
            },
          }}
        />

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
