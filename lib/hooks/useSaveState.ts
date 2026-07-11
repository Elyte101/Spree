'use client';

import * as React from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseSaveStateOptions {
  /** How long the "saved" state stays before reverting to idle. Default 2000ms. */
  savedDurationMs?: number;
  /**
   * Called once the "saved" state has finished displaying and status has
   * reverted to idle — e.g. to close an edit mode only *after* the user has
   * actually seen the "Saved ✓" confirmation, not the instant the save
   * resolves. Not called on error (the caller stays in its current state so
   * the user can fix and retry).
   */
  onSettle?: () => void;
}

/**
 * Drives the idle → saving → saved → idle (+ error) lifecycle for a save
 * action, so any save button in the app can show the same brief "Saved ✓"
 * confirmation instead of just a loading spinner. Pair with <SaveButton>.
 */
export function useSaveState(options: UseSaveStateOptions = {}) {
  const { savedDurationMs = 2000 } = options;
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSettleRef = React.useRef(options.onSettle);

  React.useEffect(() => {
    onSettleRef.current = options.onSettle;
  }, [options.onSettle]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const run = React.useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setStatus("saving");
      setErrorMessage(null);
      try {
        await action();
        setStatus("saved");
        timeoutRef.current = setTimeout(() => {
          setStatus("idle");
          onSettleRef.current?.();
        }, savedDurationMs);
        return true;
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Save failed");
        return false;
      }
    },
    [savedDurationMs]
  );

  const reset = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  return { status, errorMessage, run, reset };
}
