"use client";

import * as React from "react";

export type BankResolveStatus = "idle" | "loading" | "resolved" | "failed";

export interface BankResolveState {
  status: BankResolveStatus;
  resolvedName: string | null;
  failReason: string | null;
}

const IDLE: BankResolveState = { status: "idle", resolvedName: null, failReason: null };

/**
 * Debounced bank account name-enquiry hook.
 *
 * Triggers automatically when both `accountNumber` (10 digits) and `bankCode` are set.
 * Returns idle otherwise.
 *
 * Never throws — on any backend error the status becomes "failed" so the
 * caller can fall back to manual name entry without blocking the user.
 */
export function useBankResolve(
  accountNumber: string,
  bankCode: string,
  debounceMs = 600,
): BankResolveState {
  const [state, setState] = React.useState<BankResolveState>(IDLE);

  const trimmed = accountNumber.trim();
  const isValid = trimmed.length >= 10 && !!bankCode;

  React.useEffect(() => {
    if (!isValid) {
      setState(IDLE);
      return;
    }

    setState((s) => (s.status === "loading" ? s : { ...IDLE, status: "loading" }));

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ account_number: trimmed, bank_code: bankCode });
        const res = await fetch(`/api/banks/resolve?${params.toString()}`);

        const data = (await res.json()) as {
          resolved?: boolean;
          name?: string;
          error?: string;
          detail?: string;
        };

        if (!res.ok || data.error || data.detail) {
          setState({
            status: "failed",
            resolvedName: null,
            failReason: data.error ?? data.detail ?? "Lookup unavailable",
          });
          return;
        }

        if (data.resolved && typeof data.name === "string" && data.name.trim()) {
          setState({ status: "resolved", resolvedName: data.name.trim(), failReason: null });
        } else {
          setState({ status: "failed", resolvedName: null, failReason: "Could not verify account" });
        }
      } catch {
        setState({ status: "failed", resolvedName: null, failReason: "Lookup unavailable" });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, bankCode, isValid, debounceMs]);

  return state;
}
