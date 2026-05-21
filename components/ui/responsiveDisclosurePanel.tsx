'use client';

import * as React from "react";
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import { ExpandLessRounded, MenuRounded } from "@mui/icons-material";

type CollapseBreakpoint = "sm" | "md" | "lg" | "xl";

interface ResponsiveDisclosurePanelProps {
  title: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  collapseBelow?: CollapseBreakpoint;
  contentSx?: SxProps<Theme>;
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  paperSx?: SxProps<Theme>;
  subtitle?: React.ReactNode;
  titleVariant?: "h5" | "h6" | "subtitle1";
}

const sxArray = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : sx ? [sx] : []);

export function ResponsiveDisclosurePanel({
  title,
  children,
  action,
  defaultOpen = false,
  collapseBelow = "md",
  contentSx,
  eyebrow,
  icon,
  paperSx,
  subtitle,
  titleVariant = "h6",
}: ResponsiveDisclosurePanelProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const contentId = React.useId();
  const titleText = typeof title === "string" ? title : "section";
  const toggleLabel = `${open ? "Collapse" : "Expand"} ${titleText}`;

  return (
    <Paper
      elevation={0}
      sx={[
        {
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        },
        ...sxArray(paperSx),
      ]}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            {eyebrow ? (
              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
                {eyebrow}
              </Typography>
            ) : null}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              {icon ? <Box sx={{ display: "inline-flex", color: "primary.main" }}>{icon}</Box> : null}
              <Typography
                variant={titleVariant}
                sx={{
                  fontWeight: 900,
                  minWidth: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {title}
              </Typography>
            </Stack>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            {action}
            <Tooltip title={toggleLabel}>
              <IconButton
                aria-controls={contentId}
                aria-expanded={open}
                aria-label={toggleLabel}
                onClick={() => setOpen((current) => !current)}
                size="small"
                sx={{
                  display: { xs: "inline-flex", [collapseBelow]: "none" },
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {open ? <ExpandLessRounded fontSize="small" /> : <MenuRounded fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Box
          id={contentId}
          sx={[
            {
              display: { xs: open ? "block" : "none", [collapseBelow]: "block" },
              minWidth: 0,
            },
            ...sxArray(contentSx),
          ]}
        >
          {children}
        </Box>
      </Stack>
    </Paper>
  );
}
