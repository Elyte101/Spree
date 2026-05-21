'use client';

import Link from "next/link";
import {
  CampaignRounded,
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
  Paper,
  Stack,
  Typography,
} from "@mui/material";
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

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const diffMs = parsed.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(diffDays, "day");
};

export function NotificationsPage({ notifications }: NotificationsPageProps) {
  const unread = notifications.filter((item) => !item.isRead);
  const read = notifications.filter((item) => item.isRead);

  return (
    <Box
      sx={(theme) => ({
        minHeight: "1500px",
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
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
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
                Stay on top of store activity.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Promotions, restocks, and order updates all live here in one place.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={`${unread.length} unread`} color="primary" />
              <Chip label={`${notifications.length} total`} variant="outlined" />
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
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      spacing={2}
                    >
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
                          }}
                        >
                          {notificationIcon(item.type)}
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                              {item.title}
                            </Typography>
                            {!item.isRead ? (
                              <Chip label="New" size="small" color="primary" />
                            ) : null}
                          </Stack>
                          <Typography variant="body1" color="text.secondary">
                            {item.body}
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack alignItems={{ xs: "flex-start", md: "flex-end" }} spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {formatNotificationDate(item.createdAt)}
                        </Typography>
                        {item.href ? (
                          <Button
                            component={Link}
                            href={item.href}
                            variant="outlined"
                            size="small"
                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                          >
                            Open
                          </Button>
                        ) : null}
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
          sx={{
            p: 2.5,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Notification design tip
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use unread vs read states, action buttons, and time metadata to make notification UI feel alive.
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
