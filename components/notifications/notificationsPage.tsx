'use client';

import * as React from "react";
import Link from "next/link";
import {
  CampaignRounded,
  CheckRounded,
  Inventory2Rounded,
  MarkEmailReadRounded,
  NotificationsActiveRounded,
  PersonRounded,
  ReceiptLongRounded,
} from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "@/lib/api";
import { NotificationItem } from "@/types/types";

interface NotificationsPageProps {
  notifications: NotificationItem[];
}

const notificationIcon = (type: NotificationItem["type"]) => {
  switch (type) {
    case "promo":
      return <CampaignRounded color="primary" fontSize="small" />;
    case "order":
      return <ReceiptLongRounded color="primary" fontSize="small" />;
    case "stock":
      return <Inventory2Rounded color="primary" fontSize="small" />;
    case "account":
    default:
      return <PersonRounded color="primary" fontSize="small" />;
  }
};

const formatNotificationDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const diffMs = parsed.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");
  return formatter.format(diffDays, "day");
};

export function NotificationsPage({ notifications: initial }: NotificationsPageProps) {
  const [items, setItems] = React.useState<NotificationItem[]>(initial);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [marking, setMarking] = React.useState<Set<string>>(new Set());

  const unread = items.filter((n) => !n.isRead);
  const read = items.filter((n) => n.isRead);

  async function handleMarkRead(id: string) {
    setMarking((prev) => new Set(prev).add(id));
    try {
      await api.markNotificationRead(id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } finally {
      setMarking((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function handleMarkAllRead() {
    if (unread.length === 0) return;
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        px: { xs: 2, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.16 : 0.08
        )}, transparent 24%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={4}>
        <Paper
          elevation={0}
          sx={{ p: { xs: 3, md: 4 }, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Chip
                icon={<NotificationsActiveRounded />}
                label="Notifications"
                color="primary"
                sx={{ mb: 1.5, borderRadius: 999 }}
              />
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
                Stay on top of activity.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Orders, account updates, and promotions all in one place.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Chip label={`${unread.length} unread`} color="primary" />
              <Chip label={`${items.length} total`} variant="outlined" />
              {unread.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={markingAll ? <CircularProgress size={14} /> : <CheckRounded />}
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  sx={{ borderRadius: 999 }}
                >
                  Mark all read
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        {[{ title: "Unread", items: unread }, { title: "Earlier", items: read }].map((section) =>
          section.items.length ? (
            <Stack key={section.title} spacing={2}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "text.primary" }}>
                {section.title}
              </Typography>
              <Stack spacing={1.5}>
                {section.items.map((item) => (
                  <Paper
                    key={item.id}
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: item.isRead ? "divider" : "primary.main",
                      backgroundColor: item.isRead ? "background.paper" : "action.hover",
                    }}
                  >
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            display: "grid",
                            placeItems: "center",
                            backgroundColor: "background.default",
                            border: "1px solid",
                            borderColor: "divider",
                            flexShrink: 0,
                          }}
                        >
                          {notificationIcon(item.type)}
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                              {item.title}
                            </Typography>
                            {!item.isRead && <Chip label="New" size="small" color="primary" />}
                          </Stack>
                          <Typography variant="body1" color="text.secondary">
                            {item.body}
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack alignItems={{ xs: "flex-start", md: "flex-end" }} spacing={1} flexShrink={0}>
                        <Typography variant="body2" color="text.secondary">
                          {formatNotificationDate(item.createdAt)}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          {!item.isRead && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => handleMarkRead(item.id)}
                              disabled={marking.has(item.id)}
                              startIcon={marking.has(item.id) ? <CircularProgress size={12} /> : <CheckRounded />}
                              sx={{ borderRadius: 999, textTransform: "none" }}
                            >
                              Mark read
                            </Button>
                          )}
                          {item.href && (
                            <Button
                              component={Link}
                              href={item.href}
                              variant="outlined"
                              size="small"
                              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                            >
                              Open
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          ) : null
        )}

        <Paper
          elevation={0}
          sx={{ p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Notification preferences
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose which notifications you receive by email, in-app, and push.
              </Typography>
            </Box>
            <Button
              component={Link}
              href="/settings"
              startIcon={<MarkEmailReadRounded />}
              variant="contained"
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
            >
              Manage preferences
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
