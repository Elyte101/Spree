"use client";

import * as React from "react";
import { validateMoMoNumber } from "@/lib/ghana";

export type MomoResolveStatus = "idle" | "loading" | "resolved" | "failed";

export interface MomoResolveState {
  status: MomoResolveStatus;
  resolvedName: string | null;
  failReason: string | null;
}

const IDLE: MomoResolveState = { status: "idle", resolvedName: null, failReason: null };

/**
 * Debounced MoMo name-enquiry hook.
 *
 * Triggers automatically when `number` passes the 10-digit Ghana validation
 * AND `network` is set. Returns idle otherwise.
 *
 * Never throws — on any backend error the status becomes "failed" so the
 * caller can fall back to manual entry without blocking the user.
 */
export function useMomoResolve(
  number: string,
  network: string,
  debounceMs = 500,
): MomoResolveState {
  const [state, setState] = React.useState<MomoResolveState>(IDLE);

  const trimmed = number.trim();
  const isValid = !validateMoMoNumber(trimmed) && !!network;

  React.useEffect(() => {
    if (!isValid) {
      setState(IDLE);
      return;
    }

    setState((s) => (s.status === "loading" ? s : { ...IDLE, status: "loading" }));

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/momo/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number: trimmed, network }),
        });

        const data = (await res.json()) as {
          resolved?: boolean;
          name?: string;
          reason?: string;
          error?: string;
        };

        if (!res.ok || data.error) {
          setState({ status: "failed", resolvedName: null, failReason: data.error ?? "Lookup unavailable" });
          return;
        }

        if (data.resolved && typeof data.name === "string" && data.name.trim()) {
          setState({ status: "resolved", resolvedName: data.name.trim(), failReason: null });
        } else {
          setState({ status: "failed", resolvedName: null, failReason: data.reason ?? "Could not verify account" });
        }
      } catch {
        setState({ status: "failed", resolvedName: null, failReason: "Lookup unavailable" });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, network, isValid, debounceMs]);

  return state;
}
