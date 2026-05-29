'use client';

import * as React from "react";
import { Box, InputAdornment, MenuItem, Select, TextField } from "@mui/material";

import { COUNTRY_PHONE_CODES } from "@/lib/ghana";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
}

const DEFAULT_CODE = "+233";

function parsePhone(full: string): { code: string; local: string } {
  // Sort longest code first so +971 beats +1 when matching "+971 ..."
  const sorted = [...COUNTRY_PHONE_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const { code } of sorted) {
    if (full === code || full.startsWith(code + " ")) {
      return { code, local: full.slice(code.length).trim() };
    }
  }
  // Value doesn't start with any known code — keep as-is in the local field
  return { code: DEFAULT_CODE, local: full.startsWith("+") ? "" : full };
}

export function PhoneInput({
  value,
  onChange,
  label = "Phone",
  required,
  disabled,
  autoComplete = "tel",
}: PhoneInputProps) {
  const initial = parsePhone(value);
  const [code, setCode] = React.useState(initial.code);
  const [local, setLocal] = React.useState(initial.local);

  // Keep in sync when parent updates value (e.g. profile loaded from API)
  const prevValue = React.useRef(value);
  React.useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      const p = parsePhone(value);
      setCode(p.code);
      setLocal(p.local);
    }
  }, [value]);

  const emit = (c: string, l: string) =>
    onChange(l.trim() ? `${c} ${l.trim()}` : c);

  const handleCode = (newCode: string) => {
    setCode(newCode);
    emit(newCode, local);
  };

  const handleLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal(e.target.value);
    emit(code, e.target.value);
  };

  return (
    <TextField
      label={label}
      type="tel"
      value={local}
      onChange={handleLocal}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
      placeholder="XX XXX XXXX"
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start" sx={{ mr: 0 }}>
              <Select
                variant="standard"
                value={code}
                onChange={(e) => handleCode(String(e.target.value))}
                disabled={disabled}
                renderValue={(v) => (
                  <Box component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                    {String(v)}
                  </Box>
                )}
                sx={{
                  mr: 1,
                  "&:before, &:after": { display: "none" },
                  "& .MuiSelect-select": { py: 0, pr: "20px !important", fontSize: "0.875rem" },
                }}
                MenuProps={{ PaperProps: { sx: { maxHeight: 280 } } }}
              >
                {COUNTRY_PHONE_CODES.map(({ code: c, label: l }) => (
                  <MenuItem key={c} value={c} sx={{ fontSize: "0.875rem" }}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
              <Box sx={{ width: "1px", height: 20, bgcolor: "divider", mr: 1.5 }} />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
