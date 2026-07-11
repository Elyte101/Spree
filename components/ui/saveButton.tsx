'use client';

import * as React from "react";
import { Button, ButtonProps, CircularProgress } from "@mui/material";
import { CheckRounded, ErrorOutlineRounded, SaveRounded } from "@mui/icons-material";

import type { SaveStatus } from "@/lib/hooks/useSaveState";

interface SaveButtonProps extends Omit<ButtonProps, "children" | "color"> {
  status: SaveStatus;
  idleLabel?: string;
  savingLabel?: string;
  savedLabel?: string;
  errorLabel?: string;
}

/**
 * A save button that reflects a useSaveState() status: idle → saving →
 * saved (brief checkmark) → idle, or error. Reused across every "Save"
 * action in the app instead of each one rolling its own loading state.
 */
export function SaveButton({
  status,
  idleLabel = "Save",
  savingLabel = "Saving…",
  savedLabel = "Saved",
  errorLabel = "Save failed",
  disabled,
  sx,
  variant = "contained",
  ...buttonProps
}: SaveButtonProps) {
  const label =
    status === "saving" ? savingLabel
    : status === "saved" ? savedLabel
    : status === "error" ? errorLabel
    : idleLabel;

  const icon =
    status === "saving" ? <CircularProgress size={16} color="inherit" />
    : status === "saved" ? <CheckRounded />
    : status === "error" ? <ErrorOutlineRounded />
    : <SaveRounded />;

  const color: ButtonProps["color"] =
    status === "saved" ? "success" : status === "error" ? "error" : "primary";

  return (
    <Button
      {...buttonProps}
      type={buttonProps.type ?? "button"}
      variant={variant}
      color={color}
      startIcon={icon}
      disabled={disabled || status === "saving"}
      sx={{
        borderRadius: 999,
        textTransform: "none",
        fontWeight: 900,
        transition: "background-color 0.2s ease, color 0.2s ease",
        ...sx,
      }}
    >
      {label}
    </Button>
  );
}
