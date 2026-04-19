'use client';

import * as React from "react";
import Link from "next/link";
import {
  NotificationsRounded,
  PaletteRounded,
  PublicRounded,
  SaveRounded,
  TuneRounded,
} from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { ThemeToggle } from "@/components/ui/themeToggle";
import { useThemeContext } from "@/theme/themeContext";

export function SettingsPage() {
  const { mode } = useThemeContext();
  const [marketingEmails, setMarketingEmails] = React.useState(true);
  const [orderUpdates, setOrderUpdates] = React.useState(true);
  const [restockAlerts, setRestockAlerts] = React.useState(true);
  const [compactCards, setCompactCards] = React.useState(false);

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100%",
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
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Chip label="Settings" color="primary" sx={{ mb: 1.5, borderRadius: 999 }} />
          <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
            Make it feel just right.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Choose how you want to browse, what updates you receive, and how the shop looks.
          </Typography>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 320px" },
            alignItems: "start",
          }}
        >
          <Stack spacing={2.5}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PublicRounded color="primary" />
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Shopping preferences
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField select label="Currency" defaultValue="USD">
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="GBP">GBP</MenuItem>
                  </TextField>
                  <TextField select label="Region" defaultValue="NA">
                    <MenuItem value="NA">North America</MenuItem>
                    <MenuItem value="EU">Europe</MenuItem>
                    <MenuItem value="GLOBAL">Global</MenuItem>
                  </TextField>
                  <TextField select label="Default sort order" defaultValue="featured">
                    <MenuItem value="featured">Featured</MenuItem>
                    <MenuItem value="newest">Newest</MenuItem>
                    <MenuItem value="rating">Top rated</MenuItem>
                    <MenuItem value="price-asc">Price low to high</MenuItem>
                  </TextField>
                  <TextField select label="Layout density" defaultValue="comfortable">
                    <MenuItem value="comfortable">Comfortable</MenuItem>
                    <MenuItem value="compact">Compact</MenuItem>
                  </TextField>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={compactCards}
                      onChange={(event) => setCompactCards(event.target.checked)}
                    />
                  }
                  label="Use compact product cards"
                />
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <NotificationsRounded color="primary" />
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Notifications
                  </Typography>
                </Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={marketingEmails}
                      onChange={(event) => setMarketingEmails(event.target.checked)}
                    />
                  }
                  label="Promotions and launch emails"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={orderUpdates}
                      onChange={(event) => setOrderUpdates(event.target.checked)}
                    />
                  }
                  label="Order and checkout updates"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={restockAlerts}
                      onChange={(event) => setRestockAlerts(event.target.checked)}
                    />
                  }
                  label="Back-in-stock alerts"
                />
              </Stack>
            </Paper>
          </Stack>

          <Stack spacing={2.5}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PaletteRounded color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Appearance
                  </Typography>
                </Stack>
                <Paper
                  elevation={0}
                  sx={(theme) => ({
                    p: 2,
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundColor: theme.palette.action.hover,
                  })}
                >
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {mode === "dark" ? "Dark appearance is on" : "Light appearance is on"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Switch the look of the shop any time.
                      </Typography>
                    </Box>
                    <ThemeToggle
                      sx={{
                        borderRadius: 999,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                  </Stack>
                </Paper>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Quick actions
                </Typography>
                <Button
                  component={Link}
                  href="/profile"
                  startIcon={<TuneRounded />}
                  variant="outlined"
                  sx={{ borderRadius: 999, justifyContent: "flex-start", textTransform: "none", fontWeight: 800 }}
                >
                  Open profile
                </Button>
                <Button
                  component={Link}
                  href="/notifications"
                  startIcon={<NotificationsRounded />}
                  variant="outlined"
                  sx={{ borderRadius: 999, justifyContent: "flex-start", textTransform: "none", fontWeight: 800 }}
                >
                  Check notifications
                </Button>
                <Button
                  startIcon={<SaveRounded />}
                  variant="contained"
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
                >
                  Save preferences
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
